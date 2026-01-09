import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

// Export a singleton instance for server-side operations
export const supabase = createClient(supabaseUrl || "", supabaseServiceKey || "");

export async function getTenantId(c: any): Promise<string> {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
        // For security, we require the Authorization header
        throw new Error("Unauthorized: Missing Authorization header");
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
        console.warn("Auth Failed: Invalid token provided from IP " + (c.req.header('x-forwarded-for') || 'unknown'));
        throw new Error("Unauthorized: Session expired or invalid.");
    }
    
    // Security Audit: Log failed access if user ID is malformed
    if (!user.id || typeof user.id !== 'string') {
        console.error("Critical Security: User ID malformed despite valid token.");
        throw new Error("Unauthorized: Security validation failed.");
    }

    return user.id;
}

export async function logActivity(tenantId: string, entry: any) {
    const feedKey = `tenant:${tenantId}:activity_feed`;
    let feed = [];
    try {
        const raw = await kv.get(feedKey);
        if (Array.isArray(raw)) feed = raw;
    } catch (e) {
        console.error("LogActivity Read Error:", e);
    }

    const newLog = {
        ...entry,
        time: new Date().toISOString(),
        id: crypto.randomUUID()
    };
    
    // Keep last 50 logs
    const updatedFeed = [newLog, ...feed].slice(0, 50);
    try {
        await kv.set(feedKey, updatedFeed);
    } catch (e) {
        console.error("LogActivity Write Error:", e);
    }
}

export async function incrementStats(tenantId: string, field: string, amount: number = 1) {
    const statsKey = `tenant:${tenantId}:real_stats`;
    let stats = { interactions: 0, leads: 0, meetings: 0, lastUpdated: new Date().toISOString() };
    try {
        const raw = await kv.get(statsKey);
        if (raw) stats = raw;
    } catch (e) {}
    
    stats[field] = (stats[field] || 0) + amount;
    stats.lastUpdated = new Date().toISOString();
    
    await kv.set(statsKey, stats);
}

export async function trackDailyStat(tenantId: string, metric: string, value: number = 1) {
    const date = new Date().toISOString().split('T')[0];
    const key = `tenant:${tenantId}:stats:daily:${date}`;
    
    let dailyStats: any = {};
    try {
        dailyStats = await kv.get(key) || {};
    } catch (e) {}

    dailyStats[metric] = (dailyStats[metric] || 0) + value;
    
    await kv.set(key, dailyStats);
}

export function formatRelativeTime(isoString: string) {
    if (!isoString) return "Recently";
    const date = new Date(isoString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
}

export async function createNotification(tenantId: string, notification: any) {
    const key = `tenant:${tenantId}:notifications`;
    let existing = [];
    try {
        existing = await kv.get(key) || [];
    } catch (e) {}
    
    const newNotification = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        read: false,
        ...notification
    };
    
    const updated = [newNotification, ...existing].slice(0, 20);
    await kv.set(key, updated);
    return newNotification;
}

const KB_BUCKET = "sonia-kb";
export async function ensureBucket() {
    try {
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some(b => b.name === KB_BUCKET);
        if (!bucketExists) {
            console.log(`Creating bucket: ${KB_BUCKET}`);
            await supabase.storage.createBucket(KB_BUCKET, {
                public: false,
                fileSizeLimit: 10485760,
                allowedMimeTypes: [
                    'text/plain', 'text/markdown', 'text/csv', 'application/json', 'application/pdf',
                    'image/png', 'image/jpeg', 'image/webp', 'image/gif'
                ] 
            });
        }
    } catch (e) {
        console.error("Bucket creation check failed:", e);
    }
}
