"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDigits = normalizeDigits;
exports.isMetaWebhookPayload = isMetaWebhookPayload;
exports.validateMetaWebhookVerification = validateMetaWebhookVerification;
exports.extractMetaWebhookMessages = extractMetaWebhookMessages;
exports.extractMetaWebhookStatuses = extractMetaWebhookStatuses;
exports.formatMetaRecipient = formatMetaRecipient;
function normalizeDigits(value) {
    return String(value || '').replace(/\D/g, '');
}
function isMetaWebhookPayload(payload) {
    return payload?.object === 'whatsapp_business_account';
}
function validateMetaWebhookVerification(query, expectedToken) {
    if (!expectedToken) {
        return { ok: false, status: 500 };
    }
    const mode = String(query['hub.mode'] || '');
    const token = String(query['hub.verify_token'] || '');
    const challenge = String(query['hub.challenge'] || '');
    if (mode === 'subscribe' && token === expectedToken && challenge) {
        return {
            ok: true,
            challenge,
            status: 200
        };
    }
    return {
        ok: false,
        status: 403
    };
}
function extractMetaMessageText(message) {
    if (message?.text?.body) {
        return { text: message.text.body, type: 'text' };
    }
    if (message?.image?.caption) {
        return { text: message.image.caption, type: 'image_with_caption' };
    }
    if (message?.image) {
        return { text: '[Imagem]', type: 'image' };
    }
    if (message?.video?.caption) {
        return { text: message.video.caption, type: 'video_with_caption' };
    }
    if (message?.video) {
        return { text: '[Video]', type: 'video' };
    }
    if (message?.audio) {
        return { text: '[Audio]', type: 'audio' };
    }
    if (message?.document?.filename) {
        return { text: `[Documento: ${message.document.filename}]`, type: 'document' };
    }
    if (message?.document) {
        return { text: '[Documento]', type: 'document' };
    }
    if (message?.button?.text) {
        return { text: message.button.text, type: 'button' };
    }
    if (message?.interactive?.button_reply?.title) {
        return { text: message.interactive.button_reply.title, type: 'interactive_button_reply' };
    }
    if (message?.interactive?.list_reply?.title) {
        return { text: message.interactive.list_reply.title, type: 'interactive_list_reply' };
    }
    if (message?.location) {
        return { text: '[Localizacao]', type: 'location' };
    }
    if (message?.contacts) {
        return { text: '[Contato]', type: 'contact' };
    }
    return {
        text: `[Mensagem: ${message?.type || 'desconhecido'}]`,
        type: message?.type || 'unknown'
    };
}
function extractMetaWebhookMessages(payload) {
    if (!isMetaWebhookPayload(payload)) {
        return [];
    }
    const messages = [];
    for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
            const value = change?.value;
            const displayPhoneNumber = normalizeDigits(value?.metadata?.display_phone_number);
            const phoneNumberId = String(value?.metadata?.phone_number_id || '').trim();
            const instance = displayPhoneNumber || phoneNumberId;
            for (const message of value?.messages || []) {
                const sender = normalizeDigits(message?.from);
                if (!sender || !instance) {
                    continue;
                }
                const { text, type } = extractMetaMessageText(message);
                messages.push({
                    instance,
                    remoteJid: `${sender}@s.whatsapp.net`,
                    messageId: message?.id,
                    messageText: text,
                    messageType: type,
                    nativeMessageType: message?.type ? String(message.type) : undefined,
                    timestamp: message?.timestamp,
                    phoneNumberId,
                    rawPayload: payload
                });
            }
        }
    }
    return messages;
}
function extractMetaWebhookStatuses(payload) {
    if (!isMetaWebhookPayload(payload)) {
        return [];
    }
    const statuses = [];
    for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
            const value = change?.value;
            const phoneNumberId = String(value?.metadata?.phone_number_id || '').trim();
            for (const status of value?.statuses || []) {
                const messageId = String(status?.id || '').trim();
                const normalizedStatus = String(status?.status || '').trim().toLowerCase();
                if (!messageId || !normalizedStatus) {
                    continue;
                }
                const errors = Array.isArray(status?.errors) ? status.errors : [];
                const firstError = errors[0] || null;
                statuses.push({
                    messageId,
                    status: normalizedStatus,
                    timestamp: status?.timestamp ? String(status.timestamp) : undefined,
                    recipientId: status?.recipient_id ? String(status.recipient_id) : undefined,
                    conversationId: status?.conversation?.id ? String(status.conversation.id) : undefined,
                    phoneNumberId,
                    pricingCategory: status?.pricing?.category ? String(status.pricing.category) : undefined,
                    errorCode: firstError?.code !== undefined && firstError?.code !== null
                        ? Number(firstError.code)
                        : undefined,
                    errorTitle: firstError?.title ? String(firstError.title) : undefined,
                    errorMessage: firstError?.message ? String(firstError.message) : undefined,
                    rawPayload: payload
                });
            }
        }
    }
    return statuses;
}
function formatMetaRecipient(to) {
    return normalizeDigits(to);
}
