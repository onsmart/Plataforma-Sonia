"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueueResponse = enqueueResponse;
exports.dequeueNextMessage = dequeueNextMessage;
exports.markMessageCompleted = markMessageCompleted;
exports.requeueMessageForRetry = requeueMessageForRetry;
exports.getQueueStats = getQueueStats;
exports.getPendingMessagesByLid = getPendingMessagesByLid;
exports.cleanOldMessages = cleanOldMessages;
const redis_1 = require("../../../lib/redis");
const logger_1 = __importDefault(require("../../../lib/logger"));
const QUEUE_KEY = 'whatsapp:response:queue';
const PROCESSING_KEY = 'whatsapp:response:processing';
const MAX_ATTEMPTS = 10; // Máximo de tentativas
const RETRY_DELAY = 5000; // 5 segundos entre tentativas
const PROCESSING_TIMEOUT = 60000; // 60 segundos para considerar como travado
/**
 * Adiciona uma mensagem à fila de respostas
 */
async function enqueueResponse(data) {
    try {
        const redis = await (0, redis_1.getRedisClient)();
        const queueId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const queuedMessage = {
            id: queueId,
            conversationId: data.conversationId,
            integrationsId: data.integrationsId,
            message: data.message,
            agentId: data.agentId,
            userEmail: data.userEmail,
            attempts: 0,
            maxAttempts: MAX_ATTEMPTS,
            createdAt: new Date().toISOString(),
            status: 'pending'
        };
        // Adiciona à fila (lista ordenada por timestamp)
        const score = Date.now();
        await redis.zAdd(QUEUE_KEY, { score, value: JSON.stringify(queuedMessage) });
        logger_1.default.log('[enqueueResponse] ✅ Mensagem adicionada à fila:', {
            queueId,
            conversationId: data.conversationId,
            status: 'pending'
        });
        return {
            success: true,
            queueId
        };
    }
    catch (error) {
        logger_1.default.error('[enqueueResponse] ❌ Erro ao adicionar à fila:', {
            error: error?.message
        });
        return {
            success: false,
            error: error?.message || 'Erro ao adicionar mensagem à fila'
        };
    }
}
/**
 * Busca próxima mensagem da fila para processar
 */
async function dequeueNextMessage() {
    try {
        const redis = await (0, redis_1.getRedisClient)();
        const now = Date.now();
        // Busca todas as mensagens ordenadas por score (timestamp)
        const messages = await redis.zRangeWithScores(QUEUE_KEY, 0, 10); // Busca até 10 para encontrar uma pendente
        if (!messages || messages.length === 0) {
            return null;
        }
        // Procura primeira mensagem pendente que já pode ser processada (score <= now)
        for (const item of messages) {
            const message = JSON.parse(item.value);
            // Verifica se não está travado (processando há muito tempo)
            if (message.status === 'processing' && message.lastAttemptAt) {
                const lastAttempt = new Date(message.lastAttemptAt).getTime();
                if (now - lastAttempt > PROCESSING_TIMEOUT) {
                    logger_1.default.warn('[dequeueNextMessage] ⚠️ Mensagem travada detectada, resetando:', {
                        queueId: message.id,
                        lastAttemptAt: message.lastAttemptAt
                    });
                    message.status = 'pending';
                    message.lastAttemptAt = undefined;
                }
            }
            // Só processa se estiver pendente e já pode ser processada (score <= now)
            if (message.status === 'pending' && item.score <= now) {
                // Marca como processando
                message.status = 'processing';
                message.lastAttemptAt = new Date().toISOString();
                message.attempts++;
                // Atualiza na fila
                const newScore = Date.now();
                await redis.zRem(QUEUE_KEY, item.value);
                await redis.zAdd(QUEUE_KEY, { score: newScore, value: JSON.stringify(message) });
                logger_1.default.log('[dequeueNextMessage] 📥 Mensagem removida da fila para processamento:', {
                    queueId: message.id,
                    conversationId: message.conversationId,
                    attempt: message.attempts
                });
                return message;
            }
        }
        // Não encontrou mensagem pendente pronta para processar
        return null;
    }
    catch (error) {
        logger_1.default.error('[dequeueNextMessage] ❌ Erro:', {
            error: error?.message
        });
        return null;
    }
}
/**
 * Marca mensagem como concluída e remove da fila
 */
async function markMessageCompleted(queueId) {
    try {
        const redis = await (0, redis_1.getRedisClient)();
        // Busca a mensagem
        const messages = await redis.zRangeWithScores(QUEUE_KEY, 0, -1);
        for (const item of messages) {
            const message = JSON.parse(item.value);
            if (message.id === queueId) {
                // Remove da fila
                await redis.zRem(QUEUE_KEY, item.value);
                logger_1.default.log('[markMessageCompleted] ✅ Mensagem concluída e removida da fila:', {
                    queueId,
                    conversationId: message.conversationId,
                    attempts: message.attempts
                });
                break;
            }
        }
    }
    catch (error) {
        logger_1.default.error('[markMessageCompleted] ❌ Erro:', {
            error: error?.message
        });
    }
}
/**
 * Recoloca mensagem na fila para retry (se não excedeu maxAttempts)
 */
async function requeueMessageForRetry(message, reason) {
    try {
        const redis = await (0, redis_1.getRedisClient)();
        // Verifica se excedeu tentativas
        if (message.attempts >= message.maxAttempts) {
            logger_1.default.error('[requeueMessageForRetry] ❌ Mensagem excedeu tentativas máximas:', {
                queueId: message.id,
                attempts: message.attempts,
                maxAttempts: message.maxAttempts,
                conversationId: message.conversationId
            });
            // Marca como falhada mas mantém na fila com delay maior
            message.status = 'failed';
            const score = Date.now() + (RETRY_DELAY * message.attempts); // Delay exponencial
            await redis.zAdd(QUEUE_KEY, { score, value: JSON.stringify(message) });
            return false;
        }
        // Reseta status para pending
        message.status = 'pending';
        message.lastAttemptAt = undefined;
        // Recoloca na fila com delay
        const delay = RETRY_DELAY * message.attempts; // Delay crescente
        const score = Date.now() + delay;
        // Remove versão antiga
        const messages = await redis.zRangeWithScores(QUEUE_KEY, 0, -1);
        for (const item of messages) {
            const oldMessage = JSON.parse(item.value);
            if (oldMessage.id === message.id) {
                await redis.zRem(QUEUE_KEY, item.value);
                break;
            }
        }
        // Adiciona novamente com delay
        await redis.zAdd(QUEUE_KEY, { score, value: JSON.stringify(message) });
        logger_1.default.log('[requeueMessageForRetry] 🔄 Mensagem recolocada na fila para retry:', {
            queueId: message.id,
            attempt: message.attempts,
            nextRetryIn: delay,
            reason
        });
        return true;
    }
    catch (error) {
        logger_1.default.error('[requeueMessageForRetry] ❌ Erro:', {
            error: error?.message
        });
        return false;
    }
}
/**
 * Obtém estatísticas da fila
 */
async function getQueueStats() {
    try {
        const redis = await (0, redis_1.getRedisClient)();
        const messages = await redis.zRangeWithScores(QUEUE_KEY, 0, -1);
        let pending = 0;
        let processing = 0;
        let failed = 0;
        for (const item of messages) {
            const message = JSON.parse(item.value);
            if (message.status === 'pending')
                pending++;
            else if (message.status === 'processing')
                processing++;
            else if (message.status === 'failed')
                failed++;
        }
        return {
            pending,
            processing,
            failed,
            total: messages.length
        };
    }
    catch (error) {
        logger_1.default.error('[getQueueStats] ❌ Erro:', {
            error: error?.message
        });
        return {
            pending: 0,
            processing: 0,
            failed: 0,
            total: 0
        };
    }
}
/**
 * Busca mensagens pendentes por LID
 */
async function getPendingMessagesByLid(lid, integrationsId) {
    try {
        const redis = await (0, redis_1.getRedisClient)();
        const messages = await redis.zRangeWithScores(QUEUE_KEY, 0, -1);
        const pendingMessages = [];
        for (const item of messages) {
            const message = JSON.parse(item.value);
            if (message.conversationId === lid &&
                message.integrationsId === integrationsId &&
                (message.status === 'pending' || message.status === 'processing')) {
                pendingMessages.push(message);
            }
        }
        logger_1.default.log('[getPendingMessagesByLid] ✅ Mensagens pendentes encontradas:', {
            lid,
            count: pendingMessages.length
        });
        return pendingMessages;
    }
    catch (error) {
        logger_1.default.error('[getPendingMessagesByLid] ❌ Erro:', {
            error: error?.message
        });
        return [];
    }
}
/**
 * Limpa mensagens antigas da fila (mais de 24 horas)
 */
async function cleanOldMessages() {
    try {
        const redis = await (0, redis_1.getRedisClient)();
        const messages = await redis.zRangeWithScores(QUEUE_KEY, 0, -1);
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 horas
        let removed = 0;
        for (const item of messages) {
            const message = JSON.parse(item.value);
            const createdAt = new Date(message.createdAt).getTime();
            if (now - createdAt > maxAge) {
                await redis.zRem(QUEUE_KEY, item.value);
                removed++;
            }
        }
        if (removed > 0) {
            logger_1.default.log('[cleanOldMessages] 🧹 Mensagens antigas removidas:', {
                count: removed
            });
        }
        return removed;
    }
    catch (error) {
        logger_1.default.error('[cleanOldMessages] ❌ Erro:', {
            error: error?.message
        });
        return 0;
    }
}
