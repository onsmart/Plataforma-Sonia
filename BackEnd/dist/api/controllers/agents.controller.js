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
exports.listAgents = listAgents;
exports.createAgent = createAgent;
exports.updateAgent = updateAgent;
exports.activateAgent = activateAgent;
exports.agentChat = agentChat;
exports.approveDecision = approveDecision;
exports.rejectDecision = rejectDecision;
exports.assignAgent = assignAgent;
exports.deleteAgent = deleteAgent;
const agents_1 = require("../../services/agents");
const chatwithAgent_1 = require("../../services/agents/chatwithAgent");
const supabase_1 = require("../../lib/supabase");
const whatsapp_dispatcher_1 = require("../../services/integrations/whatsapp/whatsapp.dispatcher");
const company_helper_1 = require("../../utils/company-helper");
const plan_helper_1 = require("../../utils/plan-helper");
const logger_1 = __importDefault(require("../../lib/logger"));
const agent_language_1 = require("../../utils/agent-language");
function normalizeIntegrationId(value) {
    const normalized = String(value || '').trim();
    if (!normalized || normalized === 'none' || normalized === 'loading') {
        return null;
    }
    return normalized;
}
async function validateMetaWhatsAppIntegration(integrationId, companiesId) {
    const { data: integration, error } = await supabase_1.supabase
        .from('tb_integrations')
        .select('id, companies_id, provider, phone_number, app_key, access_token, auth_token')
        .eq('id', integrationId)
        .eq('companies_id', companiesId)
        .maybeSingle();
    if (error || !integration) {
        return {
            valid: false,
            error: 'Integração WhatsApp não encontrada ou não pertence à sua empresa.'
        };
    }
    if (String(integration.provider || '').trim() !== 'whatsapp') {
        return {
            valid: false,
            error: 'Somente integrações oficiais do WhatsApp pela Meta são aceitas.'
        };
    }
    const missingFields = [
        !String(integration.phone_number || '').trim() ? 'numero oficial' : null,
        !String(integration.app_key || '').trim() ? 'Phone Number ID' : null,
        !String(integration.access_token || '').trim() ? 'Access Token' : null,
        !String(integration.auth_token || '').trim() ? 'Verify Token' : null
    ].filter(Boolean);
    if (missingFields.length > 0) {
        return {
            valid: false,
            error: `Somente integrações oficiais da Meta são aceitas. Complete estes campos na integração: ${missingFields.join(', ')}.`
        };
    }
    return { valid: true };
}
async function listAgents(req, res) {
    try {
        // ✅ Email vem do middleware (validado) ou fallback para compatibilidade
        const email = req.user?.email || req.query.email;
        if (!email) {
            return res.status(401).json({
                error: 'Email é obrigatório',
                details: 'Token de autenticação inválido ou email não fornecido'
            });
        }
        const agents = await (0, agents_1.getAgentsByEmail)(email);
        return res.json(agents);
    }
    catch (error) {
        console.error('ERRO REAL DO SUPABASE:', error);
        return res.status(500).json({
            error: 'Erro ao buscar agentes',
            details: error instanceof Error ? error.message : error
        });
    }
}
/**
 * Cria um novo agente com verificação de plano
 * POST /agents/create
 */
async function createAgent(req, res) {
    try {
        // ✅ Email vem do middleware (validado) ou fallback para compatibilidade
        const email = req.user?.email || req.body.email || req.headers['x-user-email'];
        if (!email) {
            return res.status(401).json({
                error: 'Email é obrigatório',
                details: 'Token de autenticação inválido ou email não fornecido'
            });
        }
        // Verificar limite de agentes do plano
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(email);
        if (!companiesId) {
            return res.status(403).json({
                error: 'Empresa não encontrada',
                details: 'Usuário não pertence a nenhuma empresa'
            });
        }
        // ✅ Validação baseada em agentes ATIVOS (status_id = 1)
        const checkResult = await (0, plan_helper_1.canCreateAgent)(companiesId);
        if (!checkResult.allowed) {
            logger_1.default.warn('[createAgent] 🚫 Limite de agentes atingido:', {
                companiesId,
                reason: checkResult.reason
            });
            return res.status(403).json({
                error: checkResult.reason || 'Você não tem permissão para criar mais agentes. Faça upgrade do seu plano.',
                upgradePlan: checkResult.upgradePlan
            });
        }
        // Se passou na verificação, chama a RPC do banco
        const { p_nome, p_role_template_id, p_primary_language, p_bio, p_integrations_id } = req.body;
        if (!p_nome || !p_role_template_id) {
            return res.status(400).json({
                error: 'Campos obrigatórios faltando',
                details: 'p_nome e p_role_template_id são obrigatórios'
            });
        }
        const normalizedIntegrationId = normalizeIntegrationId(p_integrations_id);
        if (normalizedIntegrationId) {
            const integrationValidation = await validateMetaWhatsAppIntegration(normalizedIntegrationId, companiesId);
            if (!integrationValidation.valid) {
                return res.status(400).json({
                    error: integrationValidation.error
                });
            }
        }
        const { data, error } = await supabase_1.supabase.rpc('sp_create_agent_by_email', {
            p_email: email,
            p_nome: p_nome.trim(),
            p_role_template_id: p_role_template_id,
            p_primary_language: (0, agent_language_1.normalizeAgentLanguageCode)(p_primary_language, 'pt-BR'),
            p_bio: p_bio || '',
            p_integrations_id: normalizedIntegrationId
        });
        if (error) {
            logger_1.default.error('[createAgent] Erro na RPC:', error);
            return res.status(500).json({
                error: 'Erro ao criar agente',
                details: error.message
            });
        }
        return res.json({
            success: true,
            agent: data
        });
    }
    catch (error) {
        logger_1.default.error('[createAgent] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao criar agente',
            details: error.message
        });
    }
}
/**
 * Atualiza um agente
 * PUT /agents/:id
 */
async function updateAgent(req, res) {
    try {
        const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
        const email = req.user?.email || req.body.email || req.headers['x-user-email'];
        if (!email) {
            return res.status(401).json({
                error: 'Email é obrigatório',
                details: 'Token de autenticação inválido ou email não fornecido'
            });
        }
        if (!id) {
            return res.status(400).json({
                error: 'ID do agente é obrigatório'
            });
        }
        // Buscar companies_id
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(email);
        if (!companiesId) {
            return res.status(403).json({
                error: 'Empresa não encontrada',
                details: 'Usuário não pertence a nenhuma empresa'
            });
        }
        // Verificar se o agente pertence à empresa
        const { data: agent, error: agentError } = await supabase_1.supabase
            .from('tb_agents')
            .select('id, companies_id')
            .eq('id', id)
            .eq('companies_id', companiesId)
            .maybeSingle();
        if (agentError || !agent) {
            return res.status(404).json({
                error: 'Agente não encontrado',
                details: 'Agente não existe ou não pertence à sua empresa'
            });
        }
        // Preparar payload (remover email se vier no body)
        const { email: _, ...updatePayload } = req.body;
        const normalizedIntegrationId = Object.prototype.hasOwnProperty.call(updatePayload, 'integrations_id')
            ? normalizeIntegrationId(updatePayload.integrations_id)
            : null;
        if (Object.prototype.hasOwnProperty.call(updatePayload, 'integrations_id')) {
            updatePayload.integrations_id = normalizedIntegrationId;
        }
        if (Object.prototype.hasOwnProperty.call(updatePayload, 'primary_language')) {
            updatePayload.primary_language = (0, agent_language_1.normalizeAgentLanguageCode)(updatePayload.primary_language, 'pt-BR');
        }
        if (Object.prototype.hasOwnProperty.call(updatePayload, 'status_id')) {
            const raw = updatePayload.status_id;
            const sid = typeof raw === 'string' ? parseInt(raw, 10) : typeof raw === 'number' ? raw : Number(raw);
            if (sid === 2) {
                ;
                updatePayload.role_template_id = null;
            }
        }
        if (normalizedIntegrationId) {
            const integrationValidation = await validateMetaWhatsAppIntegration(normalizedIntegrationId, companiesId);
            if (!integrationValidation.valid) {
                return res.status(400).json({
                    error: integrationValidation.error
                });
            }
        }
        // Atualizar agente
        const { data: updatedAgent, error: updateError } = await supabase_1.supabase
            .from('tb_agents')
            .update(updatePayload)
            .eq('id', id)
            .eq('companies_id', companiesId)
            .select()
            .single();
        if (updateError) {
            logger_1.default.error('[updateAgent] Erro ao atualizar agente:', updateError);
            return res.status(500).json({
                error: 'Erro ao atualizar agente',
                details: updateError.message
            });
        }
        logger_1.default.log(`[updateAgent] ✅ Agente ${id} atualizado com sucesso`);
        return res.json({
            success: true,
            agent: updatedAgent
        });
    }
    catch (error) {
        logger_1.default.error('[updateAgent] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao atualizar agente',
            details: error.message
        });
    }
}
/**
 * Ativa um agente com validação de limite
 * PUT /agents/:id/activate
 */
async function activateAgent(req, res) {
    try {
        const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
        // ✅ Email vem do middleware (validado) ou fallback para compatibilidade
        const email = req.user?.email || req.body.email || req.headers['x-user-email'];
        if (!email) {
            return res.status(401).json({
                error: 'Email é obrigatório',
                details: 'Token de autenticação inválido ou email não fornecido'
            });
        }
        if (!id) {
            return res.status(400).json({
                error: 'ID do agente é obrigatório'
            });
        }
        // Buscar companies_id
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(email);
        if (!companiesId) {
            return res.status(403).json({
                error: 'Empresa não encontrada',
                details: 'Usuário não pertence a nenhuma empresa'
            });
        }
        // Verificar se o agente pertence à empresa
        const { data: agent, error: agentError } = await supabase_1.supabase
            .from('tb_agents')
            .select('id, nome, status_id, companies_id, integrations_id')
            .eq('id', id)
            .eq('companies_id', companiesId)
            .maybeSingle();
        if (agentError || !agent) {
            return res.status(404).json({
                error: 'Agente não encontrado',
                details: 'Agente não existe ou não pertence à sua empresa'
            });
        }
        // Se já está ativo, retorna sucesso
        if (agent.status_id === 1) {
            return res.json({
                success: true,
                message: 'Agente já está ativo',
                agent
            });
        }
        if (agent.integrations_id) {
            const integrationValidation = await validateMetaWhatsAppIntegration(String(agent.integrations_id), companiesId);
            if (!integrationValidation.valid) {
                return res.status(400).json({
                    error: integrationValidation.error
                });
            }
        }
        // ✅ VALIDAÇÃO: Verificar se pode ativar
        const checkResult = await (0, plan_helper_1.canActivateAgent)(companiesId, id);
        if (!checkResult.allowed) {
            logger_1.default.warn('[activateAgent] 🚫 Limite de agentes ativos atingido:', {
                companiesId,
                agentId: id,
                reason: checkResult.reason
            });
            return res.status(403).json({
                error: checkResult.reason || 'Você não pode ativar mais agentes. Faça upgrade do seu plano.',
                upgradePlan: checkResult.upgradePlan
            });
        }
        // Ativar agente
        const { data: updatedAgent, error: updateError } = await supabase_1.supabase
            .from('tb_agents')
            .update({ status_id: 1 })
            .eq('id', id)
            .eq('companies_id', companiesId)
            .select()
            .single();
        if (updateError) {
            logger_1.default.error('[activateAgent] Erro ao ativar agente:', updateError);
            return res.status(500).json({
                error: 'Erro ao ativar agente',
                details: updateError.message
            });
        }
        logger_1.default.log(`[activateAgent] ✅ Agente ${id} ativado com sucesso`);
        return res.json({
            success: true,
            agent: updatedAgent
        });
    }
    catch (error) {
        logger_1.default.error('[activateAgent] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao ativar agente',
            details: error.message
        });
    }
}
async function agentChat(req, res) {
    try {
        const { email, agent_id, message, context } = req.body;
        if (!email || !agent_id) {
            return res
                .status(400)
                .json({ error: 'email e agent_id são obrigatórios' });
        }
        const requestContext = {
            channel: 'webchat',
            sessionId: `agent-chat:${agent_id}:${email}`,
            ...(context || {})
        };
        const reply = await (0, chatwithAgent_1.chatWithAgent)(email, agent_id, message, requestContext);
        return res.json({ reply });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Erro ao conversar com o agente',
            details: error.message,
        });
    }
}
async function approveDecision(req, res) {
    try {
        const { id } = req.params;
        const { edited_answer, user_id } = req.body;
        if (!user_id) {
            return res.status(400).json({ error: 'user_id é obrigatório' });
        }
        if (!id) {
            return res.status(400).json({ error: 'id é obrigatório' });
        }
        // 1. Buscar decisão
        const { data: decision, error: fetchError } = await supabase_1.supabase
            .from('tb_agent_decisions')
            .select('*')
            .eq('id', id)
            .single();
        if (fetchError) {
            console.error('[approveDecision] Erro ao buscar decisão:', fetchError);
            return res.status(500).json({
                error: 'Erro ao buscar decisão',
                details: fetchError.message
            });
        }
        if (!decision) {
            return res.status(404).json({ error: 'Decisão não encontrada' });
        }
        if (decision.status !== 'pending_approval') {
            return res.status(400).json({ error: 'Decisão já foi processada' });
        }
        // 2. Atualizar decisão
        const finalAnswer = edited_answer || decision.answer;
        const wasEdited = edited_answer && edited_answer !== decision.answer;
        const updateData = {
            status: 'approved',
            approved_by: user_id,
            approved_at: new Date().toISOString(),
            approved_answer: finalAnswer
        };
        if (wasEdited) {
            updateData.edited_by = user_id;
            updateData.edited_at = new Date().toISOString();
        }
        const { error: updateError } = await supabase_1.supabase
            .from('tb_agent_decisions')
            .update(updateData)
            .eq('id', id);
        if (updateError) {
            console.error('[approveDecision] Erro ao atualizar:', updateError);
            return res.status(500).json({
                error: 'Erro ao atualizar decisão',
                details: updateError.message,
                code: updateError.code
            });
        }
        // ✅ Salvar log de aprovação
        try {
            const { saveSystemLog } = await Promise.resolve().then(() => __importStar(require('../../services/system-logs')));
            const { getUserIdAndCompanyIdByEmail } = await Promise.resolve().then(() => __importStar(require('../../utils/company-helper')));
            // Buscar email do usuário que aprovou
            const { data: userData } = await supabase_1.supabase
                .from('tb_users')
                .select('email')
                .eq('id', user_id)
                .maybeSingle();
            let companiesId = decision.companies_id;
            if (!companiesId && userData?.email) {
                const userCompanyData = await getUserIdAndCompanyIdByEmail(userData.email);
                companiesId = userCompanyData.companyId || undefined;
            }
            // Buscar nome do agente
            const { data: agentData } = await supabase_1.supabase
                .from('tb_agents')
                .select('nome')
                .eq('id', decision.agent_id)
                .maybeSingle();
            const agentName = agentData?.nome || decision.agent_id;
            const message = wasEdited
                ? `Decisão do agente "${agentName}" aprovada e editada pelo usuário`
                : `Decisão do agente "${agentName}" aprovada pelo usuário`;
            await saveSystemLog({
                companies_id: companiesId,
                user_id: user_id,
                user_email: userData?.email,
                agent_id: decision.agent_id,
                log_type: 'decision_approved',
                level: 'info',
                message,
                metadata: {
                    decision_id: id,
                    agent_id: decision.agent_id,
                    agent_name: agentName,
                    was_edited: wasEdited,
                    original_answer: decision.answer,
                    approved_answer: finalAnswer,
                    confidence_score: decision.confidence_score,
                    reason: decision.reason,
                    channel: decision.channel
                },
                impact_level: 'low'
            });
        }
        catch (logError) {
            console.warn('[approveDecision] Erro ao salvar log de aprovação:', logError);
            // Não bloqueia a aprovação se falhar ao salvar log
        }
        // 3. Enviar mensagem via canal apropriado
        if (decision.channel === 'whatsapp' && decision.integrations_id && decision.contact_id) {
            try {
                const result = await (0, whatsapp_dispatcher_1.sendWhatsApp)(decision.integrations_id, {
                    message: finalAnswer,
                    to: decision.contact_id,
                    agentId: decision.agent_id
                });
                if (!result.success) {
                    console.error('[approveDecision] Erro ao enviar WhatsApp:', result.error);
                    return res.status(500).json({
                        error: 'Erro ao enviar mensagem',
                        details: result.error
                    });
                }
            }
            catch (sendError) {
                console.error('[approveDecision] Erro ao enviar:', sendError);
                return res.status(500).json({
                    error: 'Erro ao enviar mensagem',
                    details: sendError.message
                });
            }
        }
        else if (decision.channel === 'email' && decision.contact_id) {
            // TODO: Implementar envio de email
            console.warn('[approveDecision] Envio de email ainda não implementado');
        }
        return res.json({
            success: true,
            decision_id: id,
            message: 'Decisão aprovada e mensagem enviada com sucesso'
        });
    }
    catch (error) {
        console.error('[approveDecision] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao aprovar decisão',
            details: error.message
        });
    }
}
async function rejectDecision(req, res) {
    try {
        const { id } = req.params;
        const { user_id } = req.body;
        // Buscar decisão antes de atualizar para ter os dados
        const { data: decision, error: fetchError } = await supabase_1.supabase
            .from('tb_agent_decisions')
            .select('*')
            .eq('id', id)
            .single();
        if (fetchError || !decision) {
            return res.status(404).json({ error: 'Decisão não encontrada' });
        }
        const { error } = await supabase_1.supabase
            .from('tb_agent_decisions')
            .update({
            status: 'rejected',
            rejected_at: new Date().toISOString()
            // Nota: rejected_by não existe na tabela, removido para evitar erro
        })
            .eq('id', id);
        if (error) {
            console.error('[rejectDecision] Erro:', error);
            return res.status(500).json({ error: 'Erro ao rejeitar decisão' });
        }
        // ✅ Salvar log de rejeição
        try {
            const { saveSystemLog } = await Promise.resolve().then(() => __importStar(require('../../services/system-logs')));
            const { getUserIdAndCompanyIdByEmail } = await Promise.resolve().then(() => __importStar(require('../../utils/company-helper')));
            // Buscar email do usuário que rejeitou (se tiver user_id)
            let userEmail;
            let companiesId = decision.companies_id;
            if (user_id) {
                const { data: userData } = await supabase_1.supabase
                    .from('tb_users')
                    .select('email')
                    .eq('id', user_id)
                    .maybeSingle();
                userEmail = userData?.email;
                if (!companiesId && userEmail) {
                    const userCompanyData = await getUserIdAndCompanyIdByEmail(userEmail);
                    companiesId = userCompanyData.companyId || undefined;
                }
            }
            // Buscar nome do agente
            const { data: agentData } = await supabase_1.supabase
                .from('tb_agents')
                .select('nome')
                .eq('id', decision.agent_id)
                .maybeSingle();
            const agentName = agentData?.nome || decision.agent_id;
            const message = `Decisão do agente "${agentName}" rejeitada pelo usuário`;
            await saveSystemLog({
                companies_id: companiesId,
                user_id: user_id || undefined,
                user_email: userEmail,
                agent_id: decision.agent_id,
                log_type: 'decision_rejected',
                level: 'info',
                message,
                metadata: {
                    decision_id: id,
                    agent_id: decision.agent_id,
                    agent_name: agentName,
                    original_answer: decision.answer,
                    confidence_score: decision.confidence_score,
                    reason: decision.reason,
                    channel: decision.channel
                },
                impact_level: 'low'
            });
        }
        catch (logError) {
            console.warn('[rejectDecision] Erro ao salvar log de rejeição:', logError);
            // Não bloqueia a rejeição se falhar ao salvar log
        }
        return res.json({ success: true, decision_id: id });
    }
    catch (error) {
        console.error('[rejectDecision] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao rejeitar decisão',
            details: error.message
        });
    }
}
/**
 * Atribui um agente a uma mensagem/conversação
 * PUT /agents/assign
 */
async function assignAgent(req, res) {
    try {
        const email = req.user?.email || req.body.email || req.headers['x-user-email'];
        if (!email) {
            return res.status(401).json({
                error: 'Email é obrigatório',
                details: 'Token de autenticação inválido ou email não fornecido'
            });
        }
        const { message_id, agent_id } = req.body;
        if (!message_id || !agent_id) {
            return res.status(400).json({
                error: 'Parâmetros inválidos',
                details: 'message_id e agent_id são obrigatórios'
            });
        }
        // Buscar companies_id
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(email);
        if (!companiesId) {
            return res.status(403).json({
                error: 'Empresa não encontrada',
                details: 'Usuário não pertence a nenhuma empresa'
            });
        }
        // Verificar se a mensagem existe e pertence à empresa
        const { data: message, error: messageError } = await supabase_1.supabase
            .from('tb_whatsapp_messages')
            .select('id, integrations_id')
            .eq('id', message_id)
            .maybeSingle();
        if (messageError || !message) {
            logger_1.default.error('[assignAgent] Erro ao buscar mensagem:', messageError);
            return res.status(404).json({
                error: 'Mensagem não encontrada',
                details: messageError?.message || 'A mensagem especificada não existe'
            });
        }
        // Verificar se o agente pertence à empresa
        const { data: agent, error: agentError } = await supabase_1.supabase
            .from('tb_agents')
            .select('id, companies_id')
            .eq('id', agent_id)
            .eq('companies_id', companiesId)
            .maybeSingle();
        if (agentError || !agent) {
            logger_1.default.error('[assignAgent] Erro ao buscar agente:', agentError);
            return res.status(404).json({
                error: 'Agente não encontrado',
                details: 'O agente especificado não existe ou não pertence à sua empresa'
            });
        }
        // Atualizar a mensagem com o agent_id
        const { data: updatedMessage, error: updateError } = await supabase_1.supabase
            .from('tb_whatsapp_messages')
            .update({ agent_id: agent_id })
            .eq('id', message_id)
            .select()
            .single();
        if (updateError) {
            logger_1.default.error('[assignAgent] Erro ao atualizar mensagem:', updateError);
            return res.status(500).json({
                error: 'Erro ao atribuir agente',
                details: updateError.message
            });
        }
        logger_1.default.log(`[assignAgent] ✅ Agente ${agent_id} atribuído à mensagem ${message_id} com sucesso`);
        return res.json({
            success: true,
            message: 'Agente atribuído com sucesso',
            data: updatedMessage
        });
    }
    catch (error) {
        logger_1.default.error('[assignAgent] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao atribuir agente',
            details: error.message
        });
    }
}
/**
 * Exclusão permanente do agente (admin).
 * DELETE /agents/:id
 */
async function deleteAgent(req, res) {
    try {
        const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
        const email = req.user?.email || req.headers['x-user-email'];
        if (!email) {
            return res.status(401).json({
                error: 'Email é obrigatório',
                details: 'Token de autenticação inválido ou email não fornecido',
            });
        }
        if (!id) {
            return res.status(400).json({ error: 'ID do agente é obrigatório' });
        }
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(email);
        if (!companiesId) {
            return res.status(403).json({
                error: 'Empresa não encontrada',
                details: 'Usuário não pertence a nenhuma empresa',
            });
        }
        const { data: agent, error: agentError } = await supabase_1.supabase
            .from('tb_agents')
            .select('id, companies_id')
            .eq('id', id)
            .eq('companies_id', companiesId)
            .maybeSingle();
        if (agentError || !agent) {
            return res.status(404).json({
                error: 'Agente não encontrado',
                details: 'Agente não existe ou não pertence à sua empresa',
            });
        }
        const { hardDeleteAgent } = await Promise.resolve().then(() => __importStar(require('../../services/agents/agent-delete.service')));
        const result = await hardDeleteAgent(id, companiesId);
        if (!result.ok) {
            return res.status(result.status).json({
                error: result.error,
                details: result.details,
            });
        }
        return res.json({ success: true, deletedId: id });
    }
    catch (error) {
        logger_1.default.error('[deleteAgent] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao excluir agente',
            details: error instanceof Error ? error.message : String(error),
        });
    }
}
