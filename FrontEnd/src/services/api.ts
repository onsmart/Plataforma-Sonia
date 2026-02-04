import { projectId, publicAnonKey } from "../utils/supabase/info";
import { supabase } from "../utils/supabase/client";

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-eeb342a4`;

// Helper for authenticated requests
async function getAuthHeaders(contentType: boolean = true) {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${session?.access_token || publicAnonKey}`
    };
    if (contentType) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
}

// Helper for error handling
const handleFetchError = (error: any, context: string) => {
    // Suppress verbose network errors
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        // Quietly throw a user-friendly error without logging to console
        throw new Error("Connection failed: Please check your internet or try again later.");
    }
    console.error(`[${context}] Unexpected error:`, error);
    throw error;
};

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
    systemPrompt?: string;
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
    overview: { name: string; conversations: number; cost: number }[];
    channels: { name: string; value: number }[];
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

    async getInsights(): Promise<InsightsData> {
        try {
            const res = await fetch(`${BASE_URL}/insights`, {
                headers: await getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch insights');
            return res.json();
        } catch (error) {
             if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                 // Quietly fail
                 return { overview: [], channels: [] };
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
            const res = await fetch(`${BASE_URL}/knowledge`, {
                headers: await getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch files');
            const data = await res.json();
            return data.files || [];
        } catch (error) {
             if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                 // Quietly fail
                 return [];
            }
            console.error("KB API Error:", error);
            return [];
        }
    },

    async uploadFile(file: File, namespace: string = 'global'): Promise<KnowledgeFile> {
        const fileType = file.type || 'text/plain';
        
        try {
            // 1. Get Signed URL
            const startRes = await fetch(`${BASE_URL}/knowledge/upload-url`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ 
                    fileName: file.name, 
                    fileType: fileType 
                })
            });
            
            if (!startRes.ok) {
                const err = await startRes.json();
                throw new Error(err.error || 'Failed to start upload');
            }
            
            const { uploadUrl, path } = await startRes.json();

            // 2. Upload to Supabase Storage (Directly)
            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': fileType
                },
                body: file
            });
            
            if (!uploadRes.ok) throw new Error('Failed to upload file content to storage');

            // 3. Confirm & Trigger Indexing
            const confirmRes = await fetch(`${BASE_URL}/knowledge`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ 
                    name: file.name, 
                    size: (file.size / 1024).toFixed(1) + " KB", 
                    type: fileType, 
                    namespace, 
                    filePath: path 
                })
            });

            if (!confirmRes.ok) {
                const err = await confirmRes.json();
                throw new Error(err.error || 'Failed to index file');
            }
            
            const data = await confirmRes.json();
            return data.file;
        } catch (error: any) {
             return handleFetchError(error, 'UploadFile');
        }
    },

    async deleteFile(id: string): Promise<void> {
        try {
            const res = await fetch(`${BASE_URL}/knowledge/${id}`, {
                method: 'DELETE',
                headers: await getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to delete file');
        } catch (error: any) {
             return handleFetchError(error, 'DeleteFile');
        }
    },

    // Governance
    async getGovernanceConfig(): Promise<GovernanceConfig> {
        try {
            const res = await fetch(`${BASE_URL}/governance`, {
                headers: await getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch governance');
            return await res.json();
        } catch (error) {
            if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                 // Quietly fail
                 return {
                    safetyThresholds: { hateSpeech: 80, sexualContent: 95, dangerousContent: 90 },
                    filters: { competitorBlocking: true, antiHallucination: true, jailbreakProtection: true },
                    dlp: { creditCard: true, ssn: true, email: true, phone: false }
                };
            }
            return {
                safetyThresholds: { hateSpeech: 80, sexualContent: 95, dangerousContent: 90 },
                filters: { competitorBlocking: true, antiHallucination: true, jailbreakProtection: true },
                dlp: { creditCard: true, ssn: true, email: true, phone: false }
            };
        }
    },

    async updateGovernanceConfig(config: GovernanceConfig): Promise<GovernanceConfig> {
        try {
            const res = await fetch(`${BASE_URL}/governance`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify(config)
            });
            if (!res.ok) throw new Error('Failed to update governance');
            return await res.json();
        } catch (error: any) {
             return handleFetchError(error, 'UpdateGovernance');
        }
    },

    // Team Management
    async getTeam(): Promise<any[]> {
        try {
            const res = await fetch(`${BASE_URL}/team`, {
                headers: await getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch team');
            const data = await res.json();
            return data.members || [];
        } catch (error) {
             if ((error as any).name === 'TypeError' && (error as any).message === 'Failed to fetch') {
                 // Quietly fail
                 return [];
            }
            return [];
        }
    },

    async inviteMember(email: string, role: string): Promise<any> {
        try {
            const res = await fetch(`${BASE_URL}/team/invite`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ email, role })
            });
            if (!res.ok) throw new Error('Failed to invite member');
            return await res.json();
        } catch (error: any) {
             return handleFetchError(error, 'InviteMember');
        }
    },

    async removeMember(email: string): Promise<void> {
        try {
            await fetch(`${BASE_URL}/team/${email}`, {
                method: 'DELETE',
                headers: await getAuthHeaders()
            });
        } catch (error: any) {
            handleFetchError(error, 'RemoveMember');
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
            const res = await fetch(`${BASE_URL}/settings/apikeys`, {
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

    async createCheckoutSession(priceId: string): Promise<{ url: string }> {
        try {
            const res = await fetch(`${BASE_URL}/billing/checkout`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ priceId })
            });
            if (!res.ok) throw new Error('Failed to create checkout session');
            return await res.json();
        } catch (error: any) {
             return handleFetchError(error, 'CheckoutSession');
        }
    },

    async createPortalSession(): Promise<{ url?: string, error?: string }> {
        try {
            const res = await fetch(`${BASE_URL}/billing/portal`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({})
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
