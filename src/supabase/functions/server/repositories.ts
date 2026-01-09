import * as kv from "./kv_store.tsx";
import { Agent, Device, Notification, Subscription, Job, Conversation, KBFile, Insight } from "./types.ts";

// --- KEY FACTORY ---
const Keys = {
    Agent: (tid: string, aid: string) => `tenant:${tid}:agents:${aid}`,
    AgentIndex: (tid: string) => `tenant:${tid}:agents_index`,
    
    Device: (tid: string, did: string) => `tenant:${tid}:devices:${did}`,
    DeviceIndex: (tid: string) => `tenant:${tid}:devices_index`,
    
    Notification: (tid: string) => `tenant:${tid}:notifications`,
    Subscription: (tid: string) => `tenant:${tid}:subscription`,
    Job: (tid: string, jid: string) => `tenant:${tid}:jobs:${jid}`,
    
    // Unifying Keys for Consistency
    Conversation: (tid: string, cid: string) => `tenant:${tid}:conversations:${cid}`,
    ConversationIndex: (tid: string) => `tenant:${tid}:conversations_index`,
    
    File: (tid: string, fid: string) => `tenant:${tid}:files:${fid}`,
    FileIndex: (tid: string) => `tenant:${tid}:files_index`,
    
    Insight: (tid: string) => `tenant:${tid}:insights`
};

// --- HELPER FOR OPTIMIZED LISTING WITH PAGINATION ---
async function listEntities<T>(
    tid: string, 
    indexKey: string, 
    entityKeyFn: (id: string) => string,
    limit: number = 50,
    offset: number = 0
): Promise<{ items: T[], total: number }> {
    const ids = await kv.get(indexKey);
    if (!Array.isArray(ids) || ids.length === 0) return { items: [], total: 0 };
    
    // Pagination Logic
    const pagedIds = ids.slice(offset, offset + limit);
    
    // Enterprise Optimization: Use mget instead of N+1 fetches
    const keys = pagedIds.map(id => entityKeyFn(id));
    const items = await kv.mget(keys);
    
    // Filter out nulls (in case of data corruption/stale index)
    return {
        items: items.filter(Boolean) as T[],
        total: ids.length
    };
}

// --- REPOSITORIES ---

export const AgentRepo = {
    get: async (tid: string, id: string): Promise<Agent | null> => kv.get(Keys.Agent(tid, id)),
    // Agents list is usually small, so we keep legacy array return for now or adapt if needed.
    // However, to keep consistency with existing frontend contract for Agents (which expects array),
    // we will fetch all for agents but use pagination internally if we wanted to scale.
    // For now, let's keep Agents simple as originally implemented but safer.
    list: async (tid: string) => {
        const { items } = await listEntities<Agent>(tid, Keys.AgentIndex(tid), (id) => Keys.Agent(tid, id), 100, 0);
        return items;
    },
    save: async (tid: string, agent: Agent): Promise<void> => {
        await kv.set(Keys.Agent(tid, agent.id), agent);
        const ids = await kv.get(Keys.AgentIndex(tid)) || [];
        if (!ids.includes(agent.id)) await kv.set(Keys.AgentIndex(tid), [...ids, agent.id]);
    },
    delete: async (tid: string, id: string): Promise<void> => {
        await kv.del(Keys.Agent(tid, id));
        const ids = await kv.get(Keys.AgentIndex(tid)) || [];
        await kv.set(Keys.AgentIndex(tid), ids.filter((i: string) => i !== id));
    }
};

export const DeviceRepo = {
    get: async (tid: string, id: string): Promise<Device | null> => kv.get(Keys.Device(tid, id)),
    list: async (tid: string) => {
        const { items } = await listEntities<Device>(tid, Keys.DeviceIndex(tid), (id) => Keys.Device(tid, id), 100, 0);
        return items;
    },
    save: async (tid: string, device: Device): Promise<void> => {
        await kv.set(Keys.Device(tid, device.id), device);
        const ids = await kv.get(Keys.DeviceIndex(tid)) || [];
        if (!ids.includes(device.id)) await kv.set(Keys.DeviceIndex(tid), [...ids, device.id]);
    }
};

export const NotificationRepo = {
    list: async (tid: string): Promise<Notification[]> => {
        return await kv.get(Keys.Notification(tid)) || [];
    },
    add: async (tid: string, note: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<Notification> => {
        const existing = await NotificationRepo.list(tid);
        const newNote: Notification = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            read: false,
            ...note
        };
        await kv.set(Keys.Notification(tid), [newNote, ...existing].slice(0, 50));
        return newNote;
    },
    markRead: async (tid: string, id: 'all' | string): Promise<void> => {
        const existing = await NotificationRepo.list(tid);
        const updated = existing.map(n => (id === 'all' || n.id === id) ? { ...n, read: true } : n);
        await kv.set(Keys.Notification(tid), updated);
    }
};

export const SubscriptionRepo = {
    get: async (tid: string): Promise<Subscription> => {
        const sub = await kv.get(Keys.Subscription(tid));
        return sub || { plan: 'free', status: 'active', updatedAt: new Date().toISOString() };
    },
    save: async (tid: string, sub: Subscription) => kv.set(Keys.Subscription(tid), sub)
};

export const JobRepo = {
    get: async (tid: string, id: string): Promise<Job | null> => kv.get(Keys.Job(tid, id)),
    save: async (tid: string, job: Job) => kv.set(Keys.Job(tid, job.id), job)
};

// --- NEW REPOS (Optimized) ---

export const ConversationRepo = {
    get: async (tid: string, id: string): Promise<Conversation | null> => kv.get(Keys.Conversation(tid, id)),
    
    list: async (tid: string) => {
        const { items } = await listEntities<Conversation>(tid, Keys.ConversationIndex(tid), (id) => Keys.Conversation(tid, id), 50, 0);
        return items;
    },
    
    save: async (tid: string, conv: Conversation): Promise<void> => {
        await kv.set(Keys.Conversation(tid, conv.id), conv);
        const ids = await kv.get(Keys.ConversationIndex(tid)) || [];
        // Optimized: Move to top if exists, insert if new
        const newIds = [conv.id, ...ids.filter((i: string) => i !== conv.id)];
        await kv.set(Keys.ConversationIndex(tid), newIds.slice(0, 100)); // Limit index size
    }
};

export const FileRepo = {
    list: async (tid: string, limit: number = 50, offset: number = 0) => {
        return await listEntities<KBFile>(tid, Keys.FileIndex(tid), (id) => Keys.File(tid, id), limit, offset);
    },
    save: async (tid: string, file: KBFile): Promise<void> => {
        await kv.set(Keys.File(tid, file.id), file);
        const ids = await kv.get(Keys.FileIndex(tid)) || [];
        if (!ids.includes(file.id)) await kv.set(Keys.FileIndex(tid), [...ids, file.id]);
    },
    delete: async (tid: string, id: string): Promise<void> => {
        await kv.del(Keys.File(tid, id));
        const ids = await kv.get(Keys.FileIndex(tid)) || [];
        await kv.set(Keys.FileIndex(tid), ids.filter((i: string) => i !== id));
    }
};

export const InsightsRepo = {
    list: async (tid: string): Promise<Insight[]> => kv.get(Keys.Insight(tid)) || [],
    generate: async (tid: string): Promise<Insight[]> => {
        // Real logic: Calculate insights based on actual data
        const [conversations, agents] = await Promise.all([
            ConversationRepo.list(tid),
            AgentRepo.list(tid)
        ]);

        const totalConvos = conversations.length;
        const activeAgents = agents.length;
        
        // Calculate conversations per platform
        const platformCounts = conversations.reduce((acc, curr) => {
            acc[curr.platform] = (acc[curr.platform] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const insights: Insight[] = [];

        // Insight 1: Volume Trend
        if (totalConvos > 0) {
            insights.push({
                id: crypto.randomUUID(),
                type: "trend",
                title: "Traffic Volume",
                description: `Currently handling ${totalConvos} active conversations across ${Object.keys(platformCounts).length} channels.`,
                severity: totalConvos > 50 ? "high" : "low",
                change: 0, // Needs historical data for real change calc
                metric: "Conversations",
                date: new Date().toISOString()
            });
        }

        // Insight 2: Agent Utilization
        if (activeAgents > 0) {
             const busyAgents = agents.filter(a => a.status === 'active').length;
             insights.push({
                id: crypto.randomUUID(),
                type: "opportunity",
                title: "Workforce Status",
                description: `${busyAgents} out of ${activeAgents} agents are currently active and deployed.`,
                severity: "info",
                metric: "Agents",
                date: new Date().toISOString()
            });
        }
        
        // Insight 3: Channel Dominance
        const topChannel = Object.entries(platformCounts).sort((a,b) => b[1] - a[1])[0];
        if (topChannel) {
             insights.push({
                id: crypto.randomUUID(),
                type: "trend",
                title: "Channel Dominance",
                description: `${topChannel[0].toUpperCase()} is your most popular channel with ${topChannel[1]} interactions.`,
                severity: "medium",
                metric: "Share",
                date: new Date().toISOString()
            });
        }

        // Fallback for empty state
        if (insights.length === 0) {
             insights.push({
                id: crypto.randomUUID(),
                type: "info",
                title: "System Ready",
                description: "Waiting for traffic to generate insights.",
                severity: "low",
                date: new Date().toISOString()
            });
        }

        await kv.set(Keys.Insight(tid), insights);
        return insights;
    }
};
