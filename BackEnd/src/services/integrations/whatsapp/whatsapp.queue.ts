import { getRedisClient } from '../../../lib/redis'
import logger from '../../../lib/logger'

export interface QueuedMessage {
  id: string
  conversationId: string // LID ou número real
  integrationsId: string
  message: string
  agentId: string
  userEmail: string
  attempts: number
  maxAttempts: number
  createdAt: string
  lastAttemptAt?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

const QUEUE_KEY = 'whatsapp:response:queue'
const PROCESSING_KEY = 'whatsapp:response:processing'
const MAX_ATTEMPTS = 10 // Máximo de tentativas
const RETRY_DELAY = 5000 // 5 segundos entre tentativas
const PROCESSING_TIMEOUT = 60000 // 60 segundos para considerar como travado

/**
 * Adiciona uma mensagem à fila de respostas
 */
export async function enqueueResponse(data: {
  conversationId: string
  integrationsId: string
  message: string
  agentId: string
  userEmail: string
}): Promise<{ success: boolean; queueId?: string; error?: string }> {
  try {
    const redis = await getRedisClient()
    const queueId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const queuedMessage: QueuedMessage = {
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
    }

    // Adiciona à fila (lista ordenada por timestamp)
    const score = Date.now()
    await redis.zAdd(QUEUE_KEY, { score, value: JSON.stringify(queuedMessage) })

    logger.log('[enqueueResponse] ✅ Mensagem adicionada à fila:', {
      queueId,
      conversationId: data.conversationId,
      status: 'pending'
    })

    return {
      success: true,
      queueId
    }
  } catch (error: any) {
    logger.error('[enqueueResponse] ❌ Erro ao adicionar à fila:', {
      error: error?.message
    })
    return {
      success: false,
      error: error?.message || 'Erro ao adicionar mensagem à fila'
    }
  }
}

/**
 * Busca próxima mensagem da fila para processar
 */
export async function dequeueNextMessage(): Promise<QueuedMessage | null> {
  try {
    const redis = await getRedisClient()
    const now = Date.now()
    
    // Busca todas as mensagens ordenadas por score (timestamp)
    const messages = await redis.zRangeWithScores(QUEUE_KEY, 0, 10) // Busca até 10 para encontrar uma pendente
    
    if (!messages || messages.length === 0) {
      return null
    }

    // Procura primeira mensagem pendente que já pode ser processada (score <= now)
    for (const item of messages) {
      const message: QueuedMessage = JSON.parse(item.value)

      // Verifica se não está travado (processando há muito tempo)
      if (message.status === 'processing' && message.lastAttemptAt) {
        const lastAttempt = new Date(message.lastAttemptAt).getTime()
        
        if (now - lastAttempt > PROCESSING_TIMEOUT) {
          logger.warn('[dequeueNextMessage] ⚠️ Mensagem travada detectada, resetando:', {
            queueId: message.id,
            lastAttemptAt: message.lastAttemptAt
          })
          message.status = 'pending'
          message.lastAttemptAt = undefined
        }
      }

      // Só processa se estiver pendente e já pode ser processada (score <= now)
      if (message.status === 'pending' && item.score <= now) {
        // Marca como processando
        message.status = 'processing'
        message.lastAttemptAt = new Date().toISOString()
        message.attempts++

        // Atualiza na fila
        const newScore = Date.now()
        await redis.zRem(QUEUE_KEY, item.value)
        await redis.zAdd(QUEUE_KEY, { score: newScore, value: JSON.stringify(message) })

        logger.log('[dequeueNextMessage] 📥 Mensagem removida da fila para processamento:', {
          queueId: message.id,
          conversationId: message.conversationId,
          attempt: message.attempts
        })

        return message
      }
    }

    // Não encontrou mensagem pendente pronta para processar
    return null
  } catch (error: any) {
    logger.error('[dequeueNextMessage] ❌ Erro:', {
      error: error?.message
    })
    return null
  }
}

/**
 * Marca mensagem como concluída e remove da fila
 */
export async function markMessageCompleted(queueId: string): Promise<void> {
  try {
    const redis = await getRedisClient()
    
    // Busca a mensagem
    const messages = await redis.zRangeWithScores(QUEUE_KEY, 0, -1)
    
    for (const item of messages) {
      const message: QueuedMessage = JSON.parse(item.value)
      
      if (message.id === queueId) {
        // Remove da fila
        await redis.zRem(QUEUE_KEY, item.value)
        
        logger.log('[markMessageCompleted] ✅ Mensagem concluída e removida da fila:', {
          queueId,
          conversationId: message.conversationId,
          attempts: message.attempts
        })
        break
      }
    }
  } catch (error: any) {
    logger.error('[markMessageCompleted] ❌ Erro:', {
      error: error?.message
    })
  }
}

/**
 * Recoloca mensagem na fila para retry (se não excedeu maxAttempts)
 */
export async function requeueMessageForRetry(message: QueuedMessage, reason?: string): Promise<boolean> {
  try {
    const redis = await getRedisClient()
    
    // Verifica se excedeu tentativas
    if (message.attempts >= message.maxAttempts) {
      logger.error('[requeueMessageForRetry] ❌ Mensagem excedeu tentativas máximas:', {
        queueId: message.id,
        attempts: message.attempts,
        maxAttempts: message.maxAttempts,
        conversationId: message.conversationId
      })
      
      // Marca como falhada mas mantém na fila com delay maior
      message.status = 'failed'
      const score = Date.now() + (RETRY_DELAY * message.attempts) // Delay exponencial
      await redis.zAdd(QUEUE_KEY, { score, value: JSON.stringify(message) })
      
      return false
    }

    // Reseta status para pending
    message.status = 'pending'
    message.lastAttemptAt = undefined

    // Recoloca na fila com delay
    const delay = RETRY_DELAY * message.attempts // Delay crescente
    const score = Date.now() + delay
    
    // Remove versão antiga
    const messages = await redis.zRangeWithScores(QUEUE_KEY, 0, -1)
    for (const item of messages) {
      const oldMessage: QueuedMessage = JSON.parse(item.value)
      if (oldMessage.id === message.id) {
        await redis.zRem(QUEUE_KEY, item.value)
        break
      }
    }
    
    // Adiciona novamente com delay
    await redis.zAdd(QUEUE_KEY, { score, value: JSON.stringify(message) })

    logger.log('[requeueMessageForRetry] 🔄 Mensagem recolocada na fila para retry:', {
      queueId: message.id,
      attempt: message.attempts,
      nextRetryIn: delay,
      reason
    })

    return true
  } catch (error: any) {
    logger.error('[requeueMessageForRetry] ❌ Erro:', {
      error: error?.message
    })
    return false
  }
}

/**
 * Obtém estatísticas da fila
 */
export async function getQueueStats(): Promise<{
  pending: number
  processing: number
  failed: number
  total: number
}> {
  try {
    const redis = await getRedisClient()
    const messages = await redis.zRangeWithScores(QUEUE_KEY, 0, -1)
    
    let pending = 0
    let processing = 0
    let failed = 0

    for (const item of messages) {
      const message: QueuedMessage = JSON.parse(item.value)
      
      if (message.status === 'pending') pending++
      else if (message.status === 'processing') processing++
      else if (message.status === 'failed') failed++
    }

    return {
      pending,
      processing,
      failed,
      total: messages.length
    }
  } catch (error: any) {
    logger.error('[getQueueStats] ❌ Erro:', {
      error: error?.message
    })
    return {
      pending: 0,
      processing: 0,
      failed: 0,
      total: 0
    }
  }
}

/**
 * Busca mensagens pendentes por LID
 */
export async function getPendingMessagesByLid(
  lid: string,
  integrationsId: string
): Promise<QueuedMessage[]> {
  try {
    const redis = await getRedisClient()
    const messages = await redis.zRangeWithScores(QUEUE_KEY, 0, -1)
    
    const pendingMessages: QueuedMessage[] = []

    for (const item of messages) {
      const message: QueuedMessage = JSON.parse(item.value)
      
      if (
        message.conversationId === lid &&
        message.integrationsId === integrationsId &&
        (message.status === 'pending' || message.status === 'processing')
      ) {
        pendingMessages.push(message)
      }
    }

    logger.log('[getPendingMessagesByLid] ✅ Mensagens pendentes encontradas:', {
      lid,
      count: pendingMessages.length
    })

    return pendingMessages
  } catch (error: any) {
    logger.error('[getPendingMessagesByLid] ❌ Erro:', {
      error: error?.message
    })
    return []
  }
}

/**
 * Limpa mensagens antigas da fila (mais de 24 horas)
 */
export async function cleanOldMessages(): Promise<number> {
  try {
    const redis = await getRedisClient()
    const messages = await redis.zRangeWithScores(QUEUE_KEY, 0, -1)
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 horas
    
    let removed = 0

    for (const item of messages) {
      const message: QueuedMessage = JSON.parse(item.value)
      const createdAt = new Date(message.createdAt).getTime()
      
      if (now - createdAt > maxAge) {
        await redis.zRem(QUEUE_KEY, item.value)
        removed++
      }
    }

    if (removed > 0) {
      logger.log('[cleanOldMessages] 🧹 Mensagens antigas removidas:', {
        count: removed
      })
    }

    return removed
  } catch (error: any) {
    logger.error('[cleanOldMessages] ❌ Erro:', {
      error: error?.message
    })
    return 0
  }
}
