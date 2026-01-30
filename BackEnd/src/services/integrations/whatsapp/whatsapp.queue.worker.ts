import logger from '../../../lib/logger'
import { dequeueNextMessage, markMessageCompleted, requeueMessageForRetry, getQueueStats, cleanOldMessages } from './whatsapp.queue'
import { getConversationByIdentifier } from './whatsapp.conversations'
import { sendWhatsApp } from './whatsapp.service'
import { chatWithAgent } from '../../agents/chatwithAgent'
import type { QueuedMessage } from './whatsapp.queue'

let isRunning = false
let workerInterval: NodeJS.Timeout | null = null

/**
 * Processa uma mensagem da fila
 */
async function processQueuedMessage(message: QueuedMessage): Promise<boolean> {
  try {
    logger.log('[processQueuedMessage] 🔄 Processando mensagem da fila:', {
      queueId: message.id,
      conversationId: message.conversationId,
      attempt: message.attempts
    })

    // Se conversationId já é número real, tenta enviar direto
    if (message.conversationId.endsWith('@s.whatsapp.net')) {
      logger.log('[processQueuedMessage] ✅ Número real já disponível, enviando diretamente:', {
        queueId: message.id,
        phone_number: message.conversationId
      })
    } else {
      // Se ainda é LID, tenta resolver
      const conversationResult = await getConversationByIdentifier(
        message.conversationId,
        message.integrationsId
      )

      if (!conversationResult.success || !conversationResult.conversation) {
        logger.warn('[processQueuedMessage] ⚠️ Conversa não encontrada, recolocando na fila:', {
          queueId: message.id,
          conversationId: message.conversationId
        })
        await requeueMessageForRetry(message, 'Conversa não encontrada')
        return false
      }

      const conversation = conversationResult.conversation

      // Se ainda não tem número real, aguarda
      if (conversation.status !== 'ready' || !conversation.phone_number) {
        logger.log('[processQueuedMessage] ⏳ Conversa ainda pendente, aguardando número real:', {
          queueId: message.id,
          lid: conversation.lid,
          status: conversation.status
        })
        await requeueMessageForRetry(message, 'Número real ainda não disponível')
        return false
      }

      // Atualiza conversationId para número real
      message.conversationId = conversation.phone_number

      logger.log('[processQueuedMessage] ✅ Número real resolvido, atualizando mensagem:', {
        queueId: message.id,
        phone_number: conversation.phone_number
      })
    }

    // Verifica se número é válido para envio
    if (!message.conversationId.endsWith('@s.whatsapp.net')) {
      logger.error('[processQueuedMessage] ❌ Número inválido para envio:', {
        queueId: message.id,
        phone_number: message.conversationId
      })
      await requeueMessageForRetry(message, 'Número inválido')
      return false
    }

    logger.log('[processQueuedMessage] ✅ Enviando mensagem pendente:', {
      queueId: message.id,
      phone_number: message.conversationId
    })

    // Envia mensagem diretamente usando sendWhatsApp (já temos a resposta gerada)
    const { sendWhatsApp } = await import('./whatsapp.service')
    const result = await sendWhatsApp(
      message.integrationsId,
      {
        to: message.conversationId, // Agora é número real
        message: message.message, // Mensagem já gerada pela IA
        agentId: message.agentId
      }
    )

    // Verifica se foi enviado com sucesso
    if (!result.success || result.queued) {
      logger.warn('[processQueuedMessage] ⚠️ Erro ao enviar mensagem pendente, recolocando na fila:', {
        queueId: message.id,
        error: result.error,
        queued: result.queued,
        attempt: message.attempts
      })
      await requeueMessageForRetry(message, result.error || 'Erro ao enviar mensagem')
      return false
    }

    logger.log('[processQueuedMessage] ✅ Mensagem pendente enviada com sucesso:', {
      queueId: message.id,
      phone_number: message.conversationId,
      attempts: message.attempts
    })

    // Marca como concluída
    await markMessageCompleted(message.id)
    return true
  } catch (error: any) {
    logger.error('[processQueuedMessage] ❌ Erro ao processar mensagem:', {
      queueId: message.id,
      error: error?.message,
      stack: error?.stack
    })
    
    // Recoloca na fila para retry
    await requeueMessageForRetry(message, error?.message || 'Erro desconhecido')
    return false
  }
}

/**
 * Worker principal: processa mensagens da fila continuamente
 */
export async function processQueue(): Promise<{ processed: number; errors: number }> {
  if (isRunning) {
    logger.warn('[processQueue] ⚠️ Worker já está rodando')
    return { processed: 0, errors: 0 }
  }

  isRunning = true
  let processed = 0
  let errors = 0

  try {
    // Limpa mensagens antigas
    await cleanOldMessages()

    // Processa até 10 mensagens por ciclo
    const maxPerCycle = 10
    let processedThisCycle = 0

    while (processedThisCycle < maxPerCycle) {
      const message = await dequeueNextMessage()

      if (!message) {
        // Não há mais mensagens pendentes prontas para processar
        break
      }

      const success = await processQueuedMessage(message)
      
      if (success) {
        processed++
      } else {
        errors++
      }

      processedThisCycle++

      // Pequeno delay entre mensagens
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (processedThisCycle > 0) {
      logger.log('[processQueue] ✅ Ciclo de processamento concluído:', {
        processed: processedThisCycle,
        totalProcessed: processed,
        totalErrors: errors
      })
    }
  } catch (error: any) {
    logger.error('[processQueue] ❌ Erro no worker:', {
      error: error?.message
    })
    errors++
  } finally {
    isRunning = false
  }

  return { processed, errors }
}

/**
 * Inicia o worker em modo contínuo
 */
export function startQueueWorker(intervalMs: number = 2000): void {
  if (workerInterval) {
    logger.warn('[startQueueWorker] ⚠️ Worker já está rodando')
    return
  }

  logger.log('[startQueueWorker] 🚀 Iniciando worker de fila:', {
    intervalMs
  })

  workerInterval = setInterval(async () => {
    try {
      await processQueue()
    } catch (error: any) {
      logger.error('[startQueueWorker] ❌ Erro no ciclo do worker:', {
        error: error?.message
      })
    }
  }, intervalMs)

  logger.log('[startQueueWorker] ✅ Worker iniciado com sucesso')
}

/**
 * Para o worker
 */
export function stopQueueWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval)
    workerInterval = null
    isRunning = false
    logger.log('[stopQueueWorker] ✅ Worker parado')
  }
}

/**
 * Obtém status do worker
 */
export function getWorkerStatus(): { isRunning: boolean; hasInterval: boolean } {
  return {
    isRunning,
    hasInterval: workerInterval !== null
  }
}
