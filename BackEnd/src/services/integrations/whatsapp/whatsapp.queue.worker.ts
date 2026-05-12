import logger from '../../../lib/logger'
import { dequeueNextMessage, markMessageCompleted, requeueMessageForRetry, getQueueStats, cleanOldMessages } from './whatsapp.queue'
import { sendWhatsApp } from './whatsapp.dispatcher'
import type { QueuedMessage } from './whatsapp.queue'
import { processCampaignJobsOnce } from './whatsapp-campaign.service'
import { processEmailAudienceJobsOnce } from '../email/email-audience.service'
import { processFlowScheduleJobsOnce } from '../../flows/flow-scheduler.service'

let isRunning = false
let workerInterval: NodeJS.Timeout | null = null

async function processQueuedMessage(message: QueuedMessage): Promise<boolean> {
  try {
    logger.log('[processQueuedMessage] Processando mensagem da fila Meta-only', {
      queueId: message.id,
      conversationId: message.conversationId,
      attempt: message.attempts
    })

    const result = await sendWhatsApp(message.integrationsId, {
      to: message.conversationId,
      message: message.message,
      agentId: message.agentId
    })

    if (!result.success || result.queued) {
      logger.warn('[processQueuedMessage] Falha ao enviar mensagem da fila, recolocando', {
        queueId: message.id,
        error: result.error,
        queued: result.queued,
        attempt: message.attempts
      })
      await requeueMessageForRetry(message, result.error || 'Erro ao enviar mensagem')
      return false
    }

    await markMessageCompleted(message.id)

    logger.log('[processQueuedMessage] Mensagem da fila enviada com sucesso', {
      queueId: message.id,
      messageId: result.messageId
    })

    return true
  } catch (error: any) {
    logger.error('[processQueuedMessage] Erro ao processar mensagem da fila', {
      queueId: message.id,
      error: error?.message,
      stack: error?.stack
    })

    await requeueMessageForRetry(message, error?.message || 'Erro desconhecido')
    return false
  }
}

export async function processQueue(): Promise<{ processed: number; errors: number }> {
  if (isRunning) {
    logger.warn('[processQueue] Worker ja esta rodando')
    return { processed: 0, errors: 0 }
  }

  isRunning = true
  let processed = 0
  let errors = 0

  try {
    await cleanOldMessages()

    const maxPerCycle = 10
    let processedThisCycle = 0

    while (processedThisCycle < maxPerCycle) {
      const message = await dequeueNextMessage()
      if (!message) {
        break
      }

      const success = await processQueuedMessage(message)
      if (success) {
        processed++
      } else {
        errors++
      }

      processedThisCycle++
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (processedThisCycle > 0) {
      logger.log('[processQueue] Ciclo concluido', {
        processed: processedThisCycle,
        totalProcessed: processed,
        totalErrors: errors
      })
    }

    try {
      const camp = await processCampaignJobsOnce(5)
      if (camp.processed > 0 || camp.errors > 0) {
        logger.log('[processQueue] Campanhas Meta', camp)
      }
    } catch (campErr: any) {
      logger.warn('[processQueue] Campanhas: ignorado ou tabela ausente', { error: campErr?.message })
    }

    try {
      const flowJobs = await processFlowScheduleJobsOnce(5)
      if (flowJobs.processed > 0 || flowJobs.errors > 0) {
        logger.log('[processQueue] Flow scheduler', flowJobs)
      }
    } catch (flowErr: any) {
      logger.warn('[processQueue] Flow scheduler: ignorado ou tabela ausente', { error: flowErr?.message })
    }

    try {
      const emailJobs = await processEmailAudienceJobsOnce(5)
      if (emailJobs.processed > 0 || emailJobs.errors > 0) {
        logger.log('[processQueue] Email audience', emailJobs)
      }
    } catch (emailErr: any) {
      logger.warn('[processQueue] Email audience: ignorado ou tabela ausente', { error: emailErr?.message })
    }
  } catch (error: any) {
    logger.error('[processQueue] Erro no worker da fila', {
      error: error?.message
    })
    errors++
  } finally {
    isRunning = false
  }

  return { processed, errors }
}

export function startQueueWorker(intervalMs: number = 2000): void {
  if (workerInterval) {
    logger.warn('[startQueueWorker] Worker ja esta rodando')
    return
  }

  logger.log('[startQueueWorker] Iniciando worker da fila WhatsApp Meta-only', {
    intervalMs
  })

  workerInterval = setInterval(async () => {
    try {
      await processQueue()
    } catch (error: any) {
      logger.error('[startQueueWorker] Erro no ciclo do worker', {
        error: error?.message
      })
    }
  }, intervalMs)
}

export function stopQueueWorker(): void {
  if (!workerInterval) {
    return
  }

  clearInterval(workerInterval)
  workerInterval = null
  logger.log('[stopQueueWorker] Worker da fila parado')
}

export async function getWorkerStatus(): Promise<{
  isRunning: boolean
  hasInterval: boolean
  queueStats: any
}> {
  return {
    isRunning,
    hasInterval: workerInterval !== null,
    queueStats: await getQueueStats()
  }
}
