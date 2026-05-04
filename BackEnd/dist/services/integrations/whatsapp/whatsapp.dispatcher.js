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
exports.sendWhatsAppTemplate = sendWhatsAppTemplate;
exports.performWhatsAppCallAction = performWhatsAppCallAction;
exports.rejectWhatsAppCall = rejectWhatsAppCall;
exports.preAcceptWhatsAppCall = preAcceptWhatsAppCall;
exports.acceptWhatsAppCall = acceptWhatsAppCall;
exports.terminateWhatsAppCall = terminateWhatsAppCall;
exports.checkConnectionStatus = checkConnectionStatus;
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../../../lib/logger"));
const supabase_1 = require("../../../lib/supabase");
const whatsapp_meta_1 = require("./whatsapp.meta");
const whatsapp_service_1 = require("./whatsapp.service");
const whatsapp_template_payload_1 = require("./whatsapp-template-payload");
const whatsapp_feature_flags_1 = require("./whatsapp-feature-flags");
const whatsapp_message_events_service_1 = require("./whatsapp-message-events.service");
const whatsapp_contacts_1 = require("./whatsapp.contacts");
const whatsapp_redis_1 = require("./whatsapp.redis");
const DEFAULT_META_API_VERSION = 'v23.0';
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
function shouldPreferEnvMetaConfig() {
    const source = String(process.env.WHATSAPP_META_CONFIG_SOURCE || '').trim().toLowerCase();
    const legacyFlag = String(process.env.WHATSAPP_META_USE_ENV_CONFIG || '').trim().toLowerCase();
    return source === 'env' || legacyFlag === 'true';
}
function resolveMetaConfig(integration) {
    if (!integration) {
        return null;
    }
    const preferEnv = shouldPreferEnvMetaConfig();
    const integrationAccessToken = String(integration.access_token || '').trim();
    const integrationPhoneNumberId = String(integration.app_key || '').trim();
    const integrationVerifyToken = String(integration.auth_token || '').trim();
    const integrationBusinessPhoneNumber = (0, whatsapp_meta_1.normalizeDigits)(integration.phone_number || '');
    const envAccessToken = String(process.env.WHATSAPP_META_ACCESS_TOKEN || '').trim();
    const envPhoneNumberId = String(process.env.WHATSAPP_META_PHONE_NUMBER_ID || '').trim();
    const envVerifyToken = String(process.env.WHATSAPP_META_VERIFY_TOKEN || '').trim();
    const envBusinessPhoneNumber = (0, whatsapp_meta_1.normalizeDigits)(process.env.WHATSAPP_META_BUSINESS_NUMBER || '');
    const accessToken = preferEnv
        ? envAccessToken || integrationAccessToken
        : integrationAccessToken || envAccessToken;
    const phoneNumberId = preferEnv
        ? envPhoneNumberId || integrationPhoneNumberId
        : integrationPhoneNumberId || envPhoneNumberId;
    const verifyToken = preferEnv
        ? envVerifyToken || integrationVerifyToken
        : integrationVerifyToken || envVerifyToken;
    const businessPhoneNumber = preferEnv
        ? envBusinessPhoneNumber || integrationBusinessPhoneNumber
        : integrationBusinessPhoneNumber || envBusinessPhoneNumber;
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
        apiVersion: String(process.env.WHATSAPP_META_API_VERSION || DEFAULT_META_API_VERSION).trim() || DEFAULT_META_API_VERSION,
        accessToken,
        phoneNumberId,
        verifyToken: verifyToken || undefined,
        businessPhoneNumber
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
        if (data.messageType) {
            metadata.message_type = data.messageType;
        }
        if (Array.isArray(data.buttons) && data.buttons.length > 0) {
            metadata.buttons = data.buttons.map((button) => ({
                id: button.id || null,
                text: String(button.text || '').trim()
            }));
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
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function waitForImmediateMetaFailure(messageId) {
    const normalizedMessageId = String(messageId || '').trim();
    if (!normalizedMessageId) {
        return { failed: false };
    }
    const maxAttempts = 6;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const { data, error } = await supabase_1.supabase
            .from('tb_whatsapp_messages')
            .select('metadata')
            .eq('message_id', normalizedMessageId)
            .order('created_at', { ascending: false })
            .limit(1);
        if (!error && Array.isArray(data) && data.length > 0) {
            const metadata = data[0]?.metadata && typeof data[0].metadata === 'object' && !Array.isArray(data[0].metadata)
                ? data[0].metadata
                : {};
            const status = String(metadata.whatsapp_status || '').trim().toLowerCase();
            if (status === 'failed') {
                const errorParts = [
                    metadata.whatsapp_error_title,
                    metadata.whatsapp_error_message,
                    typeof metadata.whatsapp_error_code === 'number' ? `code ${metadata.whatsapp_error_code}` : null
                ]
                    .map((part) => String(part || '').trim())
                    .filter(Boolean);
                return {
                    failed: true,
                    status,
                    error: errorParts.length > 0 ? errorParts.join(' - ') : 'Falha de entrega reportada pela Meta.'
                };
            }
            if (status === 'delivered' || status === 'read') {
                return { failed: false, status };
            }
        }
        if (attempt < maxAttempts - 1) {
            await delay(500);
        }
    }
    return { failed: false };
}
/**
 * Envio de mensagem de sessão em texto (fluxo legado — inalterado semanticamente).
 * Extraído para função nomeada; `sendViaMeta` permanece como alias estável.
 */
async function sendSessionTextViaMeta(integration, config, data) {
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
        const buttonRows = Array.isArray(data.buttons)
            ? data.buttons
                .map((button, index) => ({
                id: String(button.id || `btn_${index + 1}`).trim() || `btn_${index + 1}`,
                title: String(button.text || '').trim().slice(0, 20)
            }))
                .filter((button) => button.title)
                .slice(0, 3)
            : [];
        const body = data.messageType === 'interactive_buttons' && buttonRows.length > 0
            ? {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: recipientNumber,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: {
                        text: data.message
                    },
                    action: {
                        buttons: buttonRows.map((button) => ({
                            type: 'reply',
                            reply: button
                        }))
                    }
                }
            }
            : {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: recipientNumber,
                type: 'text',
                text: {
                    body: data.message,
                    preview_url: data.previewUrl === true
                }
            };
        const response = await axios_1.default.post(`https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`, body, {
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
async function sendViaMeta(integration, config, data) {
    return sendSessionTextViaMeta(integration, config, data);
}
async function sendTemplateViaMeta(integration, config, data) {
    const enabled = await (0, whatsapp_feature_flags_1.isTemplatesEnabledForIntegration)(integration.id);
    if (!enabled) {
        return {
            success: false,
            error: 'Envio por template desabilitado para esta integracao. Defina WHATSAPP_TEMPLATES_ENABLED=true ou habilite em tb_whatsapp_integration_feature_flags.'
        };
    }
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
    const body = (0, whatsapp_template_payload_1.buildCloudApiTemplateMessageBody)({
        toDigits: recipientNumber,
        templateName: data.templateName,
        languageCode: data.languageCode,
        components: (data.components || [])
    });
    try {
        const response = await axios_1.default.post(`https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`, body, {
            headers: {
                Authorization: `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 45000
        });
        const messageId = response.data?.messages?.[0]?.id;
        const conversationIdForDb = `${recipientNumber}@s.whatsapp.net`;
        const sessionPayload = {
            to: data.to,
            message: `[Template] ${data.templateName} (${data.languageCode})`,
            agentId: data.agentId,
            context: {
                ...(data.context || {}),
                template_name: data.templateName,
                template_language: data.languageCode,
                message_kind: 'template'
            }
        };
        await persistMetaOutbound(integration, conversationIdForDb, sessionPayload, messageId);
        let contactUuid = null;
        try {
            const normalizedPhone = conversationIdForDb.replace(/@s\.whatsapp\.net$/, '').trim();
            const c = await (0, whatsapp_contacts_1.getContactByPhoneNumber)(normalizedPhone);
            if (c.success && c.contact?.id) {
                contactUuid = c.contact.id;
            }
        }
        catch {
            contactUuid = null;
        }
        void (0, whatsapp_message_events_service_1.recordWhatsappMessageEvent)({
            integrations_id: integration.id,
            companies_id: integration.companies_id || null,
            whatsapp_contact_id: contactUuid,
            wamid: messageId || null,
            event_type: 'sent',
            message_kind: 'template',
            template_name: data.templateName,
            template_language: data.languageCode,
            payload: { graph_response_preview: 'ok' }
        });
        const immediateFailure = await waitForImmediateMetaFailure(messageId);
        if (immediateFailure.failed) {
            logger_1.default.warn('[whatsapp.dispatcher] Template aceito pela Meta e reprovado logo em seguida', {
                integrationId: integration.id,
                messageId,
                templateName: data.templateName,
                status: immediateFailure.status || null,
                error: immediateFailure.error || null
            });
            return {
                success: false,
                messageId,
                error: `Meta Cloud API: ${immediateFailure.error || 'Falha de entrega reportada pela Meta.'}`,
                history
            };
        }
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
        void (0, whatsapp_message_events_service_1.recordWhatsappMessageEvent)({
            integrations_id: integration.id,
            companies_id: integration.companies_id || null,
            whatsapp_contact_id: null,
            wamid: null,
            event_type: 'failed',
            message_kind: 'template',
            template_name: data.templateName,
            template_language: data.languageCode,
            error_message: String(metaError).slice(0, 2000),
            payload: {
                graph_error: error?.response?.data || null
            }
        });
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
/**
 * Novo caminho: template oficial (Cloud API). Convive com {@link sendWhatsApp}; não o substitui.
 */
async function sendWhatsAppTemplate(integrationsId, data) {
    const integration = await getStoredWhatsAppIntegration(integrationsId);
    const metaConfig = resolveMetaConfig(integration);
    if (metaConfig && integration) {
        return sendTemplateViaMeta(integration, metaConfig, data);
    }
    logger_1.default.warn('[whatsapp.dispatcher] Template rejeitado: integracao nao-Meta ou incompleta', {
        integrationsId,
        integrationProvider: integration?.provider || null
    });
    return {
        success: false,
        error: getMetaOnlyError()
    };
}
async function performWhatsAppCallAction(integrationsId, params) {
    const integration = await getStoredWhatsAppIntegration(integrationsId);
    const metaConfig = resolveMetaConfig(integration);
    const normalizedCallId = String(params.callId || '').trim();
    if (!normalizedCallId) {
        return {
            success: false,
            error: 'callId e obrigatorio para recusar a ligacao.'
        };
    }
    if (!metaConfig) {
        logger_1.default.warn('[whatsapp.dispatcher] Ligacao nao recusada: integracao Meta incompleta', {
            integrationsId,
            integrationProvider: integration?.provider || null
        });
        return {
            success: false,
            error: getMetaOnlyError()
        };
    }
    try {
        await axios_1.default.post(`https://graph.facebook.com/${metaConfig.apiVersion}/${metaConfig.phoneNumberId}/calls`, {
            messaging_product: 'whatsapp',
            call_id: normalizedCallId,
            action: params.action,
            ...(params.to ? { to: (0, whatsapp_meta_1.formatMetaRecipient)(params.to) } : {}),
            ...(params.session
                ? {
                    session: {
                        sdp_type: params.session.sdpType,
                        sdp: params.session.sdp
                    }
                }
                : {})
        }, {
            headers: {
                Authorization: `Bearer ${metaConfig.accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        return { success: true };
    }
    catch (error) {
        const metaError = error?.response?.data?.error?.message ||
            error?.response?.data?.message ||
            error?.message ||
            'Erro desconhecido ao recusar ligacao via Meta';
        logger_1.default.warn('[whatsapp.dispatcher] Falha ao executar acao de ligacao via Meta', {
            integrationsId,
            phoneNumberId: metaConfig.phoneNumberId,
            callId: normalizedCallId,
            action: params.action,
            error: metaError
        });
        return {
            success: false,
            error: `Meta Cloud API: ${metaError}`
        };
    }
}
function rejectWhatsAppCall(integrationsId, callId) {
    return performWhatsAppCallAction(integrationsId, {
        callId,
        action: 'reject'
    });
}
function preAcceptWhatsAppCall(integrationsId, callId, sdpAnswer) {
    return performWhatsAppCallAction(integrationsId, {
        callId,
        action: 'pre_accept',
        session: {
            sdpType: 'answer',
            sdp: sdpAnswer
        }
    });
}
function acceptWhatsAppCall(integrationsId, callId, sdpAnswer) {
    return performWhatsAppCallAction(integrationsId, {
        callId,
        action: 'accept',
        session: {
            sdpType: 'answer',
            sdp: sdpAnswer
        }
    });
}
function terminateWhatsAppCall(integrationsId, callId) {
    return performWhatsAppCallAction(integrationsId, {
        callId,
        action: 'terminate'
    });
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
