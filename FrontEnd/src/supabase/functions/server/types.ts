// --- DOMAIN ENTITIES ---

export interface Agent {
    id: string;
    name: string;
    role: string;
    description?: string;
    channels: string[]; // 'whatsapp' | 'webchat' | 'voice'
    languages: string[];
    avatar?: string;
    systemPrompt?: string; // Custom instructions overriding default behavior
    status: 'active' | 'inactive' | 'maintenance';
    modelConfig?: {
        provider?: string; // Changed to string to support new providers (groq, google, etc)
        model?: string;
        temperature?: number;
        maxTokens?: number;
        apiKey?: string; // API key do agente (opcional, busca do banco se não fornecido)
    };
    metrics: {
        conversations: number;
        csat: string;
        avgResponseTime: string;
    };
    createdAt: string;
    updatedAt: string;
}

export interface Device {
    id: string;
    name: string;
    type: 'camera' | 'lock' | 'sensor' | 'thermostat';
    location: string;
    status: 'online' | 'offline' | 'error';
    lastHeartbeat: string;
    metadata?: Record<string, any>;
}

export interface Notification {
    id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
    metadata?: Record<string, any>;
}

export interface Subscription {
    plan: 'free' | 'pro' | 'enterprise';
    status: string; // Stripe status
    stripeId?: string;
    currentPeriodEnd?: string;
    canceledAt?: string;
    updatedAt: string;
}

export interface Job {
    id: string;
    type: 'sentinel_audit' | 'data_sync' | 'report_gen';
    status: 'queued' | 'processing' | 'completed' | 'failed';
    payload: {
        deviceId?: string;
        imageUrl?: string;
        [key: string]: any; // Extensibility
    };
    result?: {
        analysis?: string;
        compliance?: string;
        [key: string]: any;
    };
    error?: string;
    createdAt: string;
    completedAt?: string;
}

// --- NEW TYPES FOR MISSING ENDPOINTS ---

export interface Conversation {
    id: string;
    agentId: string;
    userId?: string;
    platform: 'whatsapp' | 'webchat' | 'voice';
    status: 'active' | 'closed' | 'archived';
    lastMessage: string;
    unreadCount: number;
    updatedAt: string;
    createdAt: string;
    tags?: string[];
}

export interface KBFile {
    id: string;
    name: string;
    size: number;
    type: string;
    status: 'indexing' | 'ready' | 'error';
    url: string;
    uploadedAt: string;
    vectorsIndexed: number;
}

export interface Insight {
    id: string;
    type: 'trend' | 'anomaly' | 'opportunity';
    title: string;
    description: string;
    metric?: string;
    change?: number; // percentage
    severity: 'low' | 'medium' | 'high';
    date: string;
}
