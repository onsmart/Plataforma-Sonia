"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWhatsApp = sendWhatsApp;
exports.checkConnectionStatus = checkConnectionStatus;
exports.getQRCode = getQRCode;
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../../../lib/logger"));
const supabase_1 = require("../../../lib/supabase");
const whatsapp_meta_1 = require("./whatsapp.meta");
const whatsapp_service_1 = require("./whatsapp.service");
const whatsapp_contacts_1 = require("./whatsapp.contacts");
const whatsapp_redis_1 = require("./whatsapp.redis");
async function getStoredWhatsAppIntegration(integrationsId) {
    const { data, error } = await supabase_1.supabase
        .from('tb_integrations')
        .select('id, phone_number, provider, access_token, app_key, api_key')
        .eq('id', integrationsId)
        .maybeSingle();
    if (error) {
        logger_1.default.error('[whatsapp.dispatcher] Erro ao buscar integraÃ§Ã£o:', {
            integrationsId,
            error: error.message
        });
        return null;
    }
    return (data || null);
}
function resolveMetaConfig(integration) {
    const envConfig = (0, whatsapp_meta_1.buildMetaConfigFromEnv)();
    const accessToken = integration?.access_token || envConfig?.accessToken;
    const phoneNumberId = integration?.app_key || envConfig?.phoneNumberId;
    if (!accessToken || !phoneNumberId) {
        return null;
    }
    const providerHint = String(integration?.provider || process.env.WHATSAPP_PROVIDER || '').toLowerCase();
    const shouldUseMeta = providerHint.includes('meta') || providerHint.includes('cloud') || !!integration?.access_token || !!envConfig;
    if (!shouldUseMeta) {
        return null;
    }
    return {
        provider: 'meta',
        apiVersion: envConfig?.apiVersion || 'v23.0',
        accessToken,
        phoneNumberId,
        verifyToken: integration?.api_key || envConfig?.verifyToken,
        businessPhoneNumber: (0, whatsapp_meta_1.normalizeDigits)(integration?.phone_number || envConfig?.businessPhoneNumber || '')
    };
}
async function persistMetaOutbound(integrationsId, conversationIdForDb, data, messageId) {
    try {
        await (0, whatsapp_redis_1.saveMessageToHistory)(integrationsId, conversationIdForDb, 'assistant', data.message);
    }
    catch (error) {
        logger_1.default.error('[whatsapp.dispatcher] Erro ao salvar histÃ³rico Redis:', {
            error: error?.message
        });
    }
    try {
        const normalizedPhone = conversationIdForDb.replace(/@s\.whatsapp\.net$/, '').trim();
        let contact = await (0, whatsapp_contacts_1.getContactByPhoneNumber)(normalizedPhone);
        if (!contact.success || !contact.contact) {
            const created = await (0, whatsapp_contacts_1.createOrUpdateContact)({
                lid: normalizedPhone,
                phone_number: normalizedPhone,
                status: 'active'
            });
            if (created.success && created.contact) {
                contact = { success: true, contact: created.contact };
            }
        }
        if (!contact.success || !contact.contact) {
            return;
        }
        const metadata = {};
        if (data.context?.request_started_at) {
            metadata.request_started_at = data.context.request_started_at;
        }
        await (0, whatsapp_service_1.saveWhatsAppMessage)({
            whatsapp_contact_id: contact.contact.id,
            message: data.message,
            message_id: messageId,
            direction: 'outbound',
            integrations_id: integrationsId,
            agent_id: data.agentId,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined
        });
        await (0, whatsapp_service_1.markMessagesAsRead)(contact.contact.id, integrationsId);
    }
    catch (error) {
        logger_1.default.error('[whatsapp.dispatcher] Erro ao persistir outbound Meta:', {
            error: error?.message
        });
    }
}
async function sendViaMeta(integrationsId, config, data) {
    const history = await (0, whatsapp_redis_1.getHistoryFromRedis)(integrationsId, data.to, 10);
    let recipientSource = data.to;
    const contactNumberResult = await (0, whatsapp_service_1.getContactNumberForSending)(data.to, integrationsId);
    if (contactNumberResult.success && contactNumberResult.number) {
        recipientSource = contactNumberResult.number;
    }
    const recipientNumber = (0, whatsapp_meta_1.formatMetaRecipient)(recipientSource);
    if (!recipientNumber) {
        return {
            success: false,
            error: 'NÃ£o foi possÃ­vel determinar o destinatÃ¡rio para a Meta Cloud API.'
        };
    }
    try {
        const response = await axios_1.default.post(`https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`, {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipientNumber,
            type: 'text',
            text: {
                body: data.message,
                preview_url: false
            }
        }, {
            headers: {
                Authorization: `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        const messageId = response.data?.messages?.[0]?.id;
        const conversationIdForDb = `${recipientNumber}@s.whatsapp.net`;
        await persistMetaOutbound(integrationsId, conversationIdForDb, data, messageId);
        return {
            success: true,
            messageId,
            history
        };
    }
    catch (error) {
        const metaError = error?.response?.data?.error?.message ||
            error?.response?.data?.message ||
            error?.message ||
            'Erro desconhecido na Meta Cloud API';
        return {
            success: false,
            error: `Meta Cloud API: ${metaError}`
        };
    }
}
async function sendWhatsApp(integrationsId, data) {
    const integration = await getStoredWhatsAppIntegration(integrationsId);
    const metaConfig = resolveMetaConfig(integration);
    if (metaConfig) {
        return sendViaMeta(integrationsId, metaConfig, data);
    }
    return (0, whatsapp_service_1.sendWhatsApp)(integrationsId, data);
}
async function checkConnectionStatus(integrationsId) {
    const integration = await getStoredWhatsAppIntegration(integrationsId);
    const metaConfig = resolveMetaConfig(integration);
    if (metaConfig) {
        return metaConfig.accessToken && metaConfig.phoneNumberId ? 'connected' : 'disconnected';
    }
    return (0, whatsapp_service_1.checkConnectionStatus)(integrationsId);
}
async function getQRCode(integrationsId) {
    const integration = await getStoredWhatsAppIntegration(integrationsId);
    const metaConfig = resolveMetaConfig(integration);
    if (metaConfig) {
        return {
            qrCode: null,
            isConnected: true
        };
    }
    return (0, whatsapp_service_1.getQRCode)(integrationsId);
}
