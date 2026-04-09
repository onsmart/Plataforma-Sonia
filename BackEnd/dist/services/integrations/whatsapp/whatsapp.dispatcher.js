"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWhatsApp = sendWhatsApp;
exports.checkConnectionStatus = checkConnectionStatus;
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
        .select('id, user_id, companies_id, phone_number, provider, access_token, app_key, auth_token')
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
    if (!integration) {
        return null;
    }
    const accessToken = String(integration.access_token || '').trim();
    const phoneNumberId = String(integration.app_key || '').trim();
    if (!accessToken || !phoneNumberId) {
        return null;
    }
    const providerHint = String(integration.provider || '').toLowerCase();
    const shouldUseMeta = providerHint === 'whatsapp' ||
        providerHint.includes('meta') ||
        providerHint.includes('cloud');
    if (!shouldUseMeta) {
        return null;
    }
    return {
        provider: 'meta',
        apiVersion: envConfig?.apiVersion || 'v23.0',
        accessToken,
        phoneNumberId,
        verifyToken: integration?.auth_token || envConfig?.verifyToken,
        businessPhoneNumber: (0, whatsapp_meta_1.normalizeDigits)(integration?.phone_number || envConfig?.businessPhoneNumber || '')
    };
}
function getMetaOnlyError() {
    return 'Somente integracoes oficiais do WhatsApp pela Meta sao aceitas. Configure Phone Number ID, Access Token, Verify Token e numero oficial da Meta na integracao.';
}
async function resolveIntegrationUserEmail(userId) {
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) {
        return undefined;
    }
    const { data, error } = await supabase_1.supabase
        .from('tb_users')
        .select('email')
        .eq('id', normalizedUserId)
        .maybeSingle();
    if (error) {
        logger_1.default.warn('[whatsapp.dispatcher] Falha ao buscar email do dono da integracao', {
            userId: normalizedUserId,
            error: error.message
        });
        return undefined;
    }
    const normalizedEmail = String(data?.email || '').trim();
    return normalizedEmail || undefined;
}
async function saveOutboundWhatsAppLog(params) {
    try {
        const { saveSystemLog } = await Promise.resolve().then(() => __importStar(require('../../system-logs')));
        const userEmail = await resolveIntegrationUserEmail(params.integration.user_id);
        await saveSystemLog({
            user_id: params.integration.user_id || undefined,
            companies_id: params.integration.companies_id || undefined,
            user_email: userEmail,
            agent_id: params.agentId || undefined,
            log_type: 'whatsapp_outbound',
            level: 'info',
            message: `WhatsApp enviado para ${params.phoneNumber}`,
            metadata: {
                integration_id: params.integration.id,
                integration_phone_number: params.integration.phone_number,
                phone_number: params.phoneNumber,
                message_id: params.messageId || null,
                message_preview: params.message.trim().slice(0, 180)
            },
            impact_level: 'low'
        });
    }
    catch (logError) {
        logger_1.default.warn('[whatsapp.dispatcher] Falha ao salvar log de outbound WhatsApp', {
            integrationId: params.integration.id,
            error: logError?.message
        });
    }
}
async function persistMetaOutbound(integration, conversationIdForDb, data, messageId) {
    try {
        await (0, whatsapp_redis_1.saveMessageToHistory)(integration.id, conversationIdForDb, 'assistant', data.message);
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
        metadata.whatsapp_status = 'accepted';
        metadata.whatsapp_status_updated_at = new Date().toISOString();
        if (data.context?.request_started_at) {
            metadata.request_started_at = data.context.request_started_at;
        }
        if (data.context?.automation_source) {
            metadata.automation_source = data.context.automation_source;
        }
        if (data.context?.flow_id) {
            metadata.flow_id = data.context.flow_id;
        }
        if (data.context?.flow_execution_id) {
            metadata.flow_execution_id = data.context.flow_execution_id;
        }
        await (0, whatsapp_service_1.saveWhatsAppMessage)({
            whatsapp_contact_id: contact.contact.id,
            message: data.message,
            message_id: messageId,
            direction: 'outbound',
            integrations_id: integration.id,
            agent_id: data.agentId,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined
        });
        await (0, whatsapp_service_1.markMessagesAsRead)(contact.contact.id, integration.id);
        await saveOutboundWhatsAppLog({
            integration,
            phoneNumber: normalizedPhone,
            message: data.message,
            messageId,
            agentId: data.agentId
        });
    }
    catch (error) {
        logger_1.default.error('[whatsapp.dispatcher] Erro ao persistir outbound Meta:', {
            error: error?.message
        });
    }
}
async function sendViaMeta(integration, config, data) {
    let recipientSource = data.to;
    const contactNumberResult = await (0, whatsapp_service_1.getContactNumberForSending)(data.to, integration.id);
    if (contactNumberResult.success && contactNumberResult.number) {
        recipientSource = contactNumberResult.number;
    }
    const historyRedisRef = contactNumberResult.success && contactNumberResult.number
        ? `${contactNumberResult.number}@s.whatsapp.net`
        : data.to;
    const history = await (0, whatsapp_redis_1.getHistoryFromRedis)(integration.id, historyRedisRef, 10);
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
        await persistMetaOutbound(integration, conversationIdForDb, data, messageId);
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
async function validateMetaConnection(config) {
    try {
        await axios_1.default.get(`https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}`, {
            headers: {
                Authorization: `Bearer ${config.accessToken}`
            },
            params: {
                fields: 'id'
            },
            timeout: 15000
        });
        return true;
    }
    catch (error) {
        const metaError = error?.response?.data?.error?.message ||
            error?.response?.data?.message ||
            error?.message ||
            'Erro desconhecido ao validar conexao com a Meta';
        logger_1.default.warn('[whatsapp.dispatcher] Falha ao validar conexao com a Meta', {
            phoneNumberId: config.phoneNumberId,
            error: metaError
        });
        return false;
    }
}
async function sendWhatsApp(integrationsId, data) {
    const integration = await getStoredWhatsAppIntegration(integrationsId);
    const metaConfig = resolveMetaConfig(integration);
    if (metaConfig && integration) {
        return sendViaMeta(integration, metaConfig, data);
    }
    logger_1.default.warn('[whatsapp.dispatcher] Integracao WhatsApp rejeitada por nao ser Meta', {
        integrationsId,
        integrationProvider: integration?.provider || null,
        hasAccessToken: !!integration?.access_token,
        hasPhoneNumberId: !!integration?.app_key
    });
    return {
        success: false,
        error: getMetaOnlyError()
    };
}
async function checkConnectionStatus(integrationsId) {
    const integration = await getStoredWhatsAppIntegration(integrationsId);
    const metaConfig = resolveMetaConfig(integration);
    if (metaConfig) {
        const isConnected = await validateMetaConnection(metaConfig);
        return isConnected ? 'connected' : 'disconnected';
    }
    logger_1.default.warn('[whatsapp.dispatcher] Status solicitado para integracao nao-Meta', {
        integrationsId,
        integrationProvider: integration?.provider || null
    });
    return 'disconnected';
}
