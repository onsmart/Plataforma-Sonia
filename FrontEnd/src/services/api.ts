import { projectId, publicAnonKey } from "../utils/supabase/info";
import { supabase } from "../utils/supabase/client";
import { toast } from "sonner";

// Apontando para o servidor na rede local
export const BASE_URL = import.meta.env.VITE_API_URL || 'http://192.168.15.31:3333';
// const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-eeb342a4`;

// Helper for authenticated requests
export async function getAuthHeaders(contentType: boolean = true) {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Verificar se token está expirado ou próximo de expirar
    if (session?.expires_at) {
        const expiresAt = session.expires_at * 1000; // Converter para ms
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;
        
        // Se expira em menos de 1 minuto, tentar refresh
        if (timeUntilExpiry < 60 * 1000) {
            console.log('[API] Token expirando em breve, tentando refresh...');
            try {
                const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
                
                if (refreshError || !newSession) {
                    // Refresh falhou, fazer logout e redirecionar
                    console.warn('[API] Falha ao renovar sessão, fazendo logout');
                    
                    // Mostrar mensagem amigável
                    toast.error('Sessão expirada', {
                        description: 'Acho que passou muito tempo, que tal fazer login novamente?',
                        duration: 5000,
                    });
                    
                    // Aguardar um pouco para o usuário ver a mensagem
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
                    await supabase.auth.signOut();
                    window.location.href = '/';
                    throw new Error('Sessão expirada. Faça login novamente.');
                }
                
                return {
                    'Authorization': `Bearer ${newSession.access_token}`,
                    ...(contentType ? { 'Content-Type': 'application/json' } : {})
                };
            } catch (error: any) {
                if (error.message?.includes('Sessão expirada')) {
                    throw error;
                }
                // Se for outro erro, continua com a sessão atual
            }
        }
    }
    
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${session?.access_token || ''}`
    };
    if (contentType) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
}

// Interceptador global para erros 401 (token expirado)
async function handleAuthError(error: any) {
    if (error?.response?.status === 401 || error?.code === 'TOKEN_EXPIRED' || error?.message?.includes('401')) {
        console.warn('[API] Token expirado ou inválido, fazendo logout...');
        
        // Mostrar mensagem amigável
        toast.error('Sessão expirada', {
            description: 'Acho que passou muito tempo, que tal fazer login novamente?',
            duration: 5000,
        });
        
        // Aguardar um pouco para o usuário ver a mensagem
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        await supabase.auth.signOut();
        
        // Limpar localStorage
        localStorage.clear();
        
        // Redirecionar para login
        window.location.href = '/';
        
        throw new Error('Sessão expirada. Faça login novamente.');
    }
    throw error;
}

// Helper for error handling
const handleFetchError = async (error: any, context: string) => {
    // Interceptar erros 401 (token expirado)
    if (error?.response?.status === 401 || error?.code === 'TOKEN_EXPIRED' || error?.message?.includes('401')) {
        return await handleAuthError(error);
    }
    
    // Suppress verbose network errors
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        // Quietly throw a user-friendly error without logging to console
        throw new Error("Connection failed: Please check your internet or try again later.");
    }
    console.error(`[${context}] Unexpected error:`, error);
    throw error;
};

// Helper para fazer fetch com interceptação de 401
async function authenticatedFetch(url: string, options: RequestInit = {}) {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(url, {
            ...options,
            headers: { ...headers, ...options.headers }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            
            // Interceptar 401
            if (response.status === 401) {
                await handleAuthError({ response: { status: 401 }, code: errorData.code });
            }
            
            throw new Error(errorData.error || `Erro ${response.status}`);
        }

        return response;
    } catch (error: any) {
        // Se já foi tratado pelo handleAuthError, re-lançar
        if (error.message?.includes('Sessão expirada')) {
            throw error;
        }
        throw error;
    }
}

export interface AgentModelConfig {
    provider: 'openai' | 'anthropic' | 'google' | 'groq';
    model: string;
    temperature: number;
    maxTokens: number;
    apiKey?: string;
}

export interface Agent {
    id: string;
    name: string;
    role: string;
    description: string;
    status: 'active' | 'paused' | 'error';
    status_id?: number | null; // ID do status: 1=verde (conectado), 2=vermelho (cancelado), 3=amarelo (pausado)
    channels: string[];
    languages: string[];
    avatar: string;
    personalityPrompt?: string; // Comportamento/Personalidade
    templateRole?: string; // Conteúdo técnico vindo do template
    role_template_id?: string;
    systemPrompt?: string; // TODO: Migrar para personalityPrompt
    // Updated to match Backend Schema
    modelConfig?: Partial<AgentModelConfig>;
    metrics: {
        conversations: number;
        csat: string;
        avgResponseTime: string;
    };
    user_id?: number;
}

export interface GovernanceConfig {
    safetyThresholds: {
        hateSpeech: number;
        sexualContent: number;
        dangerousContent: number;
    };
    filters: {
        competitorBlocking: boolean;
        antiHallucination: boolean;
        jailbreakProtection: boolean;
    };
    dlp: {
        creditCard: boolean;
        ssn: boolean;
        email: boolean;
        phone: boolean;
    };
    retention?: {
        chatLogsRetentionDays: number;
        voiceRetentionDays: number;
    };
    lastUpdated?: string;
}

export interface DashboardStats {
    totalInteractions: number;
    activeLeads: number;
    avgResponseTime: number;
    meetingsBooked: number;
    activeAgents: number;
    lastUpdated: string;
}

export interface ActivityLog {
    agent: string;
    action: string;
    time: string;
    type: 'success' | 'info' | 'warning' | 'system';
    platform: string;
}

export interface Notification {
    id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    timestamp: string;
    timeAgo?: string;
    read: boolean;
    link?: string;
}

export interface DashboardData {
    stats: DashboardStats;
    activityFeed: ActivityLog[];
    agents?: Array<{
        id: string;
        nome: string;
        status_id: number | null; // ID do status na tabela de status (smallint)
    }>;
}

export interface InsightsData {
    overview: { name: string; date: string; conversations: number; cost: number }[];
    channels: { name: string; value: number }[];
    summary: {
        total_interactions: number;
        total_cost: number;
        active_channels: number;
        total_tokens: number;
        rag_usage_count: number;
        rag_usage_rate: number;
    };
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    meta?: any;
}

export interface KnowledgeFile {
    id: string;
    name: string;
    size: string;
    type: string;
    namespace: string;
    status: 'indexing' | 'active' | 'error';
    uploadedAt: string;
    vectorsIndexed?: number;
}

export interface Conversation {
    id: string;
    userId: string; // Identifier for the end-user (phone or session id)
    userName?: string;
    platform: 'whatsapp' | 'webchat' | 'voice';
    status: 'active' | 'human_takeover' | 'closed';
    lastMessage: string;
    lastMessageAt?: string; // Optional in frontend, filled by backend
    updatedAt?: string;
    unreadCount: number;
    agentId?: string; // The AI agent assigned
}

export interface CurrentWhatsAppIntegration {
    id: string;
    phone_number: string | null;
    app_key: string | null;
    access_token?: string | null;
    auth_token?: string | null;
    provider?: string | null;
    created_at?: string | null;
    linked_agent_id?: string | null;
    linked_agent_name?: string | null;
    linked_agent_status_id?: number | string | null;
}

export interface WhatsAppConversationSummary {
    whatsapp_contact_id: string;
    phone_number: string | null;
    lid: string | null;
    contact_label: string;
    last_message_id: string;
    last_message: string;
    last_message_direction: 'inbound' | 'outbound';
    last_message_at: string;
    unread_count: number;
    agent_id: string | null;
    agent_name: string | null;
    agent_status_id: number | string | null;
}

export interface WhatsAppConversationMessage {
    id?: string;
    whatsapp_contact_id: string;
    message: string;
    message_id?: string;
    direction: 'inbound' | 'outbound';
    integrations_id: string;
    agent_id?: string | null;
    is_read?: boolean;
    created_at?: string;
    metadata?: Record<string, any> | null;
}

export interface Device {
    id: string;
    name: string;
    type: 'sensor' | 'camera' | 'display' | 'lock' | 'thermostat';
    location: string;
    status: 'online' | 'offline' | 'error';
    lastHeartbeat: string;
    capabilities: string[]; // e.g. ['motion_detected', 'temperature', 'video_stream']
}

export interface JobResult {
    id: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    type: string;
    result?: any;
    error?: string;
    createdAt: string;
    completedAt?: string;
}

export const AgentService = {
    // --- ASYNC JOB QUEUE ---
    async getJobStatus(jobId: string): Promise<JobResult> {
        try {
            const res = await fetch(`${BASE_URL}/jobs/${jobId}`, {
                headers: await getAuthHeaders()
            });
            return await res.json();
        } catch (error: any) {
            return handleFetchError(error, 'GetJob');
        }
    },

    async triggerJobProcess(jobId: string): Promise<JobResult> {
        try {
            const res = await fetch(`${BASE_URL}/jobs/${jobId}/process`, {
                method: 'POST',
                headers: await getAuthHeaders()
            });
            return await res.json();
        } catch (error: any) {
            return handleFetchError(error, 'TriggerJob');
        }
    },

    // --- IOT DEVICES ---
    async listDevices(): Promise<Device[]> {
        try {
            const res = await fetch(`${BASE_URL}/devices`, { headers: await getAuthHeaders() });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            return data.devices || [];
        } catch (error) {
            if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                // Quietly fail
                return [];
            }
            return [];
        }
    },

    async createDevice(device: Partial<Device>): Promise<Device> {
        try {
            const res = await fetch(`${BASE_URL}/devices`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify(device)
            });
            const data = await res.json();
            return data.device;
        } catch (error: any) {
            return handleFetchError(error, 'CreateDevice');
        }
    },

    async triggerDeviceAction(deviceId: string, action: string, params: any): Promise<any> {
        try {
            const res = await fetch(`${BASE_URL}/devices/${deviceId}/action`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ action, params })
            });
            return await res.json();
        } catch (error: any) {
            return handleFetchError(error, 'DeviceAction');
        }
    },

    async listAgents(userId?: number): Promise<Agent[]> {
        try {
            const url = userId
                ? `${BASE_URL}/agents?user_id=${userId}`
                : `${BASE_URL}/agents`;
            const res = await fetch(url, {
                headers: await getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch agents');
            const data = await res.json();
            return data.agents || [];
        } catch (error) {
            // Use local error handling for lists to return empty arrays instead of throwing
            if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                // Quietly fail
                return [];
            }
            console.error("API Error:", error);
            return [];
        }
    },

    async createAgent(agent: Partial<Agent>): Promise<Agent> {
        try {
            const res = await fetch(`${BASE_URL}/agents`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify(agent)
            });

            if (!res.ok) {
                const err = await res.json();
                const msg = typeof err.error === 'string'
                    ? err.error
                    : (JSON.stringify(err.error) || 'Failed to create agent');
                throw new Error(msg);
            }

            const data = await res.json();
            return data.agent;
        } catch (error: any) {
            return handleFetchError(error, 'CreateAgent');
        }
    },

    async activateAgent(id: string, email?: string): Promise<Agent> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const userEmail = email || user?.email;

            if (!userEmail) {
                throw new Error('Email é obrigatório para ativar agente');
            }

            const res = await fetch(`${BASE_URL}/agents/${id}/activate`, {
                method: 'PUT',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ email: userEmail })
            });

            if (!res.ok) {
                const err = await res.json();
                const msg = err.error || err.reason || 'Erro ao ativar agente';
                throw new Error(msg);
            }

            const data = await res.json();
            return data.agent;
        } catch (error: any) {
            handleFetchError(error, 'ActivateAgent');
            throw error;
        }
    },

    async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent> {
        try {
            const res = await fetch(`${BASE_URL}/agents/${id}`, {
                method: 'PUT',
                headers: await getAuthHeaders(),
                body: JSON.stringify(updates)
            });

            if (!res.ok) {
                const err = await res.json();
                const msg = typeof err.error === 'string'
                    ? err.error
                    : (JSON.stringify(err.error) || 'Failed to update agent');
                throw new Error(msg);
            }

            const data = await res.json();
            return data.agent;
        } catch (error: any) {
            return handleFetchError(error, 'UpdateAgent');
        }
    },

    async deleteAgent(id: string): Promise<void> {
        try {
            const res = await fetch(`${BASE_URL}/agents/${id}`, {
                method: 'DELETE',
                headers: await getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to delete agent');
        } catch (error: any) {
            return handleFetchError(error, 'DeleteAgent');
        }
    },

    async getDashboardStats(): Promise<DashboardData | null> {
        try {
            console.log("========================================");
            console.log("[FRONTEND] Chamando API Dashboard");
            console.log("[FRONTEND] URL:", `${BASE_URL}/dashboard`);
            console.log("[FRONTEND] Timestamp:", new Date().toISOString());
            console.log("========================================");

            const headers = await getAuthHeaders();
            console.log("[FRONTEND] Headers:", {
                hasAuth: !!headers.Authorization,
                authLength: headers.Authorization?.length || 0
            });

            const res = await fetch(`${BASE_URL}/dashboard`, {
                headers: headers
            });

            console.log("[FRONTEND] Response status:", res.status);
            console.log("[FRONTEND] Response ok:", res.ok);

            if (!res.ok) {
                console.error("Dashboard API Error: Status", res.status);
                const errorText = await res.text();
                console.error("Dashboard API Error: Response body", errorText);
                throw new Error(`Status: ${res.status}`);
            }

            const data = await res.json();
            console.log("Dashboard API: Resposta recebida:", {
                hasStats: !!data.stats,
                hasActivityFeed: !!data.activityFeed,
                hasAgents: !!data.agents,
                agentsCount: data.agents?.length || 0
            });
            console.log("Dashboard API: data.agents completo:", data.agents);
            console.log("Dashboard API: data.agents é array?", Array.isArray(data.agents));
            console.log("Dashboard API: data completo:", JSON.stringify(data, null, 2));

            // Garantir que agents sempre seja um array
            const responseData: DashboardData = {
                ...data,
                agents: Array.isArray(data.agents) ? data.agents : (data.agents ? [data.agents] : [])
            };

            console.log("Dashboard API: responseData.agents:", responseData.agents);
            console.log("Dashboard API: responseData.agents.length:", responseData.agents?.length || 0);

            return responseData;
        } catch (error) {
            console.error("Dashboard API Error:", error);
            return {
                stats: {
                    totalInteractions: 0,
                    activeLeads: 0,
                    avgResponseTime: 0,
                    meetingsBooked: 0,
                    activeAgents: 0,
                    lastUpdated: new Date().toISOString()
                },
                activityFeed: [],
                agents: [] // Adicionar agents vazio no retorno de erro
            };
        }
    },

    async getInsights(period: string = '7d'): Promise<InsightsData> {
        try {
            console.log("[API] Buscando insights com período:", period);
            const res = await fetch(`${BASE_URL}/insights?period=${period}`, {
                headers: await getAuthHeaders()
            });
            console.log("[API] Response status:", res.status, res.ok);
            if (!res.ok) {
                const errorText = await res.text();
                console.error("[API] Erro na resposta:", errorText);
                throw new Error(`Failed to fetch insights: ${res.status}`);
            }
            const data = await res.json();
            console.log("[API] Dados recebidos do backend:", {
                hasOverview: !!data.overview,
                overviewLength: data.overview?.length || 0,
                hasChannels: !!data.channels,
                channelsLength: data.channels?.length || 0,
                hasSummary: !!data.summary,
                summary: data.summary,
                fullData: data
            });

            const result = {
                overview: (data.overview && Array.isArray(data.overview)) ? data.overview : [],
                channels: (data.channels && Array.isArray(data.channels)) ? data.channels : [],
                summary: data.summary || {
                    total_interactions: 0,
                    total_cost: 0,
                    active_channels: 0,
                    total_tokens: 0,
                    rag_usage_count: 0,
                    rag_usage_rate: 0
                }
            };

            console.log("[API] Dados processados para retorno:", result);
            return result;
        } catch (error: any) {
            console.error("[API] Erro ao buscar insights:", error);
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                // Quietly fail
                return {
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
                };
            }
            throw error;
        }
    },

    async triggerSimulation(): Promise<DashboardData | null> {
        try {
            const res = await fetch(`${BASE_URL}/simulation/trigger`, {
                method: 'POST',
                headers: await getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to trigger simulation');
            return await res.json();
        } catch (error) {
            console.error("Simulation Error:", error);
            // If network error, return null quietly
            return null;
        }
    },

    // --- INBOX & HANDOFF ---

    async listConversations(): Promise<Conversation[]> {
        try {
            const res = await fetch(`${BASE_URL}/inbox/conversations`, {
                headers: await getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch conversations');
            const data = await res.json();
            return data.conversations || [];
        } catch (error) {
            if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                // Quietly fail
                return [];
            }
            console.error("Inbox Error:", error);
            return [];
        }
    },

    async getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
        try {
            const res = await fetch(`${BASE_URL}/inbox/conversations/${conversationId}/messages`, {
                headers: await getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch messages');
            const data = await res.json();
            return data.messages || [];
        } catch (error) {
            if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                // Quietly fail
                return [];
            }
            return [];
        }
    },

    async toggleHandoff(conversationId: string, status: 'active' | 'human_takeover'): Promise<void> {
        try {
            await fetch(`${BASE_URL}/inbox/conversations/${conversationId}/status`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ status })
            });
        } catch (error: any) {
            handleFetchError(error, 'ToggleHandoff');
        }
    },

    async sendHumanMessage(conversationId: string, content: string): Promise<ChatMessage> {
        try {
            const res = await fetch(`${BASE_URL}/inbox/conversations/${conversationId}/reply`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ content })
            });
            if (!res.ok) throw new Error('Failed to send message');
            const data = await res.json();
            return data.message;
        } catch (error: any) {
            return handleFetchError(error, 'SendMessage');
        }
    },

    // --- OUTBOUND CAMPAIGNS ---
    async sendOutboundMessage(to: string, channel: 'whatsapp' | 'sms' | 'email', content: string, agentId?: string): Promise<{ success: boolean; sessionId?: string }> {
        try {
            const res = await fetch(`${BASE_URL}/outbound/message`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ to, channel, content, agentId })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to send outbound message');
            }
            return await res.json();
        } catch (error: any) {
            return handleFetchError(error, 'OutboundMessage');
        }
    },

    // --- COPILOT ---
    async chatWithCopilot(messages: ChatMessage[], context: any): Promise<ChatMessage> {
        // We use a special reserved ID for the system copilot
        return this.chatWithAgent('system-copilot', messages, context);
    },

    // Updated Chat method with Better Error Handling
    async chatWithAgent(
        agentId: string,
        messages: ChatMessage[],
        context?: { channel?: string, sessionId?: string }
    ): Promise<ChatMessage> {
        try {
            const res = await fetch(`${BASE_URL}/chat`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ agentId, messages, context })
            });

            if (!res.ok) {
                let errorMsg = 'Failed to chat';
                try {
                    const errData = await res.json();
                    if (errData.error) {
                        errorMsg = typeof errData.error === 'string'
                            ? errData.error
                            : JSON.stringify(errData.error);
                    }
                } catch (e) {
                    // Ignore json parse error
                }
                throw new Error(errorMsg);
            }

            return await res.json();
        } catch (error: any) {
            return handleFetchError(error, 'ChatService');
        }
    },

    // Knowledge Base
    async listFiles(): Promise<KnowledgeFile[]> {
        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                throw new Error('Usuário não autenticado');
            }

            const { data, error } = await supabase.rpc('sp_list_files_by_email', {
                p_email: user.email
            });

            if (error) throw error;

            // Converter para formato KnowledgeFile
            return (data || []).map((file: any) => ({
                id: file.id,
                name: file.original_name,
                size: file.size_bytes ? `${(file.size_bytes / 1024).toFixed(1)} KB` : '0 KB',
                type: file.mime_type || 'text/plain',
                status: file.is_deleted ? 'deleted' : 'active',
                namespace: 'global', // TODO: implementar namespace se necessário
                uploadedAt: file.created_at,
                vectorsIndexed: 0 // TODO: implementar contagem de vetores
            }));
        } catch (error) {
            if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                // Quietly fail
                return [];
            }
            console.error("KB API Error:", error);
            return [];
        }
    },

    async uploadFile(file: File, namespace: string = 'global', purpose: 'rag' | 'skills' = 'rag'): Promise<KnowledgeFile> {
        const fileType = file.type || 'text/plain';

        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                throw new Error('Usuário não autenticado');
            }

            // 1. Buscar companies_id
            const { data: userData } = await supabase
                .from('tb_users')
                .select('id')
                .eq('email', user.email)
                .maybeSingle();

            if (!userData?.id) {
                throw new Error('Usuário não encontrado');
            }

            const { data: companyData } = await supabase
                .from('tb_company_users')
                .select('companies_id')
                .eq('user_id', userData.id)
                .maybeSingle();

            if (!companyData?.companies_id) {
                throw new Error('Empresa não encontrada');
            }

            const companiesId = companyData.companies_id;

            // 1.5. Verificar se o plano permite RAG
            try {
                const planRes = await fetch(`${BASE_URL}/billing/subscription`, {
                    headers: await getAuthHeaders()
                });
                if (planRes.ok) {
                    const planData = await planRes.json();
                    const plan = planData.plan || 'starter';
                    if (plan === 'starter') {
                        throw new Error('A funcionalidade RAG Knowledge Base está disponível apenas no plano Pro ou superior. Faça upgrade do seu plano para acessar esta funcionalidade.');
                    }
                }
            } catch (planError: any) {
                // Se a mensagem já é sobre RAG, propaga
                if (planError.message?.includes('RAG') || planError.message?.includes('Knowledge Base')) {
                    throw planError;
                }
                // Se for erro de rede, continua (fail-safe)
                console.warn('[uploadFile] Erro ao verificar plano, continuando:', planError);
            }

            // 2. Gerar nome único do arquivo (timestamp + nome original)
            const timestamp = Date.now();
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const filePath = `${companiesId}/${timestamp}_${sanitizedName}`;

            // 3. Upload para Supabase Storage (bucket: sonia-kb)
            // ✅ Não passar contentType se for imagem (para contornar validação do bucket)
            const uploadOptions: any = {
                upsert: false
            };

            // Só passa contentType se não for imagem (para evitar erro de MIME type)
            if (!fileType.startsWith('image/')) {
                uploadOptions.contentType = fileType;
            }

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('sonia-kb')
                .upload(filePath, file, uploadOptions);

            if (uploadError) {
                throw new Error(`Erro ao fazer upload: ${uploadError.message}`);
            }

            // 4. Criar registro no banco
            const { data: fileId, error: dbError } = await supabase.rpc('sp_create_file', {
                p_email: user.email,
                p_bucket: 'sonia-kb',
                p_path: filePath,
                p_original_name: file.name,
                p_mime_type: fileType,
                p_size_bytes: file.size
            });

            if (dbError) {
                // Se falhar ao criar registro, tentar deletar o arquivo do storage
                await supabase.storage.from('sonia-kb').remove([filePath]);
                throw new Error(`Erro ao salvar registro: ${dbError.message}`);
            }

            // 5. Acionar processamento de vetores no backend (RAG)
            try {
                // Não bloqueamos o retorno da UI se demorar, mas iniciamos o processo
                // O backend deve lidar com isso de forma assíncrona idealmente, mas aqui chamamos
                // para garantir que ao menos inicie.
                console.log('[Upload] Iniciando processamento de vetores para:', fileId);
                console.log('[Upload] Tipo de arquivo:', fileType);
                console.log('[Upload] Nome do arquivo:', file.name);

                // Reaproveitando a lógica de getAuthHeaders para pegar o token correto
                const headers = await getAuthHeaders();
                headers['x-user-email'] = user.email; // Passar email explicitamente para contexto

                fetch(`${BASE_URL}/files/${fileId}/process`, {
                    method: 'POST',
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ purpose })
                }).then(async (res) => {
                    if (res.ok) {
                        const json = await res.json();
                        console.log('[Upload] ✅ Processamento concluído com sucesso:', json);
                        if (json.chunks && json.chunks > 0) {
                            console.log(`[Upload] ✅ ${json.chunks} chunks processados e indexados`);
                        }
                    } else {
                        const errorText = await res.text();
                        console.error('[Upload] ❌ Erro no processamento:', {
                            status: res.status,
                            statusText: res.statusText,
                            error: errorText
                        });
                        // Tentar parsear como JSON se possível
                        try {
                            const errorJson = JSON.parse(errorText);
                            console.error('[Upload] ❌ Detalhes do erro:', errorJson);
                        } catch {
                            // Não é JSON, apenas texto
                        }
                    }
                }).catch(err => {
                    console.error('[Upload] ❌ Erro ao chamar processamento:', {
                        message: err.message,
                        stack: err.stack,
                        name: err.name
                    });
                });

            } catch (processError: any) {
                console.error('[Upload] ❌ Erro ao iniciar processamento de vetores:', {
                    message: processError?.message,
                    stack: processError?.stack,
                    name: processError?.name
                });
                // Não falhamos o upload se o processamento falhar, apenas logamos
            }

            // 6. Retornar arquivo criado
            return {
                id: fileId,
                name: file.name,
                size: `${(file.size / 1024).toFixed(1)} KB`,
                type: fileType,
                status: 'active',
                namespace: namespace,
                uploadedAt: new Date().toISOString(),
                vectorsIndexed: 0
            };
        } catch (error: any) {
            return handleFetchError(error, 'UploadFile');
        }
    },

    async deleteFile(id: string): Promise<void> {
        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                throw new Error('Usuário não autenticado');
            }

            const { data, error } = await supabase.rpc('sp_delete_file', {
                p_email: user.email,
                p_file_id: id
            });

            if (error) throw error;

            // Se pode deletar fisicamente, deletar do storage também
            if (data?.can_delete_physically && data?.path && data?.bucket) {
                await supabase.storage
                    .from(data.bucket)
                    .remove([data.path]);
            }
        } catch (error: any) {
            return handleFetchError(error, 'DeleteFile');
        }
    },

    async getFileUsageStats(): Promise<any> {
        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                throw new Error('Usuário não autenticado');
            }

            const { data, error } = await supabase.rpc('sp_get_file_usage_stats_by_email', {
                p_email: user.email
            });

            if (error) throw error;
            return data || {};
        } catch (error: any) {
            console.error('[getFileUsageStats] Erro:', error);
            return {
                total_size_bytes: 0,
                total_files: 0,
                deleted_files: 0,
                storage_used_mb: 0,
                storage_limit_mb: 1024,
                storage_used_percent: 0
            };
        }
    },

    async updateFileConfig(fileId: string, isDeleted?: boolean): Promise<void> {
        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                throw new Error('Usuário não autenticado');
            }

            const { error } = await supabase.rpc('sp_update_file_config', {
                p_email: user.email,
                p_file_id: fileId,
                p_is_deleted: isDeleted
            });

            if (error) throw error;
        } catch (error: any) {
            return handleFetchError(error, 'UpdateFileConfig');
        }
    },

    async listDeletedFilesForCleanup(): Promise<any[]> {
        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                console.warn('[listDeletedFilesForCleanup] Usuário não autenticado');
                return [];
            }

            console.log('[listDeletedFilesForCleanup] Buscando arquivos deletados para:', user.email);
            const { data, error } = await supabase.rpc('sp_list_deleted_files_for_cleanup', {
                p_email: user.email
            });

            if (error) {
                console.error('[listDeletedFilesForCleanup] Erro na RPC:', error);
                throw error;
            }

            console.log('[listDeletedFilesForCleanup] Resultado:', data);
            return Array.isArray(data) ? data : [];
        } catch (error: any) {
            console.error('[listDeletedFilesForCleanup] Erro:', error);
            // Se for erro de permissão, retornar array vazio ao invés de lançar erro
            if (error?.message?.includes('administradores') || error?.code === 'P0001') {
                console.warn('[listDeletedFilesForCleanup] Usuário não é admin');
                return [];
            }
            return [];
        }
    },

    async permanentlyDeleteFiles(fileIds: string[]): Promise<any> {
        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                throw new Error('Usuário não autenticado');
            }

            const { data, error } = await supabase.rpc('sp_permanently_delete_files', {
                p_email: user.email,
                p_file_ids: fileIds
            });

            if (error) throw error;

            // Deletar arquivos do storage
            if (data?.files_to_delete_from_storage && data.files_to_delete_from_storage.length > 0) {
                const { error: storageError } = await supabase.storage
                    .from(data.bucket || 'sonia-kb')
                    .remove(data.files_to_delete_from_storage);

                if (storageError) {
                    console.error('[permanentlyDeleteFiles] Erro ao deletar do storage:', storageError);
                    // Não falha a operação, apenas loga o erro
                }
            }

            return data;
        } catch (error: any) {
            return handleFetchError(error, 'PermanentlyDeleteFiles');
        }
    },

    async checkUserIsAdmin(): Promise<boolean> {
        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                console.log('[checkUserIsAdmin] ❌ Email não encontrado');
                return false;
            }

            console.log('[checkUserIsAdmin] 🔍 Verificando admin para:', user.email);

            // Buscar user_id
            const { data: userData, error: userError } = await supabase
                .from('tb_users')
                .select('id')
                .eq('email', user.email)
                .maybeSingle();

            if (userError) {
                console.error('[checkUserIsAdmin] ❌ Erro ao buscar user_id:', userError);
                return false;
            }

            if (!userData?.id) {
                console.log('[checkUserIsAdmin] ❌ User não encontrado na tb_users');
                return false;
            }

            console.log('[checkUserIsAdmin] ✅ User_id encontrado:', userData.id);

            // 1️⃣ Verificar role na tb_company_users
            const { data: companyUserData, error: companyUserError } = await supabase
                .from('tb_company_users')
                .select('role, companies_id')
                .eq('user_id', userData.id)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (companyUserError) {
                console.error('[checkUserIsAdmin] ❌ Erro ao buscar role:', companyUserError);
                return false;
            }

            if (!companyUserData) {
                console.log('[checkUserIsAdmin] ❌ Nenhum registro em tb_company_users para user_id:', userData.id);
                return false;
            }

            const role = companyUserData.role;
            const companiesId = companyUserData.companies_id;
            console.log('[checkUserIsAdmin] 📋 Role encontrado:', role, 'companies_id:', companiesId);

            // Se for owner ou admin no role, já é admin
            if (role === 'owner' || role === 'admin') {
                console.log('[checkUserIsAdmin] ✅ É ADMIN (por role)');
                return true;
            }

            // 2️⃣ Verificar se tem permissão basic.admin
            // Primeiro buscar permission_id da permissão basic.admin
            const { data: adminPermission, error: adminPermError } = await supabase
                .from('tb_permissions')
                .select('id')
                .eq('key', 'basic.admin')
                .maybeSingle();

            if (adminPermError) {
                console.error('[checkUserIsAdmin] ❌ Erro ao buscar permissão basic.admin:', adminPermError);
            } else if (adminPermission?.id) {
                // Verificar se o usuário tem essa permissão
                const { data: userPermission, error: userPermError } = await supabase
                    .from('tb_user_permissions')
                    .select('id')
                    .eq('user_id', userData.id)
                    .eq('companies_id', companiesId)
                    .eq('permission_id', adminPermission.id)
                    .maybeSingle();

                if (userPermError) {
                    console.error('[checkUserIsAdmin] ❌ Erro ao verificar permissão do usuário:', userPermError);
                } else if (userPermission) {
                    console.log('[checkUserIsAdmin] ✅ É ADMIN (por permissão basic.admin)');
                    return true;
                }
            }

            console.log('[checkUserIsAdmin] ❌ NÃO É ADMIN');
            return false;
        } catch (error: any) {
            console.error('[checkUserIsAdmin] ❌ Erro inesperado:', error);
            return false;
        }
    },

    // Governance
    async getGovernanceConfig(): Promise<GovernanceConfig> {
        try {
            const response = await fetch(`${BASE_URL}/governance`, {
                method: 'GET',
                headers: await getAuthHeaders(),
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('[getGovernanceConfig] Erro:', error);
                // Retornar valores padrão em caso de erro
                return {
                    safetyThresholds: { hateSpeech: 0.7, sexualContent: 0.7, dangerousContent: 0.7 },
                    filters: { competitorBlocking: false, antiHallucination: false, jailbreakProtection: false },
                    dlp: { creditCard: false, ssn: false, email: false, phone: false },
                    retention: { chatLogsRetentionDays: 90, voiceRetentionDays: 30 }
                };
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('[getGovernanceConfig] Error:', error);
            // Retornar valores padrão em caso de erro
            return {
                safetyThresholds: { hateSpeech: 0.7, sexualContent: 0.7, dangerousContent: 0.7 },
                filters: { competitorBlocking: false, antiHallucination: false, jailbreakProtection: false },
                dlp: { creditCard: false, ssn: false, email: false, phone: false },
                retention: { chatLogsRetentionDays: 90, voiceRetentionDays: 30 }
            };
        }
    },

    async updateGovernanceConfig(config: GovernanceConfig): Promise<GovernanceConfig> {
        try {
            const response = await fetch(`${BASE_URL}/governance`, {
                method: 'PUT',
                headers: await getAuthHeaders(),
                body: JSON.stringify(config)
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('[updateGovernanceConfig] Erro:', error);
                throw new Error(error.error || error.details || 'Erro ao atualizar configuração de governança');
            }

            const data = await response.json();
            return data;
        } catch (error: any) {
            console.error('[updateGovernanceConfig] Erro:', error);
            throw error;
        }
    },

    // Team Management
    async getTeam(): Promise<any[]> {
        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                throw new Error('Usuário não autenticado');
            }

            const { data, error } = await supabase.rpc('sp_get_team_members_by_email', {
                p_email: user.email
            });

            if (error) throw error;

            // Agrupar por usuário (um usuário pode ter múltiplas permissões)
            const membersMap = new Map<string, any>();

            (data || []).forEach((row: any) => {
                const key = row.user_id;
                if (!membersMap.has(key)) {
                    membersMap.set(key, {
                        user_id: row.user_id,
                        name: row.name,
                        email: row.email,
                        permissions: [],
                        created_at: row.created_at,
                        granted_by: row.granted_by,
                        granted_by_name: row.granted_by_name
                    });
                }

                if (row.permission_key) {
                    membersMap.get(key)!.permissions.push({
                        key: row.permission_key,
                        name: row.permission_name,
                        category: row.permission_category
                    });
                }
            });

            return Array.from(membersMap.values());
        } catch (error: any) {
            console.error('[AgentService.getTeam] Erro:', error);
            return handleFetchError(error, 'GetTeam');
        }
    },

    async getAvailablePermissions(): Promise<any[]> {
        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data, error } = await supabase.rpc('sp_get_available_permissions');

            if (error) throw error;
            return data || [];
        } catch (error: any) {
            console.error('[AgentService.getAvailablePermissions] Erro:', error);
            return handleFetchError(error, 'GetAvailablePermissions');
        }
    },

    async inviteMember(email: string, permissionKey: string): Promise<any> {
        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                throw new Error('Usuário não autenticado');
            }

            const { data, error } = await supabase.rpc('sp_add_team_member_by_email', {
                p_admin_email: user.email,
                p_member_email: email,
                p_permission_key: permissionKey
            });

            if (error) throw error;
            return data;
        } catch (error: any) {
            console.error('[AgentService.inviteMember] Erro:', error);
            return handleFetchError(error, 'InviteMember');
        }
    },

    async updateMemberPermission(email: string, oldPermissionKey: string, newPermissionKey: string): Promise<any> {
        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                throw new Error('Usuário não autenticado');
            }

            const { data, error } = await supabase.rpc('sp_update_team_member_permission', {
                p_admin_email: user.email,
                p_member_email: email,
                p_old_permission_key: oldPermissionKey,
                p_new_permission_key: newPermissionKey
            });

            if (error) throw error;
            return data;
        } catch (error: any) {
            console.error('[AgentService.updateMemberPermission] Erro:', error);
            return handleFetchError(error, 'UpdateMemberPermission');
        }
    },

    async removeMember(email: string): Promise<void> {
        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                throw new Error('Usuário não autenticado');
            }

            const { error } = await supabase.rpc('sp_remove_team_member', {
                p_admin_email: user.email,
                p_member_email: email
            });

            if (error) throw error;
        } catch (error: any) {
            console.error('[AgentService.removeMember] Erro:', error);
            return handleFetchError(error, 'RemoveMember');
        }
    },

    async createCompany(companyName: string): Promise<any> {
        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                throw new Error('Usuário não autenticado');
            }

            const { data, error } = await supabase.rpc('sp_create_company_for_user', {
                p_user_email: user.email,
                p_company_name: companyName
            });

            if (error) throw error;
            return data;
        } catch (error: any) {
            console.error('[AgentService.createCompany] Erro:', error);
            return handleFetchError(error, 'CreateCompany');
        }
    },

    // General Settings
    async getGeneralSettings(): Promise<any> {
        try {
            const res = await fetch(`${BASE_URL}/settings/general`, {
                headers: await getAuthHeaders()
            });
            return await res.json();
        } catch (error) {
            if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                // Quietly fail
                return {};
            }
            return {};
        }
    },

    async updateGeneralSettings(settings: any): Promise<void> {
        try {
            await fetch(`${BASE_URL}/settings/general`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify(settings)
            });
        } catch (error: any) {
            handleFetchError(error, 'UpdateSettings');
        }
    },

    // API Keys Management
    async getApiKeys(): Promise<any> {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                return {};
            }

            const { data, error } = await supabase.rpc('sp_get_api_keys_by_email', {
                p_email: user.email
            });

            if (error) {
                console.error('[getApiKeys] RPC error:', error);
                return {};
            }

            // Transforma o array de API keys em objeto { openai: "...", anthropic: "..." }
            if (Array.isArray(data)) {
                const keys: any = {};
                data.forEach((item: any) => {
                    if (item.provider === 'openai') {
                        keys.openai = item.api_key;
                    } else if (item.provider === 'anthropic') {
                        keys.anthropic = item.api_key;
                    }
                });
                return keys;
            }

            return {};
        } catch (error) {
            console.error('[getApiKeys] Error:', error);
            return {};
        }
    },

    async updateApiKeys(keys: any): Promise<void> {
        try {
            await fetch(`${BASE_URL}/settings/apikeys`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify(keys)
            });
        } catch (error: any) {
            handleFetchError(error, 'UpdateApiKeys');
        }
    },

    // --- BILLING (STRIPE) ---
    async getSubscription(): Promise<any> {
        try {
            const res = await fetch(`${BASE_URL}/billing/subscription`, {
                headers: await getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            // Ensure we don't return null
            return data || { plan: 'free', status: 'inactive' };
        } catch (error) {
            if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                // Quietly fail
                return { plan: 'free', status: 'inactive' };
            }
            return { plan: 'free', status: 'inactive' };
        }
    },

    async getSubscriptionUsage(): Promise<any> {
        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                throw new Error('Usuário não autenticado');
            }

            const { data, error } = await supabase.rpc('sp_get_subscription_usage_by_email', {
                p_email: user.email
            });

            console.log('[getSubscriptionUsage] Resultado da função:', { data, error, email: user.email });

            if (error) {
                console.error('[getSubscriptionUsage] Erro na RPC:', error);
                throw error;
            }
            
            // Retorna o primeiro registro (a função retorna uma tabela)
            const result = Array.isArray(data) && data.length > 0 ? data[0] : null;
            
            console.log('[getSubscriptionUsage] Resultado processado:', result);
            
            return result || {
                messages_used: 0,
                messages_limit: 50,
                agents_used: 0,
                agents_limit: 1,
                plan_name: 'starter'
            };
        } catch (error: any) {
            console.error('[getSubscriptionUsage] Erro:', error);
            return {
                messages_used: 0,
                messages_limit: 50,
                agents_used: 0,
                agents_limit: 1,
                plan_name: 'starter'
            };
        }
    },

    async createCheckoutSession(priceId: string): Promise<{ url: string }> {
        try {
            // Obter email do usuário autenticado
            const { data: { user } } = await supabase.auth.getUser()
            const email = user?.email

            const res = await fetch(`${BASE_URL}/billing/checkout`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ 
                    priceId,
                    email: email || undefined // Envia email se disponível
                })
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to create checkout session')
            }
            return await res.json();
        } catch (error: any) {
            return handleFetchError(error, 'CheckoutSession');
        }
    },

    async exportBillingCSV(startDate?: string, endDate?: string): Promise<void> {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const email = user?.email

            if (!email) {
                throw new Error('Usuário não autenticado')
            }

            // Construir URL com query params
            const params = new URLSearchParams()
            params.append('email', email)
            if (startDate) params.append('startDate', startDate)
            if (endDate) params.append('endDate', endDate)

            const res = await fetch(`${BASE_URL}/billing/export?${params.toString()}`, {
                method: 'GET',
                headers: await getAuthHeaders()
            })

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}))
                throw new Error(errorData.error || 'Erro ao exportar dados')
            }

            // Obter o blob do CSV
            const blob = await res.blob()
            
            // Criar link temporário para download
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            
            // Obter nome do arquivo do header Content-Disposition ou usar padrão
            const contentDisposition = res.headers.get('Content-Disposition')
            let filename = 'billing-export.csv'
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/)
                if (filenameMatch) {
                    filename = filenameMatch[1]
                }
            }
            
            link.download = filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
        } catch (error: any) {
            return handleFetchError(error, 'ExportBillingCSV')
        }
    },

    async createPortalSession(): Promise<{ url?: string, error?: string }> {
        try {
            // Obter email do usuário autenticado
            const { data: { user } } = await supabase.auth.getUser()
            const email = user?.email

            const res = await fetch(`${BASE_URL}/billing/portal`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ 
                    email: email || undefined
                })
            });
            // Return error details if failed
            if (!res.ok) {
                const err = await res.json();
                return { error: err.error || "Failed to create portal session" };
            }
            return await res.json();
        } catch (error: any) {
            // handleFetchError throws, but this method returns object with error
            // Quietly fail
            return { error: "Connection failed. Please check internet." };
        }
    },

    // Integrations
    async getIntegrationConfig(provider: 'twilio'): Promise<any> {
        try {
            const res = await fetch(`${BASE_URL}/integrations/${provider}`, {
                headers: await getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch integration config');
            return await res.json();
        } catch (error) {
            if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                // Quietly fail
                return {};
            }
            return {};
        }
    },

    async saveIntegrationConfig(provider: 'twilio', config: any): Promise<void> {
        try {
            const res = await fetch(`${BASE_URL}/integrations/${provider}`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify(config)
            });
            if (!res.ok) throw new Error('Failed to save integration config');
        } catch (error: any) {
            handleFetchError(error, 'SaveIntegration');
        }
    },

    // --- NOTIFICATIONS ---
    async getNotifications(): Promise<Notification[]> {
        try {
            const res = await fetch(`${BASE_URL}/notifications`, {
                headers: await getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            return data.notifications || [];
        } catch (error) {
            if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                // Quietly fail
                return [];
            }
            return [];
        }
    },

    async markNotificationRead(id: string): Promise<void> {
        try {
            await fetch(`${BASE_URL}/notifications/mark-read`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ id })
            });
        } catch (error: any) {
            handleFetchError(error, 'MarkRead');
        }
    },

    async triggerTestNotification(type: string): Promise<void> {
        try {
            await fetch(`${BASE_URL}/notifications/test`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ type })
            });
        } catch (error: any) {
            handleFetchError(error, 'TestNotification');
        }
    }
};

export const WhatsAppService = {
    async getCurrentIntegration(): Promise<CurrentWhatsAppIntegration | null> {
        try {
            const res = await authenticatedFetch(`${BASE_URL}/whatsapp/integration/current`, {
                method: 'GET'
            });
            const data = await res.json();
            return data.integration || null;
        } catch (error) {
            if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                return null;
            }
            console.error('[WhatsAppService] Erro ao buscar integração atual:', error);
            return null;
        }
    },

    async listCurrentConversations(): Promise<{ integration: CurrentWhatsAppIntegration | null; conversations: WhatsAppConversationSummary[] }> {
        try {
            const res = await authenticatedFetch(`${BASE_URL}/whatsapp/conversations/current`, {
                method: 'GET'
            });
            const data = await res.json();
            return {
                integration: data.integration || null,
                conversations: Array.isArray(data.conversations) ? data.conversations : []
            };
        } catch (error) {
            if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                return { integration: null, conversations: [] };
            }
            console.error('[WhatsAppService] Erro ao listar conversas atuais:', error);
            return { integration: null, conversations: [] };
        }
    },

    async getCurrentConversationMessages(contactId: string, limit: number = 100): Promise<WhatsAppConversationMessage[]> {
        try {
            const res = await authenticatedFetch(`${BASE_URL}/whatsapp/conversations/current/${encodeURIComponent(contactId)}/messages?limit=${encodeURIComponent(String(limit))}`, {
                method: 'GET'
            });
            const data = await res.json();
            return Array.isArray(data.messages) ? data.messages : [];
        } catch (error) {
            if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                return [];
            }
            console.error('[WhatsAppService] Erro ao buscar mensagens da conversa:', error);
            return [];
        }
    }
};

// --- KPIs ---
export interface KPIMetrics {
    taskSuccessRate: number;
    averageResponseTime: number;
    taskAbandonmentRate: number;
    costPerInteraction: number;
    totalCost: number;
    violationsCount: number;
    hallucinationsFlagged: number;
    humanTransferRate: number;
    quickReworkRate: number;
    csatScore: number;
    npsScore: number;
    averageSentiment: number;
    incorrectRoutingFrequency: number;
}

export interface KPIFilters {
    agentId?: string;
    startDate?: string;
    endDate?: string;
    channel?: string;
}

export const KPIService = {
    async getKPIs(filters?: KPIFilters): Promise<KPIMetrics> {
        try {
            // Buscar email do usuário logado
            const { data: { session } } = await supabase.auth.getSession();
            const userEmail = session?.user?.email;
            
            if (!userEmail) {
                throw new Error('Usuário não autenticado');
            }

            const params = new URLSearchParams();
            params.append('email', userEmail); // Adiciona email na query string
            if (filters?.agentId) params.append('agentId', filters.agentId);
            if (filters?.startDate) params.append('startDate', filters.startDate);
            if (filters?.endDate) params.append('endDate', filters.endDate);
            if (filters?.channel) params.append('channel', filters.channel);

            const headers = await getAuthHeaders();
            headers['x-user-email'] = userEmail; // Também envia no header

            const res = await fetch(`${BASE_URL}/kpis?${params.toString()}`, {
                headers
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                console.error('[KPIService] Erro na resposta:', errorData);
                throw new Error(errorData.error || 'Failed to fetch KPIs');
            }
            const response = await res.json();
            console.log('[KPIService] Resposta completa:', response);
            
            // A resposta vem como { success: true, data: kpis }
            // Se response.data existe e é um objeto com os campos de KPIMetrics, retorna direto
            if (response.data && typeof response.data === 'object' && 'taskSuccessRate' in response.data) {
                console.log('[KPIService] ✅ KPIs extraídos de response.data:', response.data);
                return response.data;
            }
            
            // Fallback: se response já tem os campos, retorna direto
            if (typeof response === 'object' && 'taskSuccessRate' in response) {
                console.log('[KPIService] ✅ KPIs extraídos de response direto:', response);
                return response;
            }
            
            console.warn('[KPIService] ⚠️ Formato de resposta inesperado:', response);
            // Retorna objeto vazio se formato não for reconhecido
            return {
                taskSuccessRate: 0,
                averageResponseTime: 0,
                taskAbandonmentRate: 0,
                costPerInteraction: 0,
                totalCost: 0,
                violationsCount: 0,
                hallucinationsFlagged: 0,
                humanTransferRate: 0,
                quickReworkRate: 0,
                csatScore: 0,
                npsScore: 0,
                averageSentiment: 0,
                incorrectRoutingFrequency: 0
            } as KPIMetrics;
        } catch (error: any) {
            handleFetchError(error, 'GetKPIs');
            throw error;
        }
    },

    async saveFeedback(feedback: {
        agentId?: string;
        conversationId?: string;
        channel?: string;
        csatScore?: number;
        npsScore?: number;
        sentimentScore?: number;
        feedbackText?: string;
        metadata?: Record<string, any>;
    }): Promise<{ success: boolean; id?: string }> {
        try {
            // Buscar email do usuário logado
            const { data: { session } } = await supabase.auth.getSession();
            const userEmail = session?.user?.email;
            
            if (!userEmail) {
                throw new Error('Usuário não autenticado');
            }

            const headers = await getAuthHeaders();
            headers['x-user-email'] = userEmail;

            const res = await fetch(`${BASE_URL}/kpis/feedback`, {
                method: 'POST',
                headers,
                body: JSON.stringify(feedback)
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to save feedback');
            }
            const data = await res.json();
            return data;
        } catch (error: any) {
            handleFetchError(error, 'SaveFeedback');
            throw error;
        }
    }
};
