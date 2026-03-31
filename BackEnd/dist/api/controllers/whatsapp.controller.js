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
exports.getCurrentWhatsAppIntegration = getCurrentWhatsAppIntegration;
exports.upsertCurrentWhatsAppIntegration = upsertCurrentWhatsAppIntegration;
exports.verifyWhatsAppWebhook = verifyWhatsAppWebhook;
exports.getWhatsAppStatus = getWhatsAppStatus;
exports.listWhatsAppIntegrations = listWhatsAppIntegrations;
exports.receiveWhatsAppWebhook = receiveWhatsAppWebhook;
exports.getWhatsAppHistoryEndpoint = getWhatsAppHistoryEndpoint;
exports.processPendingWhatsAppConversations = processPendingWhatsAppConversations;
exports.processQueueManually = processQueueManually;
exports.getQueueStatsEndpoint = getQueueStatsEndpoint;
exports.getUnreadWhatsAppMessages = getUnreadWhatsAppMessages;
const whatsapp_1 = require("../../services/integrations/whatsapp");
const whatsapp_redis_1 = require("../../services/integrations/whatsapp/whatsapp.redis");
const whatsapp_contacts_1 = require("../../services/integrations/whatsapp/whatsapp.contacts");
const whatsapp_meta_1 = require("../../services/integrations/whatsapp/whatsapp.meta");
const whatsapp_service_1 = require("../../services/integrations/whatsapp/whatsapp.service");
const supabase_1 = require("../../lib/supabase");
const logger_1 = __importDefault(require("../../lib/logger"));
function normalizePhoneNumberForDatabase(phoneNumberOrId) {
    if (phoneNumberOrId.endsWith('@s.whatsapp.net')) {
        return phoneNumberOrId.replace('@s.whatsapp.net', '');
    }
    return phoneNumberOrId;
}
function getIntegrationUserEmail(integrationWithUser) {
    const integrationUserRaw = integrationWithUser?.tb_users;
    if (Array.isArray(integrationUserRaw)) {
        return String(integrationUserRaw[0]?.email || '').trim();
    }
    return String(integrationUserRaw?.email || '').trim();
}
function isAgentActive(statusId) {
    if (statusId === null || statusId === undefined) {
        return false;
    }
    const numericStatus = typeof statusId === 'string'
        ? parseInt(statusId, 10)
        : Number(statusId);
    return numericStatus === 1;
}
async function resolveStoredMetaVerifyToken(receivedToken) {
    const envVerifyToken = (0, whatsapp_meta_1.buildMetaConfigFromEnv)()?.verifyToken;
    const normalizedToken = String(receivedToken || '').trim();
    if (!normalizedToken) {
        return envVerifyToken;
    }
    if (envVerifyToken && envVerifyToken === normalizedToken) {
        return envVerifyToken;
    }
    const { data, error } = await supabase_1.supabase
        .from('tb_integrations')
        .select('id, auth_token')
        .eq('provider', 'whatsapp')
        .eq('auth_token', normalizedToken)
        .maybeSingle();
    if (error) {
        logger_1.default.error('[verifyWhatsAppWebhook] Erro ao buscar verify token salvo na integracao', {
            error: error.message
        });
        return envVerifyToken;
    }
    return String(data?.auth_token || envVerifyToken || '').trim() || undefined;
}
async function findMetaIntegrationForMessage(instance, phoneNumberId) {
    const normalizedInstance = (0, whatsapp_meta_1.normalizeDigits)(instance);
    const normalizedPhoneNumberId = String(phoneNumberId || '').trim();
    if (normalizedPhoneNumberId) {
        const { data, error } = await supabase_1.supabase
            .from('tb_integrations')
            .select('id, user_id, phone_number, app_key, provider')
            .eq('provider', 'whatsapp')
            .eq('app_key', normalizedPhoneNumberId)
            .maybeSingle();
        if (!error && data) {
            return data;
        }
    }
    if (!normalizedInstance) {
        return null;
    }
    const { data, error } = await supabase_1.supabase
        .from('tb_integrations')
        .select('id, user_id, phone_number, app_key, provider')
        .eq('provider', 'whatsapp')
        .eq('phone_number', normalizedInstance)
        .maybeSingle();
    if (!error && data) {
        return data;
    }
    const { data: fallbackRows, error: fallbackError } = await supabase_1.supabase
        .from('tb_integrations')
        .select('id, user_id, phone_number, app_key, provider')
        .eq('provider', 'whatsapp');
    if (fallbackError) {
        logger_1.default.error('[receiveWhatsAppWebhook] Erro ao buscar integracao por fallback', {
            error: fallbackError.message,
            instance: normalizedInstance,
            phoneNumberId: normalizedPhoneNumberId
        });
        return null;
    }
    const fallbackMatch = (fallbackRows || []).find((row) => {
        const storedPhoneNumber = (0, whatsapp_meta_1.normalizeDigits)(row?.phone_number);
        const storedPhoneNumberId = String(row?.app_key || '').trim();
        return ((!!normalizedPhoneNumberId && storedPhoneNumberId === normalizedPhoneNumberId) ||
            (!!normalizedInstance && storedPhoneNumber === normalizedInstance));
    });
    return (fallbackMatch || null);
}
async function getAuthenticatedPlatformUser(email) {
    const { data: userData, error: userError } = await supabase_1.supabase
        .from('tb_users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
    if (userError || !userData?.id) {
        throw new Error('Usuario autenticado nao encontrado na tabela tb_users');
    }
    const { data: companyUser, error: companyUserError } = await supabase_1.supabase
        .from('tb_company_users')
        .select('companies_id')
        .eq('user_id', userData.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
    if (companyUserError) {
        throw new Error(companyUserError.message);
    }
    return {
        id: userData.id,
        companies_id: companyUser?.companies_id || null
    };
}
function isOwnedWhatsAppIntegration(integration, userId, companiesId) {
    return (integration.user_id === userId ||
        (!!companiesId && integration.companies_id === companiesId));
}
function normalizeWhatsappPayload(body) {
    const phoneNumber = (0, whatsapp_meta_1.normalizeDigits)(String(body?.phone_number || body?.phoneNumber || ''));
    const appKey = String(body?.app_key || body?.phoneNumberId || '').trim();
    const accessToken = String(body?.access_token || body?.accessToken || '').trim();
    const authToken = String(body?.auth_token || body?.verifyToken || '').trim();
    return {
        phone_number: phoneNumber || null,
        app_key: appKey || null,
        access_token: accessToken || null,
        auth_token: authToken || null
    };
}
function hasAnyWhatsAppConfig(payload) {
    return !!(payload.phone_number || payload.app_key || payload.access_token || payload.auth_token);
}
async function loadCandidateWhatsAppIntegrations() {
    const { data, error } = await supabase_1.supabase
        .from('tb_integrations')
        .select('id, user_id, companies_id, phone_number, app_key, access_token, auth_token, provider, created_at')
        .eq('provider', 'whatsapp')
        .order('created_at', { ascending: false });
    if (error) {
        throw new Error(error.message);
    }
    return Array.isArray(data) ? data : [];
}
function pickPrimaryOwnedIntegration(rows, userId, companiesId) {
    const ownedRows = rows.filter((row) => isOwnedWhatsAppIntegration(row, userId, companiesId));
    const userOwned = ownedRows.find((row) => row.user_id === userId);
    if (userOwned)
        return userOwned;
    return ownedRows[0] || null;
}
async function getCurrentWhatsAppIntegration(req, res) {
    try {
        if (!req.user?.email) {
            return res.status(401).json({ error: 'Usuario nao autenticado' });
        }
        const platformUser = await getAuthenticatedPlatformUser(req.user.email);
        const rows = await loadCandidateWhatsAppIntegrations();
        const primary = pickPrimaryOwnedIntegration(rows, platformUser.id, platformUser.companies_id);
        return res.json({
            success: true,
            integration: primary
                ? {
                    id: primary.id,
                    phone_number: primary.phone_number,
                    app_key: primary.app_key,
                    access_token: primary.access_token,
                    auth_token: primary.auth_token,
                    provider: primary.provider,
                    created_at: primary.created_at
                }
                : null
        });
    }
    catch (error) {
        logger_1.default.error('[getCurrentWhatsAppIntegration] Erro ao carregar integracao atual', {
            error: error.message
        });
        return res.status(500).json({
            error: 'Erro ao carregar integracao WhatsApp',
            details: error.message
        });
    }
}
async function upsertCurrentWhatsAppIntegration(req, res) {
    try {
        if (!req.user?.email) {
            return res.status(401).json({ error: 'Usuario nao autenticado' });
        }
        const platformUser = await getAuthenticatedPlatformUser(req.user.email);
        const normalizedPayload = normalizeWhatsappPayload(req.body);
        const hasConfig = hasAnyWhatsAppConfig(normalizedPayload);
        const rows = await loadCandidateWhatsAppIntegrations();
        const ownedRows = rows.filter((row) => isOwnedWhatsAppIntegration(row, platformUser.id, platformUser.companies_id));
        const primaryOwned = pickPrimaryOwnedIntegration(rows, platformUser.id, platformUser.companies_id);
        const conflictingRow = rows.find((row) => {
            const samePhone = !!normalizedPayload.phone_number && row.phone_number === normalizedPayload.phone_number;
            const sameAppKey = !!normalizedPayload.app_key && row.app_key === normalizedPayload.app_key;
            return (samePhone || sameAppKey) && !isOwnedWhatsAppIntegration(row, platformUser.id, platformUser.companies_id);
        });
        if (conflictingRow) {
            return res.status(409).json({
                error: 'Este numero oficial ou Phone Number ID ja esta vinculado a outra conta.',
                code: 'WHATSAPP_INTEGRATION_CONFLICT'
            });
        }
        if (!hasConfig) {
            if (ownedRows.length > 0) {
                const { error: deleteError } = await supabase_1.supabase
                    .from('tb_integrations')
                    .delete()
                    .in('id', ownedRows.map((row) => row.id));
                if (deleteError) {
                    throw deleteError;
                }
            }
            return res.json({
                success: true,
                deleted: true,
                integration: null
            });
        }
        const integrationPayload = {
            user_id: platformUser.id,
            companies_id: platformUser.companies_id,
            provider: 'whatsapp',
            phone_number: normalizedPayload.phone_number,
            app_key: normalizedPayload.app_key,
            access_token: normalizedPayload.access_token,
            auth_token: normalizedPayload.auth_token
        };
        let integrationId = null;
        if (primaryOwned?.id) {
            const { error: updateError } = await supabase_1.supabase
                .from('tb_integrations')
                .update(integrationPayload)
                .eq('id', primaryOwned.id);
            if (updateError) {
                throw updateError;
            }
            integrationId = primaryOwned.id;
            const duplicateOwnedIds = ownedRows
                .map((row) => row.id)
                .filter((id) => id !== primaryOwned.id);
            if (duplicateOwnedIds.length > 0) {
                const { error: deleteDuplicatesError } = await supabase_1.supabase
                    .from('tb_integrations')
                    .delete()
                    .in('id', duplicateOwnedIds);
                if (deleteDuplicatesError) {
                    throw deleteDuplicatesError;
                }
            }
        }
        else {
            const { data: insertedRow, error: insertError } = await supabase_1.supabase
                .from('tb_integrations')
                .insert(integrationPayload)
                .select('id')
                .single();
            if (insertError) {
                throw insertError;
            }
            integrationId = insertedRow?.id || null;
        }
        return res.json({
            success: true,
            integration: {
                id: integrationId,
                ...integrationPayload
            }
        });
    }
    catch (error) {
        logger_1.default.error('[upsertCurrentWhatsAppIntegration] Erro ao salvar integracao atual', {
            error: error.message
        });
        return res.status(500).json({
            error: 'Erro ao salvar integracao WhatsApp',
            details: error.message
        });
    }
}
async function verifyWhatsAppWebhook(req, res) {
    const query = req.query;
    const verifyToken = await resolveStoredMetaVerifyToken(String(query['hub.verify_token'] || ''));
    const verification = (0, whatsapp_meta_1.validateMetaWebhookVerification)(query, verifyToken);
    if (verification.ok && verification.challenge) {
        logger_1.default.log('[verifyWhatsAppWebhook] Webhook da Meta verificado com sucesso');
        return res.status(200).send(verification.challenge);
    }
    if (!verifyToken) {
        logger_1.default.error('[verifyWhatsAppWebhook] WHATSAPP_META_VERIFY_TOKEN nao configurado');
        return res.status(500).json({
            error: 'WHATSAPP_META_VERIFY_TOKEN nao configurado nem salvo na integracao'
        });
    }
    logger_1.default.warn('[verifyWhatsAppWebhook] Falha na verificacao do webhook da Meta', {
        query: req.query
    });
    return res.sendStatus(403);
}
async function getWhatsAppStatus(req, res) {
    try {
        const { integration_id } = req.query;
        if (!integration_id) {
            return res.status(400).json({ error: 'integration_id e obrigatorio' });
        }
        const status = await (0, whatsapp_1.checkConnectionStatus)(integration_id);
        return res.json({
            success: true,
            status,
            message: status === 'connected'
                ? 'WhatsApp esta conectado'
                : status === 'connecting'
                    ? 'WhatsApp esta conectando...'
                    : 'WhatsApp esta desconectado. Verifique Phone Number ID, Access Token, Verify Token e o webhook da Meta.'
        });
    }
    catch (error) {
        logger_1.default.error('[getWhatsAppStatus] Erro ao verificar status', {
            error: error.message
        });
        return res.status(500).json({
            error: 'Erro ao verificar status',
            details: error.message
        });
    }
}
async function listWhatsAppIntegrations(req, res) {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ error: 'email e obrigatorio' });
        }
        const { data: userData, error: userError } = await supabase_1.supabase
            .from('tb_users')
            .select('id')
            .eq('email', email)
            .single();
        if (userError || !userData) {
            return res.status(404).json({ error: 'Usuario nao encontrado' });
        }
        const { data: integrations, error } = await supabase_1.supabase
            .from('tb_integrations')
            .select('id, phone_number, provider, created_at')
            .eq('user_id', userData.id)
            .eq('provider', 'whatsapp');
        if (error) {
            throw error;
        }
        return res.json({
            success: true,
            integrations: integrations || []
        });
    }
    catch (error) {
        logger_1.default.error('[listWhatsAppIntegrations] Erro ao listar integracoes', {
            error: error.message
        });
        return res.status(500).json({
            error: 'Erro ao listar integracoes',
            details: error.message
        });
    }
}
async function receiveWhatsAppWebhook(req, res) {
    try {
        const webhookData = req.body;
        if (!(0, whatsapp_meta_1.isMetaWebhookPayload)(webhookData)) {
            logger_1.default.warn('[receiveWhatsAppWebhook] Payload rejeitado: somente a Meta e aceita neste endpoint', {
                bodyKeys: Object.keys(webhookData || {})
            });
            return res.status(200).json({
                received: true,
                ignored: true,
                reason: 'unsupported_payload'
            });
        }
        const extractedMessages = (0, whatsapp_meta_1.extractMetaWebhookMessages)(webhookData);
        if (extractedMessages.length === 0) {
            logger_1.default.log('[receiveWhatsAppWebhook] Evento oficial da Meta recebido sem mensagens processaveis');
            return res.status(200).json({
                received: true,
                ignored: true,
                reason: 'no_messages'
            });
        }
        const processedMessages = [];
        for (const metaMessage of extractedMessages) {
            const integration = await findMetaIntegrationForMessage(metaMessage.instance, metaMessage.phoneNumberId);
            if (!integration) {
                logger_1.default.warn('[receiveWhatsAppWebhook] Integracao Meta nao encontrada para mensagem recebida', {
                    instance: metaMessage.instance,
                    phoneNumberId: metaMessage.phoneNumberId,
                    remoteJid: metaMessage.remoteJid
                });
                continue;
            }
            const normalizedPhone = normalizePhoneNumberForDatabase(metaMessage.remoteJid);
            const contactResult = await (0, whatsapp_contacts_1.createOrUpdateContact)({
                lid: normalizedPhone,
                phone_number: normalizedPhone,
                status: 'active'
            });
            if (!contactResult.success || !contactResult.contact) {
                logger_1.default.error('[receiveWhatsAppWebhook] Erro ao criar/atualizar contato Meta', {
                    integrationId: integration.id,
                    phoneNumber: normalizedPhone,
                    error: contactResult.error
                });
                continue;
            }
            await (0, whatsapp_redis_1.saveMessageToHistory)(integration.id, normalizedPhone, 'user', metaMessage.messageText);
            const contactId = contactResult.contact.id;
            let messageDbId;
            const dbResult = await (0, whatsapp_service_1.saveWhatsAppMessage)({
                whatsapp_contact_id: contactId,
                message: metaMessage.messageText,
                message_id: metaMessage.messageId,
                direction: 'inbound',
                integrations_id: integration.id
            });
            if (dbResult.success && dbResult.id) {
                messageDbId = dbResult.id;
            }
            else {
                logger_1.default.warn('[receiveWhatsAppWebhook] Falha ao salvar mensagem inbound no banco', {
                    integrationId: integration.id,
                    phoneNumber: normalizedPhone,
                    error: dbResult.error
                });
            }
            const { data: agent, error: agentError } = await supabase_1.supabase
                .from('tb_agents')
                .select('id, nome, status_id')
                .eq('integrations_id', integration.id)
                .maybeSingle();
            if (agentError) {
                logger_1.default.error('[receiveWhatsAppWebhook] Erro ao buscar agente vinculado', {
                    integrationId: integration.id,
                    error: agentError.message
                });
            }
            if (!agent?.id) {
                logger_1.default.warn('[receiveWhatsAppWebhook] Nenhum agente vinculado a integracao WhatsApp', {
                    integrationId: integration.id
                });
            }
            else if (!isAgentActive(agent.status_id)) {
                logger_1.default.warn('[receiveWhatsAppWebhook] Agente vinculado esta inativo e nao sera disparado', {
                    agentId: agent.id,
                    agentName: agent.nome,
                    status_id: agent.status_id
                });
            }
            else {
                const { data: integrationWithUser, error: integrationUserError } = await supabase_1.supabase
                    .from('tb_integrations')
                    .select(`
            user_id,
            phone_number,
            tb_users!inner(email)
          `)
                    .eq('id', integration.id)
                    .maybeSingle();
                if (integrationUserError) {
                    logger_1.default.error('[receiveWhatsAppWebhook] Erro ao buscar email do dono da integracao', {
                        integrationId: integration.id,
                        error: integrationUserError.message
                    });
                }
                else {
                    const integrationUserEmail = getIntegrationUserEmail(integrationWithUser);
                    if (integrationUserEmail) {
                        const requestStartedAt = new Date().toISOString();
                        void (async () => {
                            try {
                                const { chatWithAgent } = await Promise.resolve().then(() => __importStar(require('../../services/agents/chatwithAgent')));
                                await chatWithAgent(integrationUserEmail, agent.id, metaMessage.messageText, {
                                    channel: 'whatsapp',
                                    phone_number: metaMessage.remoteJid,
                                    from: metaMessage.remoteJid,
                                    to: String(integrationWithUser?.phone_number || metaMessage.instance || '').trim(),
                                    text: metaMessage.messageText,
                                    input: metaMessage.messageText,
                                    userMessage: metaMessage.messageText,
                                    originalMessage: metaMessage.messageText,
                                    whatsappMessage: metaMessage.messageText,
                                    whatsapp_contact_id: contactId,
                                    integrations_id: integration.id,
                                    whatsapp_message_id: messageDbId,
                                    request_started_at: requestStartedAt
                                });
                            }
                            catch (agentError) {
                                logger_1.default.error('[receiveWhatsAppWebhook] Erro ao processar agente automaticamente', {
                                    integrationId: integration.id,
                                    agentId: agent.id,
                                    error: agentError?.message
                                });
                            }
                        })();
                    }
                    else {
                        logger_1.default.warn('[receiveWhatsAppWebhook] Email do dono da integracao nao encontrado', {
                            integrationId: integration.id
                        });
                    }
                }
            }
            processedMessages.push({
                integration_id: integration.id,
                whatsapp_contact_id: contactResult.contact.id,
                message_id: metaMessage.messageId,
                phone_number: normalizedPhone
            });
        }
        return res.status(200).json({
            received: true,
            processed: processedMessages.length,
            messages: processedMessages
        });
    }
    catch (error) {
        logger_1.default.error('[receiveWhatsAppWebhook] Erro ao processar webhook oficial da Meta', {
            error: error.message,
            stack: error.stack
        });
        return res.status(500).json({
            error: 'Erro ao processar webhook',
            details: error.message
        });
    }
}
async function getWhatsAppHistoryEndpoint(req, res) {
    try {
        const { integration_id, phone_number, limit } = req.query;
        if (!integration_id || !phone_number) {
            return res.status(400).json({
                error: 'integration_id e phone_number sao obrigatorios'
            });
        }
        const history = await (0, whatsapp_redis_1.getHistoryFromRedis)(integration_id, phone_number, limit ? parseInt(limit, 10) : 20);
        return res.json({
            success: true,
            count: history.length,
            messages: history
        });
    }
    catch (error) {
        logger_1.default.error('[getWhatsAppHistoryEndpoint] Erro ao buscar historico', {
            error: error.message
        });
        return res.status(500).json({
            error: 'Erro ao buscar historico',
            details: error.message
        });
    }
}
async function processPendingWhatsAppConversations(req, res) {
    return res.json({
        success: true,
        processed: 0,
        message: 'Meta Cloud API nao utiliza processamento manual de conversas pendentes neste endpoint.'
    });
}
async function processQueueManually(req, res) {
    try {
        const { processQueue } = await Promise.resolve().then(() => __importStar(require('../../services/integrations/whatsapp/whatsapp.queue.worker')));
        const result = await processQueue();
        return res.json({
            success: true,
            processed: result.processed,
            errors: result.errors,
            message: `${result.processed} mensagem(ns) processada(s)`
        });
    }
    catch (error) {
        logger_1.default.error('[processQueueManually] Erro ao processar fila', {
            error: error.message
        });
        return res.status(500).json({
            error: 'Erro ao processar fila',
            details: error.message
        });
    }
}
async function getQueueStatsEndpoint(req, res) {
    try {
        const { getWorkerStatus } = await Promise.resolve().then(() => __importStar(require('../../services/integrations/whatsapp/whatsapp.queue.worker')));
        const { getQueueStats: getStats } = await Promise.resolve().then(() => __importStar(require('../../services/integrations/whatsapp/whatsapp.queue')));
        const stats = await getStats();
        const workerStatus = getWorkerStatus();
        return res.json({
            success: true,
            queue: stats,
            worker: workerStatus
        });
    }
    catch (error) {
        logger_1.default.error('[getQueueStatsEndpoint] Erro ao obter estatisticas da fila', {
            error: error.message
        });
        return res.status(500).json({
            error: 'Erro ao obter estatisticas da fila',
            details: error.message
        });
    }
}
async function getUnreadWhatsAppMessages(req, res) {
    try {
        const { integration_id } = req.query;
        if (!integration_id) {
            return res.status(400).json({
                error: 'integration_id e obrigatorio'
            });
        }
        const unreadNumbers = await (0, whatsapp_redis_1.getUnreadConversations)(integration_id);
        const unreadMessages = [];
        for (const conversationId of unreadNumbers) {
            const history = await (0, whatsapp_redis_1.getHistoryFromRedis)(integration_id, conversationId);
            if (history.length > 0 && history[history.length - 1].role === 'user') {
                unreadMessages.push({
                    phone_number: conversationId,
                    last_message: history[history.length - 1].content,
                    timestamp: history[history.length - 1].timestamp
                });
            }
        }
        return res.json({
            success: true,
            count: unreadMessages.length,
            conversations: unreadMessages
        });
    }
    catch (error) {
        logger_1.default.error('[getUnreadWhatsAppMessages] Erro ao buscar mensagens nao lidas', {
            error: error.message
        });
        return res.status(500).json({
            error: 'Erro ao buscar mensagens nao lidas',
            details: error.message
        });
    }
}
