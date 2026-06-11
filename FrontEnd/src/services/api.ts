import { projectId, publicAnonKey } from "../utils/supabase/info";
import { supabase } from "../utils/supabase/client";
import { toast } from "sonner";

function resolveDefaultApiUrl() {
    if (typeof window === 'undefined') {
        return 'http://192.168.15.31:3333';
    }

    const { protocol, hostname } = window.location;
    const normalizedHostname = hostname || 'localhost';

    // Em desenvolvimento o frontend costuma rodar em localhost:3000,
    // mas o backend principal desta instalacao fica no servidor da rede local.
    if (normalizedHostname === 'localhost' || normalizedHostname === '127.0.0.1') {
        return 'http://192.168.15.31:3333';
    }

    return `${protocol}//${normalizedHostname}:3333`;
}

// Usa VITE_API_URL quando definido; caso contrário, reaproveita o host atual na porta 3333.
export const BASE_URL = import.meta.env.VITE_API_URL || resolveDefaultApiUrl();

/** URL pública HTTPS para webhooks (Calendly, etc.) — nunca IP local. */
const PLATFORM_PUBLIC_WEBHOOK_DEFAULT = 'https://webhook.onsmart.ai';

export function resolveCalendlyWebhookBaseUrl(fallbackFromApi?: string | null): string {
    const fromEnv = String(import.meta.env.VITE_BACKEND_PUBLIC_URL || '').trim().replace(/\/+$/, '');
    if (fromEnv) return fromEnv;

    const fromApi = String(fallbackFromApi || '').trim().replace(/\/+$/, '');
    if (fromApi && fromApi.startsWith('https://')) return fromApi;

    return PLATFORM_PUBLIC_WEBHOOK_DEFAULT;
}
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
async function handleAuthError(error: any): Promise<never> {
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
const handleFetchError = async (error: any, context: string): Promise<never> => {
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

/** Resolve companies_id pelo email (case-insensitive), alinhado às RPCs sp_* do Supabase. */
async function resolveCompaniesIdByEmail(email: string): Promise<string | null> {
    const trimmed = email.trim();
    if (!trimmed) return null;

    const { data: fromAnalytics, error: analyticsError } = await supabase.rpc(
        'sp_get_analytics_company_id_by_email',
        { p_email: trimmed }
    );
    if (!analyticsError && fromAnalytics) {
        return String(fromAnalytics);
    }

    try {
        const { data: loginData, error: loginError } = await supabase.rpc('sp_login_user', {
            p_email: trimmed,
        });
        if (loginError) return null;

        const userData = Array.isArray(loginData) ? loginData[0] : loginData;
        const userId = userData?.user_id != null ? String(userData.user_id) : null;
        if (!userId) return null;

        const { data: companyRow } = await supabase
            .from('tb_company_users')
            .select('companies_id')
            .eq('user_id', userId)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

        return companyRow?.companies_id ?? null;
    } catch {
        return null;
    }
}

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            resolve(base64);
        };
        reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler arquivo'));
        reader.readAsDataURL(file);
    });
}

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
    extra_features?: string | null;
    status: 'active' | 'paused' | 'error';
    status_id?: number | null; // ID do status: 1=verde (conectado), 2=vermelho (cancelado), 3=amarelo (pausado)
    channels: string[];
    languages: string[];
    primary_language?: string | null;
    avatar: string;
    personalityPrompt?: string; // Comportamento/Personalidade
    templateRole?: string; // Conteúdo técnico vindo do template
    role_template_id?: string;
    integrations_id?: string | null;
    systemPrompt?: string; // TODO: Migrar para personalityPrompt
    // Updated to match Backend Schema
    modelConfig?: Partial<AgentModelConfig>;
    metrics?: {
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
    agents: { agent_name: string; avg_confidence: number }[];
    summary: {
        total_interactions: number;
        total_cost: number;
        active_channels: number;
        total_tokens: number;
        rag_usage_count: number;
        rag_usage_rate: number;
    };
    issues?: string[];
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
    purpose: 'rag' | 'skills';
    status: 'indexing' | 'active' | 'deleted' | 'error';
    uploadedAt: string;
    vectorsIndexed?: number;
    isReady?: boolean;
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
    last_message_status?: string | null;
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
            return Array.isArray(data) ? data : data?.agents ?? [];
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

    async getAgentSkills(agentId: string): Promise<{
        name: string;
        description: string | null;
        type: string | null;
    }[]> {
        const res = await fetch(`${BASE_URL}/agents/${encodeURIComponent(agentId)}/skills`, {
            headers: await getAuthHeaders(),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.details || 'Erro ao buscar skills do agente');
        }
        const data = await res.json();
        return Array.isArray(data.skills) ? data.skills : [];
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
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                const msg =
                    typeof err.details === 'string'
                        ? err.details
                        : typeof err.error === 'string'
                          ? err.error
                          : 'Failed to delete agent';
                throw new Error(msg);
            }
        } catch (error: any) {
            return handleFetchError(error, 'DeleteAgent');
        }
    },

    async getDashboardStats(): Promise<DashboardData | null> {
        try {
            const res = await fetch(`${BASE_URL}/dashboard`, {
                headers: await getAuthHeaders()
            });

            if (!res.ok) {
                throw new Error(`Dashboard: status ${res.status}`);
            }

            const data = await res.json();

            // Garantir que agents sempre seja um array
            const responseData: DashboardData = {
                ...data,
                agents: Array.isArray(data.agents) ? data.agents : (data.agents ? [data.agents] : [])
            };

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

    async getInsights(period: string = '7d', options?: { days?: number }): Promise<InsightsData> {
        const empty: InsightsData = {
            overview: [],
            channels: [],
            agents: [],
            summary: {
                total_interactions: 0,
                total_cost: 0,
                active_channels: 0,
                total_tokens: 0,
                rag_usage_count: 0,
                rag_usage_rate: 0,
            },
            issues: [],
        };

        try {
            const daysQuery =
                options?.days != null && options.days > 0
                    ? `&days=${encodeURIComponent(String(options.days))}`
                    : '';
            const res = await fetch(
                `${BASE_URL}/insights?period=${encodeURIComponent(period)}${daysQuery}`,
                {
                headers: await getAuthHeaders(),
            }
            );
            if (!res.ok) {
                const errorText = await res.text();
                console.error('[API] Erro ao buscar insights:', errorText);
                throw new Error(`Failed to fetch insights: ${res.status}`);
            }
            const data = await res.json();

            return {
                overview: Array.isArray(data.overview) ? data.overview : [],
                channels: Array.isArray(data.channels) ? data.channels : [],
                agents: Array.isArray(data.agents) ? data.agents : [],
                summary: data.summary || empty.summary,
                issues: Array.isArray(data.issues) ? data.issues : [],
            };
        } catch (error: any) {
            console.error('[API] Erro ao buscar insights:', error);
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                return empty;
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
    async chatWithCopilot(
        messages: ChatMessage[],
        context?: {
            currentRoute?: string;
            language?: string;
            channel?: string;
            sessionId?: string;
        }
    ): Promise<ChatMessage> {
        try {
            const res = await fetch(`${BASE_URL}/copilot/chat`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ messages, context }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.details || err.error || 'Falha ao conversar com a Sonia Copilot');
            }

            const data = await res.json();
            return {
                role: data.role || 'assistant',
                content: data.content || data.reply || '',
            };
        } catch (error: any) {
            return handleFetchError(error, 'CopilotChat');
        }
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
            return (data || []).map((file: any) => {
                const p = String(file.file_purpose || 'rag').toLowerCase()
                const purpose: 'rag' | 'skills' = p === 'skills' ? 'skills' : 'rag'
                const isReady = Boolean(file.is_ready)
                return {
                id: file.id,
                name: file.original_name,
                size: file.size_bytes ? `${(file.size_bytes / 1024).toFixed(1)} KB` : '0 KB',
                type: file.mime_type || 'text/plain',
                purpose,
                status: file.is_deleted ? 'deleted' : isReady ? 'active' : 'indexing',
                namespace: 'global',
                uploadedAt: file.created_at,
                vectorsIndexed: 0,
                isReady,
            }
            })
        } catch (error) {
            if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                // Quietly fail
                return [];
            }
            console.error("KB API Error:", error);
            return [];
        }
    },

    async createKnowledgeText(params: {
        title: string;
        content: string;
        purpose: 'rag' | 'skills';
    }): Promise<KnowledgeFile> {
        const { title, content, purpose } = params;

        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                throw new Error('Usuário não autenticado');
            }

            const companiesId = await resolveCompaniesIdByEmail(user.email);
            if (!companiesId) {
                throw new Error(
                    'Não foi possível identificar sua empresa. Confirme o cadastro em Configurações ou faça logout e login novamente.'
                );
            }

            try {
                const planRes = await fetch(`${BASE_URL}/billing/subscription`, {
                    headers: await getAuthHeaders()
                });
                if (planRes.ok) {
                    const planData = await planRes.json();
                    const { planHasRag } = await import('../lib/plan-catalog');
                    const plan = planData.plan || 'rec_start';
                    if (!planHasRag(plan)) {
                        throw new Error('A Base de Conhecimento (RAG e Skills) não está incluída no seu plano atual. Faça upgrade para Growth ou Enterprise.');
                    }
                }
            } catch (planError: any) {
                if (planError.message?.includes('RAG') || planError.message?.includes('Skills') || planError.message?.includes('Knowledge Base') || planError.message?.includes('Base de Conhecimento')) {
                    throw planError;
                }
                console.warn('[createKnowledgeText] Erro ao verificar plano, continuando:', planError);
            }

            const createRes = await fetch(`${BASE_URL}/files/create-text`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ title: title.trim(), content, purpose }),
            });

            if (!createRes.ok) {
                let errMsg = `Erro ao salvar (${createRes.status})`;
                try {
                    const errBody = await createRes.json();
                    if (createRes.status === 422 && Array.isArray(errBody.errors)) {
                        const criteriaLines = Array.isArray(errBody.criteria)
                            ? errBody.criteria
                                .filter((c: { passed?: boolean }) => c.passed === false)
                                .map((c: { label?: string; message?: string }) =>
                                    `• ${c.label}${c.message ? `: ${c.message}` : ''}`
                                )
                            : [];
                        const suggestionLines = Array.isArray(errBody.suggestions)
                            ? errBody.suggestions.map((s: string) => `→ ${s}`)
                            : [];
                        errMsg = [
                            errBody.error || 'Conteúdo inválido',
                            ...errBody.errors,
                            ...criteriaLines,
                            ...suggestionLines,
                        ].join('\n');
                    } else {
                        errMsg = errBody.details || errBody.error || errMsg;
                    }
                    const err = new Error(errMsg) as Error & { code?: string };
                    if (errBody?.code) err.code = String(errBody.code);
                    throw err;
                } catch (parseErr) {
                    if (parseErr instanceof Error && 'code' in parseErr) throw parseErr;
                }
                throw new Error(errMsg);
            }

            const payload = await createRes.json();
            const fileId = payload.fileId;
            if (!fileId) {
                throw new Error('Resposta inválida do servidor ao salvar conteúdo');
            }

            try {
                const headers = await getAuthHeaders();
                headers['x-user-email'] = user.email;
                fetch(`${BASE_URL}/files/${fileId}/process`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ purpose }),
                }).catch((err) => console.error('[createKnowledgeText] Erro ao processar:', err));
            } catch (processError) {
                console.error('[createKnowledgeText] Erro ao iniciar processamento:', processError);
            }

            const sizeBytes = payload.sizeBytes || new Blob([content]).size;
            return {
                id: fileId,
                name: payload.title || title.trim(),
                size: `${(sizeBytes / 1024).toFixed(1)} KB`,
                type: 'text/plain',
                purpose,
                status: 'indexing',
                namespace: 'global',
                uploadedAt: new Date().toISOString(),
                vectorsIndexed: 0,
                isReady: false,
            };
        } catch (error: any) {
            return handleFetchError(error, 'CreateKnowledgeText');
        }
    },

    /** @deprecated Use createKnowledgeText — upload legado por arquivo */
    async uploadFile(file: File, namespace: string = 'global', purpose: 'rag' | 'skills' = 'rag'): Promise<KnowledgeFile> {
        const { isAllowedKnowledgeUploadFile, KNOWLEDGE_FORMAT_ERROR } = await import(
            '../lib/knowledge-file-formats'
        )
        if (!isAllowedKnowledgeUploadFile(file)) {
            throw new Error(KNOWLEDGE_FORMAT_ERROR)
        }

        const fileType = file.type || 'text/plain';

        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                throw new Error('Usuário não autenticado');
            }

            // 1. Empresa do tenant (RPC case-insensitive; evita falha com .eq('email') na tb_users)
            const companiesId = await resolveCompaniesIdByEmail(user.email);
            if (!companiesId) {
                throw new Error(
                    'Não foi possível identificar sua empresa. Confirme o cadastro em Configurações ou faça logout e login novamente.'
                );
            }

            // 1.5. Verificar se o plano permite RAG
            try {
                const planRes = await fetch(`${BASE_URL}/billing/subscription`, {
                    headers: await getAuthHeaders()
                });
                if (planRes.ok) {
                    const planData = await planRes.json();
                    const { planHasRag } = await import('../lib/plan-catalog');
                    const plan = planData.plan || 'rec_start';
                    if (!planHasRag(plan)) {
                        throw new Error('A Base de Conhecimento (RAG e Skills) não está incluída no seu plano atual. Faça upgrade para Growth ou Enterprise.');
                    }
                }
            } catch (planError: any) {
                // Se a mensagem já é sobre RAG, propaga
                if (planError.message?.includes('RAG') || planError.message?.includes('Skills') || planError.message?.includes('Knowledge Base') || planError.message?.includes('Base de Conhecimento')) {
                    throw planError;
                }
                // Se for erro de rede, continua (fail-safe)
                console.warn('[uploadFile] Erro ao verificar plano, continuando:', planError);
            }

            // 2–4. Upload via backend (service role) — evita RLS do Storage no browser
            const contentBase64 = await fileToBase64(file);
            const uploadRes = await fetch(`${BASE_URL}/files/upload`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({
                    fileName: file.name,
                    mimeType: fileType,
                    contentBase64,
                    purpose,
                }),
            });

            if (!uploadRes.ok) {
                let errMsg = `Erro ao fazer upload (${uploadRes.status})`;
                try {
                    const errBody = await uploadRes.json();
                    if (uploadRes.status === 422 && Array.isArray(errBody.errors)) {
                        const criteriaLines = Array.isArray(errBody.criteria)
                            ? errBody.criteria
                                .filter((c: { passed?: boolean }) => c.passed === false)
                                .map((c: { label?: string; message?: string }) =>
                                    `• ${c.label}${c.message ? `: ${c.message}` : ''}`
                                )
                            : [];
                        const suggestionLines = Array.isArray(errBody.suggestions)
                            ? errBody.suggestions.map((s: string) => `→ ${s}`)
                            : [];
                        errMsg = [
                            errBody.error || 'Arquivo inválido',
                            ...errBody.errors,
                            ...criteriaLines,
                            ...suggestionLines,
                        ].join('\n');
                    } else {
                        errMsg = errBody.details || errBody.error || errMsg;
                    }
                    const err = new Error(errMsg) as Error & { code?: string };
                    if (errBody?.code) err.code = String(errBody.code);
                    throw err;
                } catch (parseErr) {
                    if (parseErr instanceof Error && 'code' in parseErr) throw parseErr;
                }
                throw new Error(errMsg);
            }

            const uploadPayload = await uploadRes.json();
            const fileId = uploadPayload.fileId;

            if (!fileId) {
                throw new Error('Resposta inválida do servidor ao enviar arquivo');
            }

            // 5. Acionar processamento de vetores no backend (RAG)
            try {
                // Não bloqueamos o retorno da UI se demorar, mas iniciamos o processo
                // O backend deve lidar com isso de forma assíncrona idealmente, mas aqui chamamos
                // para garantir que ao menos inicie.
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
                    if (!res.ok) {
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
                purpose,
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
            const res = await fetch(`${BASE_URL}/files/${id}`, {
                method: 'DELETE',
                headers: await getAuthHeaders()
            });

            if (!res.ok) {
                const responseText = await res.text().catch(() => '');
                let err: any = {};

                try {
                    err = responseText ? JSON.parse(responseText) : {};
                } catch {
                    err = {};
                }

                const routeLooksMissing = res.status === 404 && !err.error && !err.details;

                if (routeLooksMissing) {
                    console.warn(
                        `[DeleteFile] DELETE ${BASE_URL}/files/${id} retornou 404 sem erro de API. Tentando fallback via RPC.`
                    );

                    try {
                        await AgentService.permanentlyDeleteFiles([id]);
                        return;
                    } catch (fallbackError: any) {
                        console.error('[DeleteFile] Fallback de delecao permanente falhou:', fallbackError);
                        throw new Error(
                            fallbackError?.message ||
                            `Rota de delecao nao encontrada no backend em execucao (${BASE_URL}). Reinicie/deploy a API atualizada.`
                        );
                    }
                }

                const msg =
                    typeof err.details === 'string'
                        ? err.details
                        : typeof err.error === 'string'
                          ? err.error
                          : responseText || `Erro ao deletar arquivo (${res.status})`;
                throw new Error(msg);
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

            const { data, error } = await supabase.rpc('sp_list_deleted_files_for_cleanup', {
                p_email: user.email
            });

            if (error) {
                console.error('[listDeletedFilesForCleanup] Erro na RPC:', error);
                throw error;
            }
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

            if (!user?.email) return false;

            // Buscar user_id
            const { data: userData, error: userError } = await supabase
                .from('tb_users')
                .select('id')
                .eq('email', user.email)
                .maybeSingle();

            if (userError) {
                console.error('[checkUserIsAdmin] Erro ao buscar user_id:', userError);
                return false;
            }

            if (!userData?.id) return false;

            // Verificar role na tb_company_users
            const { data: companyUserData, error: companyUserError } = await supabase
                .from('tb_company_users')
                .select('role, companies_id')
                .eq('user_id', userData.id)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (companyUserError) {
                console.error('[checkUserIsAdmin] Erro ao buscar role:', companyUserError);
                return false;
            }

            if (!companyUserData) return false;

            const role = companyUserData.role;
            const companiesId = companyUserData.companies_id;

            if (role === 'owner' || role === 'admin') return true;

            // Verificar permissão basic.admin
            const { data: adminPermission, error: adminPermError } = await supabase
                .from('tb_permissions')
                .select('id')
                .eq('key', 'basic.admin')
                .maybeSingle();

            if (adminPermError) {
                console.error('[checkUserIsAdmin] Erro ao buscar permissão basic.admin:', adminPermError);
            } else if (adminPermission?.id) {
                const { data: userPermission, error: userPermError } = await supabase
                    .from('tb_user_permissions')
                    .select('id')
                    .eq('user_id', userData.id)
                    .eq('companies_id', companiesId)
                    .eq('permission_id', adminPermission.id)
                    .maybeSingle();

                if (userPermError) {
                    console.error('[checkUserIsAdmin] Erro ao verificar permissão:', userPermError);
                } else if (userPermission) {
                    return true;
                }
            }

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
                const errorBody = await response.json().catch(() => ({}));
                if (response.status === 403 && errorBody?.code === 'PLAN_GOVERNANCE_REQUIRED') {
                    const err = new Error(
                        errorBody.error || 'Governança avançada disponível apenas no plano Enterprise'
                    ) as Error & { code?: string; upgradePlan?: string };
                    err.code = 'PLAN_GOVERNANCE_REQUIRED';
                    err.upgradePlan = errorBody.upgradePlan;
                    throw err;
                }
                console.error('[getGovernanceConfig] Erro:', errorBody);
                throw new Error(errorBody?.error || 'Falha ao carregar governança');
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('[getGovernanceConfig] Error:', error);
            throw error;
        }
    },

    async testGovernanceRule(
        rule: 'jailbreak' | 'antiHallucination',
        message: string,
        options?: {
            filters?: { antiHallucination: boolean; jailbreakProtection: boolean }
        }
    ): Promise<{
        blocked?: boolean
        reason?: string
        layer?: 'critical' | 'extended'
        promptOnly?: boolean
        description?: string
        simulation?: {
            messageReachesAgent?: boolean
            usesSamePreProcessingAsChat?: boolean
            blockedResponsePreview?: string
            antiHallucinationActive?: boolean
            messageBlockedAtInput?: boolean
            usesSameInjectionAsChat?: boolean
            extraPromptWhenActive?: string
            expectedBehavior?: string
            fullGovernancePromptLengthChars?: number
        }
    }> {
        const response = await fetch(`${BASE_URL}/governance/test`, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify({
                rule,
                message,
                ...(options?.filters ? { filters: options.filters } : {}),
            }),
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || err.details || 'Erro ao testar governança');
        }
        return response.json();
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

    // Team Management (via BackEnd — service role)
    async getTeamWorkspace(): Promise<{
        can_manage_team: boolean;
        account_type: string;
        company_name: string | null;
        document_masked?: string | null;
        has_document?: boolean;
    }> {
        try {
            const res = await fetch(`${BASE_URL}/team/workspace`, { headers: await getAuthHeaders() });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Falha ao carregar workspace');
            }
            return res.json();
        } catch (error: any) {
            console.error('[AgentService.getTeamWorkspace] Erro:', error);
            return { can_manage_team: false, account_type: 'individual', company_name: null };
        }
    },

    async getTeam(): Promise<any[]> {
        try {
            const res = await fetch(`${BASE_URL}/team/members`, { headers: await getAuthHeaders() });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Falha ao carregar equipe');
            }
            const data = await res.json();
            return data.members || [];
        } catch (error: any) {
            console.error('[AgentService.getTeam] Erro:', error);
            return handleFetchError(error, 'GetTeam');
        }
    },

    async getAvailablePermissions(): Promise<any[]> {
        try {
            const res = await fetch(`${BASE_URL}/team/permissions`, { headers: await getAuthHeaders() });
            if (!res.ok) throw new Error('Falha ao carregar permissões');
            const data = await res.json();
            return data.permissions || [];
        } catch (error: any) {
            console.error('[AgentService.getAvailablePermissions] Erro:', error);
            return handleFetchError(error, 'GetAvailablePermissions');
        }
    },

    async inviteMember(email: string, permissionKey: string): Promise<any> {
        try {
            const res = await fetch(`${BASE_URL}/team/invite`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ email, permissionKey }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Falha ao convidar membro');
            return data;
        } catch (error: any) {
            console.error('[AgentService.inviteMember] Erro:', error);
            return handleFetchError(error, 'InviteMember');
        }
    },

    async updateMemberPermission(email: string, _oldPermissionKey: string, newPermissionKey: string): Promise<any> {
        try {
            const res = await fetch(`${BASE_URL}/team/member-permission`, {
                method: 'PUT',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ email, permissionKey: newPermissionKey }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Falha ao atualizar permissão');
            return data;
        } catch (error: any) {
            console.error('[AgentService.updateMemberPermission] Erro:', error);
            return handleFetchError(error, 'UpdateMemberPermission');
        }
    },

    async removeMember(email: string): Promise<void> {
        try {
            const encoded = encodeURIComponent(email);
            const res = await fetch(`${BASE_URL}/team/members/${encoded}`, {
                method: 'DELETE',
                headers: await getAuthHeaders(),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Falha ao remover membro');
        } catch (error: any) {
            console.error('[AgentService.removeMember] Erro:', error);
            return handleFetchError(error, 'RemoveMember');
        }
    },

    async createCompany(params: {
        companyName?: string;
        accountType?: 'individual' | 'company';
        document: string;
    }): Promise<any> {
        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                throw new Error('Usuário não autenticado');
            }

            const accountType = params.accountType ?? 'company';
            const companyName =
                accountType === 'individual'
                    ? (params.companyName?.trim() || 'Minha conta')
                    : (params.companyName?.trim() || '');

            const { data, error } = await supabase.rpc('sp_create_company_for_user', {
                p_user_email: user.email,
                p_company_name: companyName,
                p_account_type: accountType,
                p_document: params.document ?? null,
            });

            if (error) throw error;
            if (data && typeof data === 'object' && data.success === false) {
                throw new Error(data.error || data.message || 'Falha ao criar workspace');
            }
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
            return data || { plan: 'free', status: 'inactive', plan_title: 'Plano gratuito' };
        } catch (error) {
            if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                return { plan: 'free', status: 'inactive', plan_title: 'Plano gratuito' };
            }
            return { plan: 'free', status: 'inactive', plan_title: 'Plano gratuito' };
        }
    },

    async getBillingPlans(): Promise<{ plans: unknown[] }> {
        try {
            const res = await fetch(`${BASE_URL}/billing/plans`);
            if (!res.ok) throw new Error('Failed to load plans');
            return res.json();
        } catch (error) {
            console.error('[getBillingPlans] Erro:', error);
            return { plans: [] };
        }
    },

    async getBillingUsage(sync = false): Promise<any> {
        try {
            const query = sync ? '?sync=1' : ''
            const res = await fetch(`${BASE_URL}/billing/usage${query}`, {
                headers: await getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Failed to load usage');
            return res.json();
        } catch (error) {
            console.error('[getBillingUsage] Erro:', error);
            return null;
        }
    },

    async getPlatformHealth(): Promise<any> {
        const res = await fetch(`${BASE_URL}/admin/platform-health`, {
            headers: await getAuthHeaders(),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.error || 'Falha ao carregar saúde da plataforma');
        }
        const payload = await res.json();
        return payload;
    },

    async getSubscriptionUsage(sync = false): Promise<any> {
        try {
            const usage = await this.getBillingUsage(sync);
            if (usage) {
                return {
                    plan: usage.plan,
                    plan_name: usage.plan,
                    plan_title: usage.plan_title,
                    status: usage.status,
                    subscription_status: usage.subscription_status,
                    catalog_plan: usage.catalog_plan,
                    effective_plan: usage.effective_plan,
                    current_period_start: usage.current_period_start,
                    current_period_end: usage.current_period_end,
                    canceled_at: usage.canceled_at,
                    cancel_at_period_end: usage.cancel_at_period_end,
                    has_paid_access: usage.has_paid_access,
                    is_platform_admin: usage.is_platform_admin,
                    is_free_account: usage.is_free_account,
                    subscribed_at: usage.subscribed_at,
                    has_stripe_subscription: usage.has_stripe_subscription,
                    can_manage_billing: usage.can_manage_billing ?? false,
                    period_ended: usage.period_ended ?? false,
                    access_state: usage.access_state,
                    conversations_used: usage.conversations_used ?? 0,
                    conversations_limit: usage.conversations_limit,
                    usage_limit_reached: usage.usage_limit_reached ?? false,
                    volume_label: usage.volume_label,
                    messages_used: usage.conversations_used ?? 0,
                    messages_limit: usage.conversations_limit ?? null,
                    agents_used: usage.agents_used ?? 0,
                    agents_limit: usage.agents_limit,
                    product_line: usage.product_line,
                    has_active_outbound: usage.has_active_outbound,
                    has_rag: usage.has_rag,
                    has_governance: usage.has_governance,
                    has_sso: usage.has_sso,
                };
            }
        } catch (error) {
            console.warn('[getSubscriptionUsage] Fallback RPC:', error);
        }

        try {
            const { supabase } = await import('../utils/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.email) {
                throw new Error('Usuário não autenticado');
            }

            const { data, error } = await supabase.rpc('sp_get_subscription_usage_by_email', {
                p_email: user.email
            });

            if (error) {
                throw error;
            }

            const result = Array.isArray(data) && data.length > 0 ? data[0] : null;

            return result || {
                plan: 'free',
                plan_name: 'free',
                plan_title: 'Plano gratuito',
                messages_used: 0,
                messages_limit: 0,
                conversations_used: 0,
                conversations_limit: 0,
                agents_used: 0,
                agents_limit: 0,
                has_paid_access: false,
                is_free_account: true,
                usage_limit_reached: true,
            };
        } catch (error: any) {
            console.error('[getSubscriptionUsage] Erro:', error);
            return {
                plan: 'free',
                plan_name: 'free',
                plan_title: 'Plano gratuito',
                messages_used: 0,
                messages_limit: 0,
                conversations_used: 0,
                conversations_limit: 0,
                agents_used: 0,
                agents_limit: 0,
                has_paid_access: false,
                is_free_account: true,
                usage_limit_reached: true,
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

    async createPortalSession(): Promise<{ url?: string, error?: string }> {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const email = user?.email

            const res = await fetch(`${BASE_URL}/billing/portal`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ 
                    email: email || undefined
                })
            });
            if (!res.ok) {
                const err = await res.json();
                return { error: err.error || "Failed to create portal session" };
            }
            return await res.json();
        } catch (error: any) {
            return { error: "Connection failed. Please check internet." };
        }
    },

    async cancelSubscriptionRenewal(): Promise<any> {
        const res = await fetch(`${BASE_URL}/billing/cancel-renewal`, {
            method: 'POST',
            headers: await getAuthHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || 'Não foi possível cancelar a renovação');
        }
        return data;
    },

    async reactivateSubscriptionRenewal(): Promise<any> {
        const res = await fetch(`${BASE_URL}/billing/reactivate-renewal`, {
            method: 'POST',
            headers: await getAuthHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || 'Não foi possível reativar a renovação');
        }
        return data;
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

export type StuckWhatsAppConversation = {
    message_id: string
    whatsapp_contact_id: string
    last_message: string
    last_message_at: string
    integrations_id: string
    stuck_reason: 'unassigned' | 'plan_limit_atendimentos'
    stuck_detail?: string
    phone_number?: string | null
    conversations_used?: number
    conversations_limit?: number | null
}

export const WhatsAppService = {
    async listStuckConversations(): Promise<StuckWhatsAppConversation[]> {
        try {
            const res = await authenticatedFetch(`${BASE_URL}/whatsapp/conversations/stuck`, {
                method: 'GET',
            })
            const data = await res.json()
            return Array.isArray(data.conversations) ? data.conversations : []
        } catch (error) {
            if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                return []
            }
            console.error('[WhatsAppService] Erro ao listar mensagens travadas:', error)
            return []
        }
    },

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
    },

    async deleteConversationHistory(
        integrationId: string,
        contactId: string
    ): Promise<{ success: boolean; deleted?: Record<string, number>; error?: string }> {
        try {
            const res = await authenticatedFetch(
                `${BASE_URL}/whatsapp/integration/${encodeURIComponent(integrationId)}/conversations/${encodeURIComponent(contactId)}/history`,
                {
                    method: 'DELETE'
                }
            );
            return await res.json();
        } catch (error: any) {
            return {
                success: false,
                error: error?.message || 'Erro ao apagar histórico da conversa'
            };
        }
    },

    async listIntegrationsByEmail(email: string): Promise<{ id: string; phone_number?: string | null }[]> {
        try {
            const res = await fetch(`${BASE_URL}/whatsapp/integrations`, {
                headers: await getAuthHeaders(false),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return [];
            return Array.isArray(data.integrations) ? data.integrations : [];
        } catch {
            return [];
        }
    },

    async syncTemplatesForIntegration(
        integrationId: string
    ): Promise<{ success: boolean; synced?: number; error?: string }> {
        try {
            const res = await authenticatedFetch(
                `${BASE_URL}/whatsapp/integration/${encodeURIComponent(integrationId)}/templates/sync`,
                { method: 'POST' }
            );
            return await res.json();
        } catch (error: any) {
            return { success: false, error: error?.message || 'Erro ao sincronizar' };
        }
    },

    async listCatalogTemplatesForIntegration(integrationId: string): Promise<any[]> {
        try {
            const res = await authenticatedFetch(
                `${BASE_URL}/whatsapp/integration/${encodeURIComponent(integrationId)}/templates`,
                { method: 'GET' }
            );
            const data = await res.json();
            return Array.isArray(data.templates) ? data.templates : [];
        } catch {
            return [];
        }
    },

    async getCustomerCareWindow(integrationId: string, contactId: string): Promise<Record<string, unknown>> {
        const res = await authenticatedFetch(
            `${BASE_URL}/whatsapp/integration/${encodeURIComponent(integrationId)}/contacts/${encodeURIComponent(contactId)}/session-window`,
            { method: 'GET' }
        );
        return await res.json();
    },

    async getUsageReport(integrationId: string, fromIso: string, toIso: string): Promise<Record<string, unknown>> {
        const q = new URLSearchParams({ from: fromIso, to: toIso });
        const res = await authenticatedFetch(
            `${BASE_URL}/whatsapp/integration/${encodeURIComponent(integrationId)}/usage-report?${q.toString()}`,
            { method: 'GET' }
        );
        return await res.json();
    },

    async createCampaign(
        integrationId: string,
        body: { name: string; templateName: string; languageCode: string; components?: unknown[] }
    ): Promise<{ success: boolean; campaign_id?: string; error?: string }> {
        const res = await authenticatedFetch(
            `${BASE_URL}/whatsapp/integration/${encodeURIComponent(integrationId)}/campaigns`,
            {
                method: 'POST',
                body: JSON.stringify({
                    name: body.name,
                    templateName: body.templateName,
                    languageCode: body.languageCode,
                    components: body.components
                })
            }
        );
        return await res.json();
    },

    async enqueueCampaign(
        integrationId: string,
        campaignId: string,
        contactIds: string[]
    ): Promise<{ success: boolean; inserted?: number; error?: string }> {
        const res = await authenticatedFetch(
            `${BASE_URL}/whatsapp/integration/${encodeURIComponent(integrationId)}/campaigns/${encodeURIComponent(campaignId)}/enqueue`,
            {
                method: 'POST',
                body: JSON.stringify({ contactIds })
            }
        );
        return await res.json();
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
    feedbackCount?: number;
    csatCount?: number;
    npsCount?: number;
    sentimentCount?: number;
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

            if (response.data && typeof response.data === 'object' && 'taskSuccessRate' in response.data) {
                return response.data;
            }

            if (typeof response === 'object' && 'taskSuccessRate' in response) {
                return response;
            }
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
                feedbackCount: 0,
                csatCount: 0,
                npsCount: 0,
                sentimentCount: 0,
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
