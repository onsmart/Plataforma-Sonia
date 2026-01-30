import { getRedisClient } from '../../../lib/redis'
import logger from '../../../lib/logger'

const MAX_HISTORY_MESSAGES = 20
const DEFAULT_TTL = parseInt(process.env.WHATSAPP_HISTORY_TTL || '86400', 10) // 24 horas padrão

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

/**
 * Gera a chave Redis para uma conversa
 */
function getConversationKey(integrationId: string, phoneNumber: string): string {
  // Normaliza o número (remove caracteres não numéricos)
  const normalizedPhone = phoneNumber.replace(/\D/g, '')
  return `whatsapp:conversation:${integrationId}:${normalizedPhone}`
}

/**
 * Salva uma mensagem no histórico Redis
 * @param integrationId - ID da integração
 * @param phoneNumber - Número de telefone
 * @param role - 'user' ou 'assistant'
 * @param content - Conteúdo da mensagem
 */
export async function saveMessageToHistory(
  integrationId: string,
  phoneNumber: string,
  role: 'user' | 'assistant',
  content: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!content || content.trim() === '') {
      logger.warn('[saveMessageToHistory] ⚠️ Mensagem vazia, ignorando')
      return { success: true } // Não é erro, apenas ignora
    }

    const client = await getRedisClient()
    const key = getConversationKey(integrationId, phoneNumber)

    // Busca histórico atual
    const existingHistory = await getHistoryFromRedis(integrationId, phoneNumber)

    // Adiciona nova mensagem
    const newMessage: ConversationMessage = {
      role,
      content: content.trim(),
      timestamp: Date.now()
    }

    const updatedHistory = [...existingHistory, newMessage]

    // Mantém apenas as últimas MAX_HISTORY_MESSAGES mensagens
    const trimmedHistory = updatedHistory.slice(-MAX_HISTORY_MESSAGES)

    // Salva no Redis com TTL
    await client.setEx(
      key,
      DEFAULT_TTL,
      JSON.stringify(trimmedHistory)
    )

    logger.log('[saveMessageToHistory] ✅ Mensagem salva no Redis:', {
      integrationId,
      phoneNumber: phoneNumber.replace(/\D/g, ''),
      role,
      contentLength: content.length,
      totalMessages: trimmedHistory.length
    })

    return { success: true }
  } catch (error: any) {
    logger.error('[saveMessageToHistory] ❌ Erro ao salvar no Redis:', {
      error: error.message,
      stack: error.stack
    })
    return {
      success: false,
      error: error.message || 'Erro ao salvar mensagem no Redis'
    }
  }
}

/**
 * Busca histórico de conversa do Redis
 * @param integrationId - ID da integração
 * @param phoneNumber - Número de telefone
 * @param limit - Limite de mensagens (padrão: todas)
 */
export async function getHistoryFromRedis(
  integrationId: string,
  phoneNumber: string,
  limit?: number
): Promise<ConversationMessage[]> {
  try {
    const client = await getRedisClient()
    const key = getConversationKey(integrationId, phoneNumber)

    const data = await client.get(key)

    if (!data) {
      logger.log('[getHistoryFromRedis] 📭 Nenhum histórico encontrado:', {
        integrationId,
        phoneNumber: phoneNumber.replace(/\D/g, '')
      })
      return []
    }

    const history: ConversationMessage[] = JSON.parse(data)

    // Aplica limite se fornecido
    const limitedHistory = limit ? history.slice(-limit) : history

    logger.log('[getHistoryFromRedis] ✅ Histórico encontrado:', {
      integrationId,
      phoneNumber: phoneNumber.replace(/\D/g, ''),
      totalMessages: history.length,
      returnedMessages: limitedHistory.length
    })

    return limitedHistory
  } catch (error: any) {
    logger.error('[getHistoryFromRedis] ❌ Erro ao buscar do Redis:', {
      error: error.message
    })
    return []
  }
}

/**
 * Busca todas as conversas não lidas (com mensagens de usuário não respondidas)
 * Retorna lista de números com mensagens não lidas
 */
export async function getUnreadConversations(
  integrationId: string
): Promise<string[]> {
  try {
    const client = await getRedisClient()
    const pattern = `whatsapp:conversation:${integrationId}:*`

    // Busca todas as chaves que correspondem ao padrão
    const keys = await client.keys(pattern)

    const unreadNumbers: string[] = []

    for (const key of keys) {
      const data = await client.get(key)
      if (!data) continue

      const history: ConversationMessage[] = JSON.parse(data)

      // Verifica se a última mensagem é do usuário (não respondida)
      if (history.length > 0 && history[history.length - 1].role === 'user') {
        // Extrai o número da chave
        const phoneNumber = key.split(':').pop() || ''
        if (phoneNumber) {
          unreadNumbers.push(phoneNumber)
        }
      }
    }

    logger.log('[getUnreadConversations] ✅ Conversas não lidas encontradas:', {
      integrationId,
      count: unreadNumbers.length
    })

    return unreadNumbers
  } catch (error: any) {
    logger.error('[getUnreadConversations] ❌ Erro:', {
      error: error.message
    })
    return []
  }
}

/**
 * Limpa o histórico de uma conversa
 */
export async function clearHistory(
  integrationId: string,
  phoneNumber: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getRedisClient()
    const key = getConversationKey(integrationId, phoneNumber)

    await client.del(key)

    logger.log('[clearHistory] ✅ Histórico limpo:', {
      integrationId,
      phoneNumber: phoneNumber.replace(/\D/g, '')
    })

    return { success: true }
  } catch (error: any) {
    logger.error('[clearHistory] ❌ Erro:', {
      error: error.message
    })
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Marca mensagens como lidas (remove última mensagem do usuário se não foi respondida)
 * Na prática, isso significa que a próxima mensagem do assistente vai "responder" a anterior
 */
export async function markConversationAsRead(
  integrationId: string,
  phoneNumber: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const history = await getHistoryFromRedis(integrationId, phoneNumber)

    // Se a última mensagem é do usuário, não faz nada (já está "não lida")
    // A marcação como lida acontece quando o assistente responde
    // Então esta função é mais para compatibilidade

    logger.log('[markConversationAsRead] ✅ Conversa processada:', {
      integrationId,
      phoneNumber: phoneNumber.replace(/\D/g, ''),
      totalMessages: history.length
    })

    return { success: true }
  } catch (error: any) {
    logger.error('[markConversationAsRead] ❌ Erro:', {
      error: error.message
    })
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Gera a chave Redis para mapeamento LID → número real
 */
function getLidMappingKey(lid: string): string {
  // Remove sufixos para normalizar
  const normalizedLid = lid.replace(/@lid$/, '').replace(/\D/g, '')
  return `whatsapp:lid_mapping:${normalizedLid}`
}

/**
 * Salva o mapeamento LID → número real no Redis
 * @param lid - O LID (ex: "145479333621989@lid")
 * @param realPhoneNumber - O número real (ex: "5511999241987@s.whatsapp.net" ou "5511999241987")
 */
export async function saveLidToRealNumberMapping(
  lid: string,
  realPhoneNumber: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getRedisClient()
    
    // Normaliza o LID (remove @lid e caracteres não numéricos)
    const normalizedLid = lid.replace(/@lid$/, '').replace(/\D/g, '')
    
    // Normaliza o número real (garante que tenha @s.whatsapp.net)
    let normalizedRealNumber = realPhoneNumber
    if (!normalizedRealNumber.includes('@')) {
      normalizedRealNumber = `${normalizedRealNumber}@s.whatsapp.net`
    }
    
    const key = getLidMappingKey(normalizedLid)
    
    // Salva com TTL de 7 dias (604800 segundos)
    await client.setEx(key, 604800, normalizedRealNumber)
    
    console.log('\n' + '='.repeat(80))
    console.log('💾 [saveLidToRealNumberMapping] MAPEAMENTO SALVO NO REDIS:')
    console.log('='.repeat(80))
    console.log('LID:', lid)
    console.log('LID Normalizado:', normalizedLid)
    console.log('Número Real:', realPhoneNumber)
    console.log('Número Real Normalizado:', normalizedRealNumber)
    console.log('Chave Redis:', key)
    console.log('TTL: 7 dias (604800 segundos)')
    console.log('='.repeat(80) + '\n')
    
    logger.log('[saveLidToRealNumberMapping] ✅ Mapeamento salvo:', {
      lid,
      normalizedLid,
      realPhoneNumber,
      normalizedRealNumber
    })
    
    return { success: true }
  } catch (error: any) {
    logger.error('[saveLidToRealNumberMapping] ❌ Erro ao salvar mapeamento:', {
      error: error.message,
      lid
    })
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Busca o número real correspondente a um LID
 * @param lid - O LID (ex: "145479333621989@lid" ou "145479333621989")
 * @returns O número real com @s.whatsapp.net ou null se não encontrado
 */
export async function getRealNumberFromLid(
  lid: string
): Promise<string | null> {
  try {
    const client = await getRedisClient()
    
    // Normaliza o LID
    const normalizedLid = lid.replace(/@lid$/, '').replace(/\D/g, '')
    const key = getLidMappingKey(normalizedLid)
    
    const realNumber = await client.get(key)
    
    if (realNumber) {
      console.log('\n' + '='.repeat(80))
      console.log('🔍 [getRealNumberFromLid] MAPEAMENTO ENCONTRADO NO REDIS:')
      console.log('='.repeat(80))
      console.log('LID Buscado:', lid)
      console.log('LID Normalizado:', normalizedLid)
      console.log('Número Real Encontrado:', realNumber)
      console.log('Chave Redis:', key)
      console.log('='.repeat(80) + '\n')
      
      logger.log('[getRealNumberFromLid] ✅ Mapeamento encontrado:', {
        lid,
        normalizedLid,
        realNumber
      })
      
      return realNumber
    }
    
    console.log('\n' + '='.repeat(80))
    console.log('⚠️ [getRealNumberFromLid] MAPEAMENTO NÃO ENCONTRADO:')
    console.log('='.repeat(80))
    console.log('LID Buscado:', lid)
    console.log('LID Normalizado:', normalizedLid)
    console.log('Chave Redis:', key)
    console.log('='.repeat(80) + '\n')
    
    logger.log('[getRealNumberFromLid] ⚠️ Mapeamento não encontrado:', {
      lid,
      normalizedLid
    })
    
    return null
  } catch (error: any) {
    logger.error('[getRealNumberFromLid] ❌ Erro ao buscar mapeamento:', {
      error: error.message,
      lid
    })
    return null
  }
}
