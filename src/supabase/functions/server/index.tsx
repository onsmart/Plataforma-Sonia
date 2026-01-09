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

// DASHBOARD
routes.get("/dashboard", async (c) => {
    try {
        const tenantId = await getTenantId(c);
        
        const [agents, notifications] = await Promise.all([
            AgentRepo.list(tenantId),
            NotificationRepo.list(tenantId)
        ]);

        let stats = { interactions: 0, leads: 0, meetings: 0, lastUpdated: new Date().toISOString() };
        try {
            const raw = await kv.get(`tenant:${tenantId}:real_stats`);
            if (raw) stats = raw;
        } catch (e) {}

        let feed = [];
        try {
            const raw = await kv.get(`tenant:${tenantId}:activity_feed`);
            if (Array.isArray(raw)) feed = raw;
        } catch (e) {}

        return c.json({
            stats: {
                totalInteractions: stats.interactions || 0,
                activeLeads: stats.leads || 0,
                avgResponseTime: 1.2,
                meetingsBooked: stats.meetings || 0,
                activeAgents: agents.length,
                lastUpdated: stats.lastUpdated
            },
            activityFeed: feed
        });
    } catch (err) {
        console.error("Dashboard Fatal Error:", err);
        return c.json({ error: "Failed to load dashboard" }, 500);
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
    
    const aiRes = await callLLM(
        provider,
        model,
        messages,
        systemPrompt,
        tenantId
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
// Mount on both potential base paths to ensure connectivity
app.route("/functions/v1/make-server-eeb342a4", routes);
app.route("/make-server-eeb342a4", routes);

Deno.serve(app.fetch);