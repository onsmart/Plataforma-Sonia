import * as kv from "./kv_store.tsx";
import { ConversationRepo } from "./repositories.ts";
import { Conversation } from "./types.ts";

// --- CORE UTILS ---

export async function updateConversationState(tenantId: string, sessionId: string, updates: any) {
    const sessionKey = `tenant:${tenantId}:chat_session:${sessionId}`;
    
    // Fetch existing or init new session
    const session = await kv.get(sessionKey) || { messages: [] };
    const newSessionState = { ...session, ...updates };
    
    // 1. Save Messages Blob
    await kv.set(sessionKey, newSessionState);

    // 2. Sync Metadata for Inbox
    const currentConv = await ConversationRepo.get(tenantId, sessionId);
    const now = new Date().toISOString();
    
    const conv: Conversation = {
        id: sessionId,
        agentId: updates.agentId || currentConv?.agentId || "unknown",
        userId: updates.userId || currentConv?.userId || sessionId,
        platform: updates.platform || currentConv?.platform || "webchat",
        status: updates.status || currentConv?.status || "active",
        lastMessage: updates.lastMessage || currentConv?.lastMessage || "Interaction updated",
        unreadCount: (updates.unreadCount !== undefined) ? updates.unreadCount : (currentConv?.unreadCount || 0),
        updatedAt: now,
        createdAt: currentConv?.createdAt || now,
        tags: currentConv?.tags || []
    };

    await ConversationRepo.save(tenantId, conv);
}

export async function saveMessage(tenantId: string, sessionId: string, message: any) {
    const sessionKey = `tenant:${tenantId}:chat_session:${sessionId}`;
    const session = await kv.get(sessionKey) || { messages: [] };
    
    // Append message
    const updatedMessages = [...(session.messages || []), { ...message, timestamp: new Date().toISOString() }];
    
    const isUser = message.role === 'user';
    
    await updateConversationState(tenantId, sessionId, {
        messages: updatedMessages,
        lastMessage: message.content,
        // If user sends, unread + 1. If system sends, unread = 0.
        unreadCount: isUser ? ((session.unreadCount || 0) + 1) : 0 
    });
}

// --- TWILIO / OUTBOUND INTEGRATION ---

export async function sendTwilioMessage(tenantId: string, to: string, body: string): Promise<{ success: boolean; error?: string }> {
    const config = await kv.get(`tenant:${tenantId}:config:twilio`);
    
    if (!config || !config.accountSid || !config.authToken || !config.phoneNumber) {
        return { success: false, error: "Twilio configuration missing (SID, Token, or PhoneNumber)" };
    }

    const { accountSid, authToken, phoneNumber: from } = config;
    const auth = btoa(`${accountSid}:${authToken}`);
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const params = new URLSearchParams();
    params.append('To', to);
    params.append('From', from);
    params.append('Body', body);

    try {
        const res = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        });

        if (!res.ok) {
            const err = await res.text();
            console.error("Twilio Send Error:", err);
            return { success: false, error: `Twilio API Error: ${res.status}` };
        }
        return { success: true };
    } catch (e) {
        console.error("Twilio Network Error:", e);
        return { success: false, error: e.message };
    }
}

// --- UNIFIED OUTBOUND PROCESSOR ---

export async function processOutboundMessage(tenantId: string, params: {
    channel: 'whatsapp' | 'sms' | 'email';
    to: string;
    content: string;
    agentId?: string;
}) {
    // 1. Determine Session ID (Use phone number as ID for SMS/WhatsApp)
    const sessionId = params.to.replace(/\D/g, ''); // Strip non-digits
    
    // 2. Send via Channel Provider
    let deliveryResult;
    
    if (params.channel === 'whatsapp' || params.channel === 'sms') {
        // Twilio handles both (WhatsApp requires 'whatsapp:' prefix usually handled by config or 'to')
        deliveryResult = await sendTwilioMessage(tenantId, params.to, params.content);
    } else {
        return { success: false, error: "Channel not supported yet" };
    }

    if (!deliveryResult.success) {
        return deliveryResult;
    }

    // 3. Save to History (So it appears in Inbox)
    await updateConversationState(tenantId, sessionId, {
        platform: params.channel,
        agentId: params.agentId || "system_outbound",
        status: 'active'
    });

    await saveMessage(tenantId, sessionId, {
        role: 'assistant',
        content: params.content,
        meta: { type: 'outbound', channel: params.channel }
    });

    return { success: true, sessionId };
}
