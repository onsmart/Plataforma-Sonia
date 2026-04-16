"use strict";
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
const whatsapp_dispatcher_1 = require("./whatsapp.dispatcher");
const whatsapp_campaign_service_1 = require("./whatsapp-campaign.service");
let isRunning = false;
let workerInterval = null;
async function processQueuedMessage(message) {
    try {
        logger_1.default.log('[processQueuedMessage] Processando mensagem da fila Meta-only', {
            queueId: message.id,
            conversationId: message.conversationId,
            attempt: message.attempts
        });
        const result = await (0, whatsapp_dispatcher_1.sendWhatsApp)(message.integrationsId, {
            to: message.conversationId,
            message: message.message,
            agentId: message.agentId
        });
        if (!result.success || result.queued) {
            logger_1.default.warn('[processQueuedMessage] Falha ao enviar mensagem da fila, recolocando', {
                queueId: message.id,
                error: result.error,
                queued: result.queued,
                attempt: message.attempts
            });
            await (0, whatsapp_queue_1.requeueMessageForRetry)(message, result.error || 'Erro ao enviar mensagem');
            return false;
        }
        await (0, whatsapp_queue_1.markMessageCompleted)(message.id);
        logger_1.default.log('[processQueuedMessage] Mensagem da fila enviada com sucesso', {
            queueId: message.id,
            messageId: result.messageId
        });
        return true;
    }
    catch (error) {
        logger_1.default.error('[processQueuedMessage] Erro ao processar mensagem da fila', {
            queueId: message.id,
            error: error?.message,
            stack: error?.stack
        });
        await (0, whatsapp_queue_1.requeueMessageForRetry)(message, error?.message || 'Erro desconhecido');
        return false;
    }
}
async function processQueue() {
    if (isRunning) {
        logger_1.default.warn('[processQueue] Worker ja esta rodando');
        return { processed: 0, errors: 0 };
    }
    isRunning = true;
    let processed = 0;
    let errors = 0;
    try {
        await (0, whatsapp_queue_1.cleanOldMessages)();
        const maxPerCycle = 10;
        let processedThisCycle = 0;
        while (processedThisCycle < maxPerCycle) {
            const message = await (0, whatsapp_queue_1.dequeueNextMessage)();
            if (!message) {
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
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (processedThisCycle > 0) {
            logger_1.default.log('[processQueue] Ciclo concluido', {
                processed: processedThisCycle,
                totalProcessed: processed,
                totalErrors: errors
            });
        }
        try {
            const camp = await (0, whatsapp_campaign_service_1.processCampaignJobsOnce)(5);
            if (camp.processed > 0 || camp.errors > 0) {
                logger_1.default.log('[processQueue] Campanhas Meta', camp);
            }
        }
        catch (campErr) {
            logger_1.default.warn('[processQueue] Campanhas: ignorado ou tabela ausente', { error: campErr?.message });
        }
    }
    catch (error) {
        logger_1.default.error('[processQueue] Erro no worker da fila', {
            error: error?.message
        });
        errors++;
    }
    finally {
        isRunning = false;
    }
    return { processed, errors };
}
function startQueueWorker(intervalMs = 2000) {
    if (workerInterval) {
        logger_1.default.warn('[startQueueWorker] Worker ja esta rodando');
        return;
    }
    logger_1.default.log('[startQueueWorker] Iniciando worker da fila WhatsApp Meta-only', {
        intervalMs
    });
    workerInterval = setInterval(async () => {
        try {
            await processQueue();
        }
        catch (error) {
            logger_1.default.error('[startQueueWorker] Erro no ciclo do worker', {
                error: error?.message
            });
        }
    }, intervalMs);
}
function stopQueueWorker() {
    if (!workerInterval) {
        return;
    }
    clearInterval(workerInterval);
    workerInterval = null;
    logger_1.default.log('[stopQueueWorker] Worker da fila parado');
}
async function getWorkerStatus() {
    return {
        isRunning,
        hasInterval: workerInterval !== null,
        queueStats: await (0, whatsapp_queue_1.getQueueStats)()
    };
}
