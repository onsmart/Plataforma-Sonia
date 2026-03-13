"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processPendingConversation = processPendingConversation;
exports.processPendingConversations = processPendingConversations;
const logger_1 = __importDefault(require("../../../lib/logger"));
const whatsapp_conversations_1 = require("./whatsapp.conversations");
const whatsapp_redis_1 = require("./whatsapp.redis");
const supabase_1 = require("../../../lib/supabase");
const chatwithAgent_1 = require("../../agents/chatwithAgent");
/**
 * Processa uma conversa pendente e envia resposta quando número real estiver disponível
 */
async function processPendingConversation(conversationId, integrationsId, maxRetries = 15, // 30 segundos (15 * 2s)
retryInterval = 2000 // 2 segundos
) {
    try {
        logger_1.default.log('[processPendingConversation] 🔄 Processando conversa pendente:', {
            conversationId,
            integrationsId,
            maxRetries
        });
        // Busca a conversa
        const conversationResult = await (0, whatsapp_conversations_1.getConversationByIdentifier)(conversationId, integrationsId);
        if (!conversationResult.success || !conversationResult.conversation) {
            return {
                success: false,
                error: 'Conversa não encontrada'
            };
        }
        const conversation = conversationResult.conversation;
        // Se já tem número real e está ready, processa
        if (conversation.status === 'ready' && conversation.phone_number) {
            logger_1.default.log('[processPendingConversation] ✅ Conversa pronta, processando resposta:', {
                phone_number: conversation.phone_number
            });
            return await sendResponseToConversation(conversation, integrationsId);
        }
        // Se ainda está pending, tenta aguardar número aparecer
        if (conversation.status === 'pending') {
            logger_1.default.log('[processPendingConversation] ⏳ Conversa pendente, aguardando número real...', {
                lid: conversation.lid
            });
            // Retry: verifica a cada 2 segundos se número apareceu
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                await new Promise(resolve => setTimeout(resolve, retryInterval));
                // Busca conversa novamente
                const updatedResult = await (0, whatsapp_conversations_1.getConversationByIdentifier)(conversationId, integrationsId);
                if (updatedResult.success && updatedResult.conversation) {
                    const updated = updatedResult.conversation;
                    if (updated.status === 'ready' && updated.phone_number) {
                        logger_1.default.log('[processPendingConversation] ✅ Número real encontrado após retry:', {
                            attempt,
                            phone_number: updated.phone_number
                        });
                        return await sendResponseToConversation(updated, integrationsId);
                    }
                }
                logger_1.default.log('[processPendingConversation] ⏳ Aguardando número real...', {
                    attempt,
                    maxRetries
                });
            }
            logger_1.default.warn('[processPendingConversation] ⚠️ Timeout: número real não apareceu após 30 segundos:', {
                conversationId
            });
            return {
                success: false,
                error: 'Timeout: número real não disponível após 30 segundos'
            };
        }
        return {
            success: false,
            error: 'Conversa não está pronta para processamento'
        };
    }
    catch (error) {
        logger_1.default.error('[processPendingConversation] ❌ Erro:', {
            message: error?.message,
            stack: error?.stack
        });
        return {
            success: false,
            error: error?.message || 'Erro desconhecido ao processar conversa'
        };
    }
}
/**
 * Envia resposta para uma conversa pronta
 */
async function sendResponseToConversation(conversation, integrationsId) {
    try {
        // Verifica se tem número real
        if (!conversation.phone_number || !conversation.phone_number.endsWith('@s.whatsapp.net')) {
            logger_1.default.error('[sendResponseToConversation] ❌ Número inválido para envio:', {
                phone_number: conversation.phone_number
            });
            return {
                success: false,
                error: 'Número inválido: deve terminar com @s.whatsapp.net'
            };
        }
        // Busca última mensagem recebida desta conversa
        const { data: messages, error: messagesError } = await supabase_1.supabase
            .from('tb_whatsapp_messages')
            .select('*')
            .eq('conversation_id', conversation.id)
            .eq('direction', 'inbound')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (messagesError || !messages) {
            logger_1.default.warn('[sendResponseToConversation] ⚠️ Nenhuma mensagem encontrada para responder:', {
                conversationId: conversation.id
            });
            return {
                success: false,
                error: 'Nenhuma mensagem encontrada para responder'
            };
        }
        // Busca integração para obter agent_id
        const { data: integration, error: integrationError } = await supabase_1.supabase
            .from('tb_integrations')
            .select('agent_id, user_id')
            .eq('id', integrationsId)
            .single();
        if (integrationError || !integration?.agent_id) {
            logger_1.default.warn('[sendResponseToConversation] ⚠️ Agente não configurado para esta integração');
            return {
                success: false,
                error: 'Agente não configurado'
            };
        }
        // 🛡️ GUARDRAIL: Valida status_id do agente ANTES de processar
        const { data: agentData, error: agentError } = await supabase_1.supabase
            .from('tb_agents')
            .select('id, nome, status_id, user_id')
            .eq('id', integration.agent_id)
            .maybeSingle();
        if (agentError || !agentData) {
            logger_1.default.error('[sendResponseToConversation] ❌ Erro ao buscar agente:', agentError);
            return {
                success: false,
                error: 'Agente não encontrado'
            };
        }
        // Valida status_id: 1=ativo, 2=cancelado, 3=pausado, 4=pausado
        const statusId = agentData.status_id !== null && agentData.status_id !== undefined
            ? (typeof agentData.status_id === 'string' ? parseInt(agentData.status_id, 10) : Number(agentData.status_id))
            : null;
        if (statusId !== 1) {
            const reason = statusId === 2 ? 'cancelado' : statusId === 3 || statusId === 4 ? 'pausado' : 'inativo';
            logger_1.default.warn('[sendResponseToConversation] 🛡️ GUARDRAIL: Agente bloqueado - não está ativo:', {
                agentId: agentData.id,
                agentNome: agentData.nome,
                status_id: statusId,
                reason
            });
            return {
                success: false,
                error: `Agente ${agentData.nome || 'indisponível'} está ${reason} e não pode responder no momento.`
            };
        }
        // Busca histórico do Redis
        const history = await (0, whatsapp_redis_1.getHistoryFromRedis)(integrationsId, conversation.phone_number, 10);
        // Gera resposta usando o agente
        logger_1.default.log('[sendResponseToConversation] 🤖 Gerando resposta com agente:', {
            agentId: integration.agent_id,
            agentNome: agentData.nome,
            status_id: agentData.status_id,
            message: messages.message
        });
        // Busca email do usuário para passar ao chatWithAgent
        let userEmail = '';
        if (integration.user_id) {
            const { data: userData } = await supabase_1.supabase
                .from('tb_users')
                .select('email')
                .eq('id', integration.user_id)
                .maybeSingle();
            userEmail = userData?.email || '';
        }
        // Marca início da requisição para calcular tempo de resposta
        const requestStartedAt = new Date().toISOString();
        // Usa chatWithAgent para gerar e enviar resposta
        const response = await (0, chatwithAgent_1.chatWithAgent)(userEmail, // Passa email do usuário
        integration.agent_id, messages.message, {
            phone_number: conversation.phone_number,
            conversation_id: conversation.id,
            request_started_at: requestStartedAt // Para calcular tempo de resposta
        });
        logger_1.default.log('[sendResponseToConversation] ✅ Resposta processada:', {
            success: !response.includes('❌')
        });
        return {
            success: !response.includes('❌')
        };
    }
    catch (error) {
        logger_1.default.error('[sendResponseToConversation] ❌ Erro:', {
            message: error?.message
        });
        return {
            success: false,
            error: error?.message || 'Erro ao enviar resposta'
        };
    }
}
/**
 * Worker principal: processa todas as conversas pendentes
 */
async function processPendingConversations(integrationsId) {
    try {
        logger_1.default.log('[processPendingConversations] 🔄 Iniciando processamento de conversas pendentes...');
        const result = await (0, whatsapp_conversations_1.getPendingConversations)(integrationsId, 50);
        if (!result.success || !result.conversations) {
            return {
                success: false,
                processed: 0,
                error: result.error
            };
        }
        const conversations = result.conversations;
        let processed = 0;
        for (const conversation of conversations) {
            const identifier = conversation.phone_number || conversation.lid || '';
            if (!identifier)
                continue;
            const processResult = await processPendingConversation(identifier, conversation.integrations_id);
            if (processResult.success) {
                processed++;
            }
        }
        logger_1.default.log('[processPendingConversations] ✅ Processamento concluído:', {
            total: conversations.length,
            processed
        });
        return {
            success: true,
            processed
        };
    }
    catch (error) {
        logger_1.default.error('[processPendingConversations] ❌ Erro:', {
            message: error?.message
        });
        return {
            success: false,
            processed: 0,
            error: error?.message || 'Erro ao processar conversas pendentes'
        };
    }
}
