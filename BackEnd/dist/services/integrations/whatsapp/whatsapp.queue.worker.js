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
exports.processQueue = processQueue;
exports.startQueueWorker = startQueueWorker;
exports.stopQueueWorker = stopQueueWorker;
exports.getWorkerStatus = getWorkerStatus;
const logger_1 = __importDefault(require("../../../lib/logger"));
const whatsapp_queue_1 = require("./whatsapp.queue");
const whatsapp_conversations_1 = require("./whatsapp.conversations");
let isRunning = false;
let workerInterval = null;
/**
 * Processa uma mensagem da fila
 */
async function processQueuedMessage(message) {
    try {
        logger_1.default.log('[processQueuedMessage] 🔄 Processando mensagem da fila:', {
            queueId: message.id,
            conversationId: message.conversationId,
            attempt: message.attempts
        });
        // Se conversationId já é número real, tenta enviar direto
        if (message.conversationId.endsWith('@s.whatsapp.net')) {
            logger_1.default.log('[processQueuedMessage] ✅ Número real já disponível, enviando diretamente:', {
                queueId: message.id,
                phone_number: message.conversationId
            });
        }
        else {
            // Se ainda é LID, tenta resolver
            const conversationResult = await (0, whatsapp_conversations_1.getConversationByIdentifier)(message.conversationId, message.integrationsId);
            if (!conversationResult.success || !conversationResult.conversation) {
                logger_1.default.warn('[processQueuedMessage] ⚠️ Conversa não encontrada, recolocando na fila:', {
                    queueId: message.id,
                    conversationId: message.conversationId
                });
                await (0, whatsapp_queue_1.requeueMessageForRetry)(message, 'Conversa não encontrada');
                return false;
            }
            const conversation = conversationResult.conversation;
            // Se ainda não tem número real, aguarda
            if (conversation.status !== 'ready' || !conversation.phone_number) {
                logger_1.default.log('[processQueuedMessage] ⏳ Conversa ainda pendente, aguardando número real:', {
                    queueId: message.id,
                    lid: conversation.lid,
                    status: conversation.status
                });
                await (0, whatsapp_queue_1.requeueMessageForRetry)(message, 'Número real ainda não disponível');
                return false;
            }
            // Atualiza conversationId para número real
            message.conversationId = conversation.phone_number;
            logger_1.default.log('[processQueuedMessage] ✅ Número real resolvido, atualizando mensagem:', {
                queueId: message.id,
                phone_number: conversation.phone_number
            });
        }
        // Verifica se número é válido para envio
        if (!message.conversationId.endsWith('@s.whatsapp.net')) {
            logger_1.default.error('[processQueuedMessage] ❌ Número inválido para envio:', {
                queueId: message.id,
                phone_number: message.conversationId
            });
            await (0, whatsapp_queue_1.requeueMessageForRetry)(message, 'Número inválido');
            return false;
        }
        logger_1.default.log('[processQueuedMessage] ✅ Enviando mensagem pendente:', {
            queueId: message.id,
            phone_number: message.conversationId
        });
        // Envia mensagem diretamente usando sendWhatsApp (já temos a resposta gerada)
        const { sendWhatsApp } = await Promise.resolve().then(() => __importStar(require('./whatsapp.service')));
        const result = await sendWhatsApp(message.integrationsId, {
            to: message.conversationId, // Agora é número real
            message: message.message, // Mensagem já gerada pela IA
            agentId: message.agentId
        });
        // Verifica se foi enviado com sucesso
        if (!result.success || result.queued) {
            logger_1.default.warn('[processQueuedMessage] ⚠️ Erro ao enviar mensagem pendente, recolocando na fila:', {
                queueId: message.id,
                error: result.error,
                queued: result.queued,
                attempt: message.attempts
            });
            await (0, whatsapp_queue_1.requeueMessageForRetry)(message, result.error || 'Erro ao enviar mensagem');
            return false;
        }
        logger_1.default.log('[processQueuedMessage] ✅ Mensagem pendente enviada com sucesso:', {
            queueId: message.id,
            phone_number: message.conversationId,
            attempts: message.attempts
        });
        // Marca como concluída
        await (0, whatsapp_queue_1.markMessageCompleted)(message.id);
        return true;
    }
    catch (error) {
        logger_1.default.error('[processQueuedMessage] ❌ Erro ao processar mensagem:', {
            queueId: message.id,
            error: error?.message,
            stack: error?.stack
        });
        // Recoloca na fila para retry
        await (0, whatsapp_queue_1.requeueMessageForRetry)(message, error?.message || 'Erro desconhecido');
        return false;
    }
}
/**
 * Worker principal: processa mensagens da fila continuamente
 */
async function processQueue() {
    if (isRunning) {
        logger_1.default.warn('[processQueue] ⚠️ Worker já está rodando');
        return { processed: 0, errors: 0 };
    }
    isRunning = true;
    let processed = 0;
    let errors = 0;
    try {
        // Limpa mensagens antigas
        await (0, whatsapp_queue_1.cleanOldMessages)();
        // Processa até 10 mensagens por ciclo
        const maxPerCycle = 10;
        let processedThisCycle = 0;
        while (processedThisCycle < maxPerCycle) {
            const message = await (0, whatsapp_queue_1.dequeueNextMessage)();
            if (!message) {
                // Não há mais mensagens pendentes prontas para processar
                break;
            }
            const success = await processQueuedMessage(message);
            if (success) {
                processed++;
            }
            else {
                errors++;
            }
            processedThisCycle++;
            // Pequeno delay entre mensagens
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (processedThisCycle > 0) {
            logger_1.default.log('[processQueue] ✅ Ciclo de processamento concluído:', {
                processed: processedThisCycle,
                totalProcessed: processed,
                totalErrors: errors
            });
        }
    }
    catch (error) {
        logger_1.default.error('[processQueue] ❌ Erro no worker:', {
            error: error?.message
        });
        errors++;
    }
    finally {
        isRunning = false;
    }
    return { processed, errors };
}
/**
 * Inicia o worker em modo contínuo
 */
function startQueueWorker(intervalMs = 2000) {
    if (workerInterval) {
        logger_1.default.warn('[startQueueWorker] ⚠️ Worker já está rodando');
        return;
    }
    logger_1.default.log('[startQueueWorker] 🚀 Iniciando worker de fila:', {
        intervalMs
    });
    workerInterval = setInterval(async () => {
        try {
            await processQueue();
        }
        catch (error) {
            logger_1.default.error('[startQueueWorker] ❌ Erro no ciclo do worker:', {
                error: error?.message
            });
        }
    }, intervalMs);
    logger_1.default.log('[startQueueWorker] ✅ Worker iniciado com sucesso');
}
/**
 * Para o worker
 */
function stopQueueWorker() {
    if (workerInterval) {
        clearInterval(workerInterval);
        workerInterval = null;
        isRunning = false;
        logger_1.default.log('[stopQueueWorker] ✅ Worker parado');
    }
}
/**
 * Obtém status do worker
 */
function getWorkerStatus() {
    return {
        isRunning,
        hasInterval: workerInterval !== null
    };
}
