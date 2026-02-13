import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { z } from "npm:zod";
import { zValidator } from "npm:@hono/zod-validator";
import * as kv from "./kv_store.tsx";

// Repositories & Types
import { 
    AgentRepo, 
    DeviceRepo, 
    NotificationRepo, 
    SubscriptionRepo, 
    JobRepo,
    ConversationRepo,
    FileRepo,
    InsightsRepo
} from "./repositories.ts";
import { Agent, Job, KBFile } from "./types.ts";

// Services
import { 
    getTenantId, 
    logActivity, 
    ensureBucket,
    supabase 
} from "./core.ts";

import { 
    callLLM, 
    describeImage 
} from "./ai.ts";

import { upsertDocument } from "./vector_store.ts"; // Vector Store Integration

import { 
    processStripeWebhook,
    createCheckoutSession,
    createPortalSession
} from "./billing.ts";

import { 
    updateConversationState, 
    saveMessage,
    processOutboundMessage
} from "./chat.ts";

// --- GLOBAL APP SETUP ---
const app = new Hono();

// Global Middleware
app.use('*', logger(console.log));

// Robust CORS Configuration
app.use("*", cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "x-client-info", "apikey"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
}));

// Handle OPTIONS explicitly for preflight checks
app.options("*", (c) => {
  return c.text("", 204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
  });
});

app.onError((err, c) => {
  console.error("Global Server Error:", err);
  return c.json({ error: err.message || "Internal Server Error" }, 500);
});

// Initialization
console.log("Server instance starting at", new Date().toISOString());
setTimeout(() => ensureBucket().catch(console.error), 1000);

// --- VALIDATION SCHEMAS ---
const CreateAgentSchema = z.object({
    name: z.string().min(2),
    role: z.string().min(2),
    description: z.string().optional(),
    systemPrompt: z.string().optional(),
    channels: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    avatar: z.string().optional(),
    modelConfig: z.object({
        provider: z.string().optional(),
        model: z.string().optional(),
        temperature: z.number().optional(),
        maxTokens: z.number().optional()
    }).optional()
});

const DeviceActionSchema = z.object({
    action: z.enum(['turn_on', 'turn_off', 'lock', 'unlock', 'snapshot', 'simulate_failure']),
    params: z.record(z.any()).optional()
});

const ChatSchema = z.object({
    agentId: z.string(),
    messages: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string()
    })),
    context: z.object({
        sessionId: z.string().optional(),
        channel: z.string().optional() // 'webchat', 'whatsapp', 'twilio'
    }).optional()
});

const OutboundMessageSchema = z.object({
    to: z.string().min(5),
    channel: z.enum(['whatsapp', 'sms', 'email']),
    content: z.string().min(1),
    agentId: z.string().optional()
});

const KnowledgeUploadSchema = z.object({
    fileName: z.string(),
    fileType: z.string()
});

const KnowledgeConfirmSchema = z.object({
    name: z.string(),
    size: z.union([z.string(), z.number()]),
    type: z.string(),
    filePath: z.string().optional(),
    namespace: z.string().optional()
});

// --- API ROUTES ---
const routes = new Hono();

routes.get("/health", (c) => c.json({ status: "ok" }));

// AUTH
routes.post("/signup", async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ error: "Email and password required" }, 400);

  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true
  });

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ success: true, user: data.user });
});

// AGENTS
routes.get("/agents", async (c) => {
  const tenantId = await getTenantId(c);
  const agents = await AgentRepo.list(tenantId);
  return c.json({ agents });
});

routes.post("/agents", zValidator('json', CreateAgentSchema), async (c) => {
  const tenantId = await getTenantId(c);
  const data = c.req.valid('json');
  
  const newAgent: Agent = {
      id: crypto.randomUUID(),
      ...data,
      channels: data.channels || ["webchat"],
      languages: data.languages || ["English"],
      status: 'active',
      metrics: { conversations: 0, csat: "N/A", avgResponseTime: "0s" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
  };

  await AgentRepo.save(tenantId, newAgent);
  await logActivity(tenantId, { agent: "System", action: `Created agent: ${newAgent.name}`, type: "info", platform: "Admin" });

  return c.json({ success: true, agent: newAgent });
});

// AGENT DECISIONS - Approve/Reject (DEVE VIR ANTES de /agents/:id para não conflitar)
routes.post("/agents/decisions/:id/approve", async (c) => {
    console.log('[approveDecision] ⚡ ROTA CHAMADA ⚡');
    console.log('[approveDecision] Path:', c.req.path);
    console.log('[approveDecision] Method:', c.req.method);
    console.log('[approveDecision] Params:', c.req.param());
    
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        const { edited_answer, user_id } = body;
        
        console.log('[approveDecision] Dados recebidos:', { id, edited_answer, user_id });
        
        if (!user_id) {
            return c.json({ error: 'user_id é obrigatório' }, 400);
        }
        
        // 1. Buscar decisão
        const { data: decision, error: fetchError } = await supabase
            .from('tb_agent_decisions')
            .select('*')
            .eq('id', id)
            .single();
        
        if (fetchError || !decision) {
            return c.json({ error: 'Decisão não encontrada' }, 404);
        }
        
        if (decision.status !== 'pending_approval') {
            return c.json({ error: 'Decisão já foi processada' }, 400);
        }
        
        // 2. Atualizar decisão
        const finalAnswer = edited_answer || decision.answer;
        const wasEdited = edited_answer && edited_answer !== decision.answer;
        
        const updateData: any = {
            status: 'approved',
            approved_by: user_id,
            approved_at: new Date().toISOString(),
            approved_answer: finalAnswer
        };
        
        if (wasEdited) {
            updateData.edited_by = user_id;
            updateData.edited_at = new Date().toISOString();
        }
        
        const { error: updateError } = await supabase
            .from('tb_agent_decisions')
            .update(updateData)
            .eq('id', id);
        
        if (updateError) {
            console.error('[approveDecision] Erro ao atualizar:', updateError);
            return c.json({ error: 'Erro ao atualizar decisão' }, 500);
        }
        
        // ✅ Salvar log de aprovação
        try {
            // Buscar email do usuário que aprovou
            const { data: userData } = await supabase
                .from('tb_users')
                .select('email')
                .eq('id', user_id)
                .maybeSingle();
            
            // Buscar nome do agente
            const { data: agentData } = await supabase
                .from('tb_agents')
                .select('nome')
                .eq('id', decision.agent_id)
                .maybeSingle();
            
            const agentName = agentData?.nome || decision.agent_id;
            const message = wasEdited 
                ? `Decisão do agente "${agentName}" aprovada e editada pelo usuário`
                : `Decisão do agente "${agentName}" aprovada pelo usuário`;
            
            await supabase
                .from('tb_system_logs')
                .insert({
                    companies_id: decision.companies_id,
                    user_id: user_id,
                    user_email: userData?.email,
                    agent_id: decision.agent_id,
                    log_type: 'decision_approved',
                    level: 'info',
                    message,
                    metadata: {
                        decision_id: id,
                        agent_id: decision.agent_id,
                        agent_name: agentName,
                        was_edited: wasEdited,
                        original_answer: decision.answer,
                        approved_answer: finalAnswer,
                        confidence_score: decision.confidence_score,
                        reason: decision.reason,
                        channel: decision.channel
                    },
                    impact_level: 'low'
                });
        } catch (logError: any) {
            console.warn('[approveDecision] Erro ao salvar log de aprovação:', logError);
            // Não bloqueia a aprovação se falhar ao salvar log
        }
        
        // 3. Enviar mensagem via canal apropriado
        if (decision.channel === 'whatsapp' && decision.integrations_id && decision.contact_id) {
            try {
                // Buscar configuração da integração WhatsApp
                const { data: integration, error: integrationError } = await supabase
                    .from('tb_integrations')
                    .select('api_url, api_key, instance_name')
                    .eq('id', decision.integrations_id)
                    .single();
                
                if (integrationError || !integration) {
                    console.error('[approveDecision] Erro ao buscar integração:', integrationError);
                    return c.json({ 
                        error: 'Erro ao buscar configuração do WhatsApp',
                        details: integrationError?.message 
                    }, 500);
                }
                
                if (!integration.api_url || !integration.api_key || !integration.instance_name) {
                    return c.json({ 
                        error: 'Configuração do WhatsApp incompleta',
                        details: 'api_url, api_key ou instance_name não configurados'
                    }, 500);
                }
                
                // Enviar mensagem via Evolution API
                // Formato do payload: { number: string, text: string }
                // O number pode ser LID (@lid) ou número real (@s.whatsapp.net)
                const evolutionUrl = `${integration.api_url}/message/sendText/${integration.instance_name}`;
                
                console.log('[approveDecision] Enviando WhatsApp:', {
                    url: evolutionUrl,
                    contact_id: decision.contact_id,
                    message_length: finalAnswer.length
                });
                
                const response = await fetch(evolutionUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': integration.api_key
                    },
                    body: JSON.stringify({
                        number: decision.contact_id, // Pode ser LID ou número real
                        text: finalAnswer
                    })
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[approveDecision] Erro ao enviar WhatsApp:', errorText);
                    return c.json({ 
                        error: 'Erro ao enviar mensagem via WhatsApp',
                        details: errorText 
                    }, 500);
                }
                
                console.log('[approveDecision] ✅ WhatsApp enviado com sucesso');
            } catch (sendError: any) {
                console.error('[approveDecision] Erro ao enviar:', sendError);
                return c.json({ 
                    error: 'Erro ao enviar mensagem',
                    details: sendError.message 
                }, 500);
            }
        } else if (decision.channel === 'email' && decision.contact_id) {
            console.warn('[approveDecision] Envio de email ainda não implementado');
        }
        
        return c.json({ 
            success: true, 
            decision_id: id,
            message: 'Decisão aprovada e mensagem enviada com sucesso'
        });
    } catch (error: any) {
        console.error('[approveDecision] Erro:', error);
        return c.json({ 
            error: 'Erro ao aprovar decisão',
            details: error.message 
        }, 500);
    }
});

routes.post("/agents/decisions/:id/reject", async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        const { user_id } = body;
        
        // Buscar decisão antes de atualizar para ter os dados
        const { data: decision, error: fetchError } = await supabase
            .from('tb_agent_decisions')
            .select('*')
            .eq('id', id)
            .single();
        
        if (fetchError || !decision) {
            return c.json({ error: 'Decisão não encontrada' }, 404);
        }
        
        const { error } = await supabase
            .from('tb_agent_decisions')
            .update({
                status: 'rejected',
                rejected_at: new Date().toISOString(),
                rejected_by: user_id || null
            })
            .eq('id', id);
        
        if (error) {
            console.error('[rejectDecision] Erro ao rejeitar:', error);
            return c.json({ error: 'Erro ao rejeitar decisão' }, 500);
        }
        
        // ✅ Salvar log de rejeição
        try {
            // Buscar email do usuário que rejeitou (se tiver user_id)
            let userEmail: string | undefined;
            if (user_id) {
                const { data: userData } = await supabase
                    .from('tb_users')
                    .select('email')
                    .eq('id', user_id)
                    .maybeSingle();
                
                userEmail = userData?.email;
            }
            
            // Buscar nome do agente
            const { data: agentData } = await supabase
                .from('tb_agents')
                .select('nome')
                .eq('id', decision.agent_id)
                .maybeSingle();
            
            const agentName = agentData?.nome || decision.agent_id;
            const message = `Decisão do agente "${agentName}" rejeitada pelo usuário`;
            
            await supabase
                .from('tb_system_logs')
                .insert({
                    companies_id: decision.companies_id,
                    user_id: user_id || null,
                    user_email: userEmail,
                    agent_id: decision.agent_id,
                    log_type: 'decision_rejected',
                    level: 'info',
                    message,
                    metadata: {
                        decision_id: id,
                        agent_id: decision.agent_id,
                        agent_name: agentName,
                        original_answer: decision.answer,
                        confidence_score: decision.confidence_score,
                        reason: decision.reason,
                        channel: decision.channel
                    },
                    impact_level: 'low'
                });
        } catch (logError: any) {
            console.warn('[rejectDecision] Erro ao salvar log de rejeição:', logError);
            // Não bloqueia a rejeição se falhar ao salvar log
        }
        
        return c.json({ success: true, decision_id: id });
    } catch (error: any) {
        console.error('[rejectDecision] Erro:', error);
        return c.json({ 
            error: 'Erro ao rejeitar decisão',
            details: error.message 
        }, 500);
    }
});

routes.put("/agents/:id", async (c) => {
    const tenantId = await getTenantId(c);
    const id = c.req.param('id');
    const updates = await c.req.json();
    
    const existing = await AgentRepo.get(tenantId, id);
    if (!existing) return c.json({ error: "Agent not found" }, 404);
    
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await AgentRepo.save(tenantId, updated);
    
    return c.json({ success: true, agent: updated });
});

routes.delete("/agents/:id", async (c) => {
    const tenantId = await getTenantId(c);
    const id = c.req.param('id');
    await AgentRepo.delete(tenantId, id);
    return c.json({ success: true });
});

// DEVICES
routes.get("/devices", async (c) => {
    const tenantId = await getTenantId(c);
    const devices = await DeviceRepo.list(tenantId);
    return c.json({ devices });
});

routes.post("/devices", async (c) => {
    const tenantId = await getTenantId(c);
    const body = await c.req.json();
    const device = { 
        id: body.id || crypto.randomUUID(), 
        ...body, 
        lastHeartbeat: new Date().toISOString() 
    };
    await DeviceRepo.save(tenantId, device);
    return c.json({ device });
});

routes.post("/devices/:id/action", zValidator('json', DeviceActionSchema), async (c) => {
    const tenantId = await getTenantId(c);
    const deviceId = c.req.param('id');
    const { action, params } = c.req.valid('json');
    
    if (action === 'snapshot') {
        const jobId = crypto.randomUUID();
        
        // Dynamic Image Logic: Use provided URL or fallback to "live" random source
        const providedUrl = params?.imageUrl;
        const fallbackUrl = `https://source.unsplash.com/random/800x600?office,cctv&sig=${Date.now()}`;
        
        const job: Job = { 
            id: jobId, 
            type: 'sentinel_audit', 
            status: 'queued', 
            createdAt: new Date().toISOString(), 
            payload: { 
                deviceId, 
                imageUrl: providedUrl || fallbackUrl
            } 
        };
        
        await JobRepo.save(tenantId, job);
        return c.json({ success: true, async: true, jobId, message: "Audit queued." });
    } 
    
    if (action === 'simulate_failure') {
        await NotificationRepo.add(tenantId, { type: 'error', title: 'Device Failure', message: `Device ${deviceId} timed out.` });
        await logActivity(tenantId, { agent: "System", action: `Device Failure: ${deviceId}`, type: "error", platform: "IoT" });
        throw new Error("Device timed out");
    }
    
    await logActivity(tenantId, { agent: "System", action: `Triggered: ${action}`, type: "info", platform: "IoT" });
    if (['lock', 'unlock', 'turn_off'].includes(action)) {
        await NotificationRepo.add(tenantId, { type: 'info', title: 'Device State Changed', message: `Device ${deviceId} set to ${action}.` });
    }
    return c.json({ success: true, async: false });
});

// JOBS
routes.get("/jobs/:id", async (c) => {
    const tenantId = await getTenantId(c);
    const job = await JobRepo.get(tenantId, c.req.param('id'));
    if (!job) return c.json({ error: "Job not found" }, 404);
    return c.json(job);
});

routes.post("/jobs/:id/process", async (c) => {
    const tenantId = await getTenantId(c);
    const job = await JobRepo.get(tenantId, c.req.param('id'));
    
    if (!job || job.status === 'completed') return c.json(job);

    if (job.type === 'sentinel_audit') {
        try {
            const url = job.payload.imageUrl;
            if (!url) throw new Error("No image URL provided");

            const imgRes = await fetch(url);
            const blob = await imgRes.blob();
            const description = await describeImage(blob, "image/jpeg");
            
            const policyCheck = description.toLowerCase().includes("person") 
                ? "Warning: Personnel detected in restricted area." 
                : "Compliance: Area is clear.";

            const updatedJob: Job = { 
                ...job, 
                status: 'completed', 
                result: { analysis: description, compliance: policyCheck }, 
                completedAt: new Date().toISOString() 
            };
            
            await JobRepo.save(tenantId, updatedJob);
            await logActivity(tenantId, { agent: "Sentinel One", action: `Audit Completed`, type: policyCheck.includes("Warning") ? "warning" : "success", platform: "IoT" });
            
            return c.json(updatedJob);
        } catch (err) {
            const failedJob: Job = { 
                ...job, 
                status: 'failed', 
                error: err instanceof Error ? err.message : "Unknown Error" 
            };
            await JobRepo.save(tenantId, failedJob);
            return c.json(failedJob);
        }
    }
    return c.json(job);
});

// NOTIFICATIONS & DASHBOARD
routes.get("/notifications", async (c) => {
    const tenantId = await getTenantId(c);
    const notifications = await NotificationRepo.list(tenantId);
    return c.json({ notifications });
});

routes.post("/notifications/mark-read", async (c) => {
    const tenantId = await getTenantId(c);
    const { id } = await c.req.json();
    await NotificationRepo.markRead(tenantId, id);
    return c.json({ success: true });
});

routes.post("/notifications/test", async (c) => {
    const tenantId = await getTenantId(c);
    const { type } = await c.req.json();
    
    await NotificationRepo.add(tenantId, { 
        type: type || 'info', 
        title: "Test Notification", 
        message: "This is a test from the admin panel." 
    });
    return c.json({ success: true });
});

// INSIGHTS
routes.get("/insights", async (c) => {
    try {
        const tenantId = await getTenantId(c);
        
        // Buscar email do usuário
        const { data: userData, error: userError } = await supabase
            .from('tb_users')
            .select('email, id')
            .eq('id', tenantId)
            .maybeSingle();
        
        if (userError || !userData?.email) {
            console.error("[INSIGHTS] Erro ao buscar usuário:", userError);
            return c.json({
                overview: [],
                channels: [],
                summary: {
                    total_interactions: 0,
                    total_cost: 0,
                    active_channels: 0,
                    total_tokens: 0,
                    rag_usage_count: 0,
                    rag_usage_rate: 0
                }
            });
        }

        const userEmail = userData.email;
        const period = c.req.query('period') || '7d';
        const days = period === '7d' ? 7 : period === '30d' ? 30 : 7;

        // Buscar dados de analytics
        const [overviewResult, channelsResult, summaryResult] = await Promise.all([
            supabase.rpc('sp_get_analytics_overview_by_email', {
                p_email: userEmail,
                p_days: days
            }),
            supabase.rpc('sp_get_analytics_channel_distribution_by_email', {
                p_email: userEmail,
                p_days: days
            }),
            supabase.rpc('sp_get_analytics_summary_by_email', {
                p_email: userEmail,
                p_days: days
            })
        ]);

        // Verificar erros
        if (overviewResult.error) {
            console.error("[INSIGHTS] Erro ao buscar overview:", overviewResult.error);
        }
        if (channelsResult.error) {
            console.error("[INSIGHTS] Erro ao buscar channels:", channelsResult.error);
        }
        if (summaryResult.error) {
            console.error("[INSIGHTS] Erro ao buscar summary:", summaryResult.error);
        }

        console.log("[INSIGHTS] Resultados brutos:", {
            overviewError: overviewResult.error,
            overviewData: overviewResult.data,
            overviewDataLength: overviewResult.data?.length || 0,
            channelsError: channelsResult.error,
            channelsData: channelsResult.data,
            channelsDataLength: channelsResult.data?.length || 0,
            summaryError: summaryResult.error,
            summaryData: summaryResult.data,
            summaryDataLength: summaryResult.data?.length || 0,
            userEmail,
            days,
            companiesId: userData?.id
        });

        const overview = (overviewResult.data && Array.isArray(overviewResult.data)) ? overviewResult.data : [];
        const channels = (channelsResult.data && Array.isArray(channelsResult.data)) ? channelsResult.data : [];
        const summary = (summaryResult.data && Array.isArray(summaryResult.data) && summaryResult.data.length > 0) 
            ? summaryResult.data[0] 
            : {
                total_interactions: 0,
                total_cost: 0,
                active_channels: 0,
                total_tokens: 0,
                rag_usage_count: 0,
                rag_usage_rate: 0
            };

        console.log("[INSIGHTS] Dados processados para retorno:", {
            overviewCount: overview.length,
            channelsCount: channels.length,
            summary,
            overviewSample: overview.slice(0, 3),
            channelsSample: channels.slice(0, 3),
            willReturn: {
                overview: overview.length > 0 ? 'SIM' : 'NÃO',
                channels: channels.length > 0 ? 'SIM' : 'NÃO',
                summary: summary.total_interactions > 0 || summary.total_tokens > 0 ? 'SIM' : 'NÃO'
            }
        });

        return c.json({
            overview,
            channels,
            summary
        });
    } catch (error: any) {
        console.error("[INSIGHTS] Erro:", error);
        return c.json({
            overview: [],
            channels: [],
            summary: {
                total_interactions: 0,
                total_cost: 0,
                active_channels: 0,
                total_tokens: 0,
                rag_usage_count: 0,
                rag_usage_rate: 0
            }
        }, 500);
    }
});

// DASHBOARD
routes.get("/dashboard", async (c) => {
    try {
        // Obter tenantId usando getTenantId (padrão da API)
        const tenantId = await getTenantId(c);
        
        // Buscar email em tb_users (fonte de verdade)
        // Tentar buscar usando tenantId como id de tb_users
        // Se não encontrar, pode ser que precise de uma função RPC específica
        const { data: userData, error: userError } = await supabase
            .from('tb_users')
            .select('email, id')
            .eq('id', tenantId)
            .maybeSingle();
        
        if (userError || !userData?.email) {
            console.error("[DASHBOARD] Erro ao buscar usuário em tb_users:", userError);
            // Retornar resposta padrão mesmo em erro
            return c.json({
                hasStats: false,
                hasAgents: false,
                hasActivityFeed: false,
                agentsCount: 0,
                agents: []
            });
        }
        
        const userEmail = userData.email;
        
        // Buscar agentes usando a mesma função do AgentsHub
        const { data: agentsData, error: agentsError } = await supabase.rpc('sp_list_agents_by_email', {
            p_email: userEmail
        });
        
        if (agentsError) {
            console.error("[DASHBOARD] Erro na sp_list_agents_by_email:", agentsError);
        }
        
        // Processar agentsData para o formato correto
        let agentsList: Array<{ id: string; nome: string; status_id: number | null }> = [];
        
        if (agentsData && Array.isArray(agentsData)) {
            agentsList = agentsData.map((agent: any) => {
                let statusId: number | null = null;
                if (agent.status_id !== null && agent.status_id !== undefined) {
                    statusId = typeof agent.status_id === 'string' ? parseInt(agent.status_id, 10) : Number(agent.status_id);
                    if (isNaN(statusId)) {
                        statusId = null;
                    }
                }
                return {
                    id: String(agent.id),
                    nome: agent.nome || 'Sem nome',
                    status_id: statusId
                };
            });
        }
        
        // Retornar resposta padronizada
        return c.json({
            hasStats: false,
            hasAgents: agentsList.length > 0,
            hasActivityFeed: false,
            agentsCount: agentsList.length,
            agents: agentsList
        });
        
    } catch (err: any) {
        console.error("[DASHBOARD] Erro:", err);
        // Sempre retornar resposta padronizada, mesmo em erro
        return c.json({
            hasStats: false,
            hasAgents: false,
            hasActivityFeed: false,
            agentsCount: 0,
            agents: []
        }, 500);
    }
});

// INBOX
routes.get("/inbox/conversations", async (c) => {
    const tenantId = await getTenantId(c);
    const conversations = await ConversationRepo.list(tenantId);
    return c.json({ conversations });
});

routes.get("/inbox/conversations/:id/messages", async (c) => {
    const tenantId = await getTenantId(c);
    const conversationId = c.req.param('id');
    const sessionKey = `tenant:${tenantId}:chat_session:${conversationId}`;
    const session = await kv.get(sessionKey);
    return c.json({ messages: session?.messages || [] });
});

routes.post("/inbox/conversations/:id/status", async (c) => {
     const tenantId = await getTenantId(c);
     const conversationId = c.req.param('id');
     const { status } = await c.req.json();
     await updateConversationState(tenantId, conversationId, { status });
     return c.json({ success: true });
});

routes.post("/inbox/conversations/:id/reply", async (c) => {
     const tenantId = await getTenantId(c);
     const conversationId = c.req.param('id');
     const { content } = await c.req.json();
     
     const message = { role: "assistant", content, meta: { sentBy: "human" } };
     await saveMessage(tenantId, conversationId, message as any);
     return c.json({ success: true, message });
});

// KNOWLEDGE BASE
routes.get("/knowledge", async (c) => {
    const tenantId = await getTenantId(c);
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    
    // Pagination support for large KBs
    const { items, total } = await FileRepo.list(tenantId, limit, offset);
    return c.json({ files: items, total, limit, offset });
});

routes.post("/knowledge/upload-url", zValidator('json', KnowledgeUploadSchema), async (c) => {
    const tenantId = await getTenantId(c);
    const { fileName, fileType } = c.req.valid('json');
    
    const { data, error } = await supabase.storage.from('sonia-kb').createSignedUrl(
        `${tenantId}/${fileName}`,
        3600
    );
    
    if (error || !data) {
        console.error("Storage Error:", error);
        return c.json({ error: "Failed to create upload URL" }, 500);
    }

    return c.json({ uploadUrl: data.signedUrl, path: data.path });
});

routes.post("/knowledge", zValidator('json', KnowledgeConfirmSchema), async (c) => {
    const tenantId = await getTenantId(c);
    const body = c.req.valid('json');
    
    const file: KBFile = {
        id: crypto.randomUUID(),
        name: body.name,
        size: typeof body.size === 'string' ? parseInt(body.size) : body.size,
        type: body.type,
        status: 'processing', // Initial status while indexing
        url: body.filePath ? `storage://sonia-kb/${body.filePath}` : "",
        uploadedAt: new Date().toISOString(),
        vectorsIndexed: 0
    };
    
    await FileRepo.save(tenantId, file);

    // TRIGGER VECTOR INDEXING (Async)
    // We don't await this to keep UI responsive, but in a real queue system this would be a Job.
    (async () => {
        try {
            if (body.filePath) {
                console.log(`[Indexing] Starting vector ingestion for ${file.name}`);
                
                const { data: blob, error: downErr } = await supabase.storage
                    .from('sonia-kb')
                    .download(body.filePath);

                if (downErr || !blob) {
                    console.error("[Indexing] Failed to download file for indexing", downErr);
                    return;
                }

                // Basic content extraction (Text-based only for MVP)
                // TODO: Add PDF parsing lib (e.g. pdf-parse) if needed, but risky in Edge environment.
                if (file.type.includes('text') || file.type.includes('json') || file.type.includes('markdown') || file.type.includes('csv')) {
                    const textContent = await blob.text();
                    
                    if (textContent.length > 0) {
                        await upsertDocument(tenantId, file.id, textContent, { 
                            filename: file.name,
                            type: file.type 
                        });
                        
                        // Update status to ready
                        file.status = 'ready';
                        file.vectorsIndexed = 100;
                        await FileRepo.save(tenantId, file);
                        console.log(`[Indexing] Successfully indexed ${file.name}`);
                    }
                } else {
                     // Non-text files are just stored, not indexed
                     console.log(`[Indexing] Skipped non-text file ${file.name}`);
                     file.status = 'ready';
                     await FileRepo.save(tenantId, file);
                }
            }
        } catch (err) {
            console.error("[Indexing] Fatal error during background ingestion:", err);
            file.status = 'failed';
            await FileRepo.save(tenantId, file);
        }
    })();

    return c.json({ success: true, file });
});

routes.delete("/knowledge/:id", async (c) => {
    const tenantId = await getTenantId(c);
    const id = c.req.param('id');
    await FileRepo.delete(tenantId, id);
    return c.json({ success: true });
});

// INSIGHTS
routes.get("/insights", async (c) => {
    const tenantId = await getTenantId(c);
    let insights = await InsightsRepo.list(tenantId);
    if (!insights || insights.length === 0) {
        insights = await InsightsRepo.generate(tenantId);
    }
    return c.json({ insights });
});

// OUTBOUND (Campaigns / Proactive)
routes.post("/outbound/message", zValidator('json', OutboundMessageSchema), async (c) => {
    const tenantId = await getTenantId(c);
    const params = c.req.valid('json');
    
    // Process and Store
    const result = await processOutboundMessage(tenantId, params);
    
    if (!result.success) {
        return c.json({ error: result.error || "Failed to send message" }, 500);
    }
    
    await logActivity(tenantId, { 
        agent: params.agentId || "System", 
        action: `Sent outbound ${params.channel} to ${params.to}`, 
        type: "info", 
        platform: params.channel 
    });

    return c.json(result);
});

// CHAT (Inbound)
routes.post("/chat", zValidator('json', ChatSchema), async (c) => {
  try {
    const tenantId = await getTenantId(c);
    const { agentId, messages, context } = c.req.valid('json');
    const sessionId = context?.sessionId || crypto.randomUUID();
    const channel = context?.channel || "webchat";

    let agent: Agent | null = null;

    if (agentId === 'system-copilot') {
        // Virtual System Copilot Agent
        agent = {
            id: 'system-copilot',
            name: 'Sonia Copilot',
            role: 'Platform Assistant',
            description: 'Helps users navigate and use the SONIA platform.',
            channels: ['webchat'],
            languages: ['English', 'Portuguese', 'Spanish', 'French', 'German'],
            status: 'active',
            modelConfig: { provider: 'openai', model: 'gpt-4o' },
            metrics: { conversations: 0, csat: 'N/A', avgResponseTime: '0s' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            systemPrompt: `You are Sonia Copilot, the intelligent assistant for the SONIA AI Agent Platform for Customer Service and Lead Prospecting (AI SDR).
            
            CAPABILITIES:
            1. Navigation: You can help users find pages. Available routes: 'cockpit', 'inbox', 'devices', 'agents', 'playground', 'knowledge', 'governance', 'insights', 'configuration', 'profile'.
               To navigate, strictly output the command: [NAVIGATE: page_id]. Example: [NAVIGATE: agents].
            2. Explanation: Explain how to use the platform (creating AI Agents, setting up knowledge bases, connecting CRM tools).
            3. Analysis: Analyze lead data and conversation performance provided in the context.
            
            TONE: Professional, helpful, concise. 
            LANGUAGES: You are fluent in Portuguese, English, and Spanish. Always reply in the language the user initiated.`
        };
    } else {
        agent = await AgentRepo.get(tenantId, agentId);
    }

    if (!agent) return c.json({ error: "Agent not found" }, 404);

    // 🛡️ GUARDRAIL: Valida status_id ANTES de processar (evita gastar tokens)
    // Busca status_id do banco se não estiver no objeto do KV
    let statusId: number | null = null
    
    if ((agent as any).status_id !== null && (agent as any).status_id !== undefined) {
      statusId = typeof (agent as any).status_id === 'string' 
        ? parseInt((agent as any).status_id, 10) 
        : Number((agent as any).status_id)
    } else {
      // Se não tem status_id no KV, busca do banco
      try {
        const { data: userData } = await supabase
          .from('tb_users')
          .select('id')
          .eq('id', tenantId)
          .maybeSingle()
        
        if (userData?.id) {
          const { data: agentData } = await supabase
            .from('tb_agents')
            .select('status_id')
            .eq('id', agentId)
            .eq('user_id', userData.id)
            .maybeSingle()
          
          if (agentData?.status_id !== null && agentData?.status_id !== undefined) {
            statusId = typeof agentData.status_id === 'string' 
              ? parseInt(agentData.status_id, 10) 
              : Number(agentData.status_id)
          }
        }
      } catch (err) {
        console.error('[CHAT] Erro ao buscar status_id do banco:', err)
      }
    }

    // Valida status_id: 1=ativo, 2=cancelado, 3=pausado, 4=pausado
    if (statusId !== 1) {
      const reason = statusId === 2 ? 'cancelado' : statusId === 3 || statusId === 4 ? 'pausado' : 'inativo'
      console.warn('[CHAT] 🛡️ GUARDRAIL: Agente bloqueado - não está ativo:', {
        agentId: agent.id,
        agentName: agent.name,
        status_id: statusId,
        reason
      })
      return c.json({ 
        error: `Agente ${agent.name || 'indisponível'} está ${reason} e não pode responder no momento.`,
        role: "assistant",
        content: `❌ Agente ${agent.name || 'indisponível'} está ${reason} e não pode responder no momento.`,
        sessionId
      }, 403)
    }

    // Initialize/Update Session
    const sessionKey = `tenant:${tenantId}:chat_session:${sessionId}`;
    let session = await kv.get(sessionKey);
    
    if (!session) {
        
        await updateConversationState(tenantId, sessionId, { 
            platform: channel, 
            agentId, 
            status: 'active' 
        });
        
    }
    
    const lastMsg = messages[messages.length-1];
    if (lastMsg && lastMsg.role === 'user') await saveMessage(tenantId, sessionId, lastMsg);

    // Multilingual Prompt Injection
    const languageInstruction = (agent.languages && agent.languages.length > 0) 
        ? `You must converse effectively in the following languages: ${agent.languages.join(", ")}. Detect the user's language and reply in the same language.`
        : "You are an English speaking assistant.";

    let systemPrompt = "";

    if (agent.systemPrompt && agent.systemPrompt.trim().length > 0) {
        // User defined custom prompt - Priority 1
        systemPrompt = `${agent.systemPrompt}\n\nIMPORTANT SYSTEM INSTRUCTIONS:\n${languageInstruction}`;
    } else {
        // Default SDR Prompt - Fallback
        systemPrompt = `You are ${agent.name}, an expert AI SDR (Sales Development Rep) and Customer Success Agent. 
        Role: ${agent.role}. 
        Context: ${agent.description || 'None'}.
        
        YOUR GOALS:
        1. QUALIFY: Identify customer needs and budget. Use 'kb_search_product' to answer questions accurately.
        2. CAPTURE: If a user shows interest, ask for their details and use 'crm_capture_lead'.
        3. CONVERT: Try to schedule a demo using 'calendar_check_availability' and 'calendar_book_meeting'.
        
        TOOLS: You have access to CRM, Calendar, Knowledge Base, and IoT Controls. Use them pro-actively.
        ${languageInstruction}`;
    }

    const provider = agent.modelConfig?.provider || 'openai';
    const model = agent.modelConfig?.model || 'gpt-4o';
    const agentApiKey = agent.modelConfig?.apiKey; // API key do agente (opcional)
    
    const aiRes = await callLLM(
        provider,
        model,
        messages,
        systemPrompt,
        tenantId,
        agentApiKey // Passa a API key do agente se disponível
    );
    
    const aiMsg = aiRes.choices[0].message;
    await saveMessage(tenantId, sessionId, { role: 'assistant', content: aiMsg.content });
    
    return c.json({ role: "assistant", content: aiMsg.content, usage: aiRes.usage, sessionId });

  } catch (err) {
    console.error("Chat Error:", err);
    return c.json({ error: err.message || "Error processing chat" }, 500);
  }
});

// BILLING
routes.get("/billing/subscription", async (c) => {
    const tenantId = await getTenantId(c);
    const sub = await SubscriptionRepo.get(tenantId);
    return c.json(sub);
});

routes.post("/billing/checkout", async (c) => {
    const tenantId = await getTenantId(c);
    const { priceId } = await c.req.json();
    const origin = c.req.header('origin') || "https://sonia.ai"; 
    
    try {
        const url = await createCheckoutSession(tenantId, priceId, `${origin}/configuration`);
        return c.json({ url });
    } catch (e) {
        console.error("Checkout Error:", e);
        return c.json({ error: e.message || "Checkout Failed" }, 400);
    }
});

routes.post("/billing/portal", async (c) => {
    const tenantId = await getTenantId(c);
    const origin = c.req.header('origin') || "https://sonia.ai";
    try {
        const url = await createPortalSession(tenantId, `${origin}/configuration`);
        return c.json({ url });
    } catch (e) {
        console.error("Portal Error:", e);
        return c.json({ error: e.message || "Portal Failed (No Subscription?)" }, 400);
    }
});

routes.post("/billing/webhook", async (c) => {
    try {
        const event = await c.req.json();
        await processStripeWebhook(event);
        return c.json({ received: true });
    } catch(e) { 
        console.error("Webhook Error:", e);
        return c.json({ error: "Webhook Error" }, 400); 
    }
});

// --- ENTERPRISE SETTINGS & INTEGRATIONS ---

// Integrations (Twilio, Slack, etc)
routes.get("/integrations/:provider", async (c) => {
    const tenantId = await getTenantId(c);
    const provider = c.req.param('provider');
    const config = await kv.get(`tenant:${tenantId}:config:${provider}`) || {};
    // Mask secrets for security
    if (config.authToken) config.authToken = "********";
    if (config.apiKey) config.apiKey = "********";
    return c.json(config);
});

routes.post("/integrations/:provider", async (c) => {
    const tenantId = await getTenantId(c);
    const provider = c.req.param('provider');
    const updates = await c.req.json();
    
    const existing = await kv.get(`tenant:${tenantId}:config:${provider}`) || {};
    
    // Handle masked secrets (don't overwrite with ****)
    if (updates.authToken === "********") delete updates.authToken;
    if (updates.apiKey === "********") delete updates.apiKey;
    
    const newConfig = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await kv.set(`tenant:${tenantId}:config:${provider}`, newConfig);
    
    await logActivity(tenantId, { 
        agent: "System", 
        action: `Updated integration: ${provider}`, 
        type: "info", 
        platform: "Admin" 
    });
    
    return c.json({ success: true });
});

// General Settings
routes.get("/settings/general", async (c) => {
    const tenantId = await getTenantId(c);
    const settings = await kv.get(`tenant:${tenantId}:settings`) || { 
        name: "My Workspace",
        timezone: "UTC",
        currency: "USD"
    };
    return c.json(settings);
});

routes.post("/settings/general", async (c) => {
    const tenantId = await getTenantId(c);
    const settings = await c.req.json();
    await kv.set(`tenant:${tenantId}:settings`, settings);
    return c.json({ success: true });
});

// Team Management (Simple KV based for MVP)
routes.get("/team", async (c) => {
    const tenantId = await getTenantId(c);
    const team = await kv.get(`tenant:${tenantId}:team`) || [];
    return c.json({ members: team });
});

routes.post("/team/invite", async (c) => {
    const tenantId = await getTenantId(c);
    const { email, role } = await c.req.json();
    
    const team = await kv.get(`tenant:${tenantId}:team`) || [];
    if (team.some((m: any) => m.email === email)) {
        return c.json({ error: "User already in team" }, 400);
    }
    
    const newMember = {
        email,
        role,
        status: 'pending',
        invitedAt: new Date().toISOString()
    };
    
    await kv.set(`tenant:${tenantId}:team`, [...team, newMember]);
    
    // In a real app, send email via Resend/SendGrid here
    
    return c.json({ success: true, member: newMember });
});

routes.delete("/team/:email", async (c) => {
    const tenantId = await getTenantId(c);
    const email = c.req.param('email');
    const team = await kv.get(`tenant:${tenantId}:team`) || [];
    
    const newTeam = team.filter((m: any) => m.email !== email);
    await kv.set(`tenant:${tenantId}:team`, newTeam);
    
    return c.json({ success: true });
});

// --- MOUNT ROUTES ---
// No Supabase Edge Functions, o caminho base já é removido automaticamente
// Então montamos as rotas diretamente no app principal
app.route("/", routes);

// Também montamos nos caminhos alternativos para garantir compatibilidade
app.route("/functions/v1/make-server-eeb342a4", routes);
app.route("/make-server-eeb342a4", routes);

// Handler para rotas não encontradas (DEVE SER O ÚLTIMO)
app.notFound((c) => {
    console.error("[EDGE FUNCTION] ⚠️ Rota não encontrada:");
    console.error("  - Path:", c.req.path);
    console.error("  - Method:", c.req.method);
    console.error("  - URL:", c.req.url);
    console.error("  - Headers:", Object.fromEntries(c.req.raw.headers.entries()));
    return c.json({ 
        error: "Route not found", 
        path: c.req.path,
        method: c.req.method,
        url: c.req.url,
        hint: "Verifique se a rota está registrada em routes e se o deploy foi concluído"
    }, 404);
});

// LOG CRÍTICO: Confirmar que o arquivo está sendo carregado
console.error("========================================");
console.error("[EDGE FUNCTION] Arquivo index.tsx carregado");
console.error("[EDGE FUNCTION] Timestamp:", new Date().toISOString());
console.error("[EDGE FUNCTION] Rotas montadas");
console.error("[EDGE FUNCTION] Rotas de decisions registradas:");
console.error("  - POST /agents/decisions/:id/approve");
console.error("  - POST /agents/decisions/:id/reject");
console.error("========================================");

Deno.serve(app.fetch);
