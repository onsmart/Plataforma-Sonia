import logger from '../../../lib/logger'
import { getPendingConversations, getConversationByIdentifier } from './whatsapp.conversations'
import { sendWhatsApp } from './whatsapp.service'
import { getHistoryFromRedis } from './whatsapp.redis'
import { supabase } from '../../../lib/supabase'
import { chatWithAgent } from '../../agents/chatwithAgent'

/**
 * Processa uma conversa pendente e envia resposta quando número real estiver disponível
 */
export async function processPendingConversation(
  conversationId: string,
  integrationsId: string,
  maxRetries: number = 15, // 30 segundos (15 * 2s)
  retryInterval: number = 2000 // 2 segundos
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.log('[processPendingConversation] 🔄 Processando conversa pendente:', {
      conversationId,
      integrationsId,
      maxRetries
    })

    // Busca a conversa
    const conversationResult = await getConversationByIdentifier(conversationId, integrationsId)
    
    if (!conversationResult.success || !conversationResult.conversation) {
      return {
        success: false,
        error: 'Conversa não encontrada'
      }
    }

    const conversation = conversationResult.conversation

    // Se já tem número real e está ready, processa
    if (conversation.status === 'ready' && conversation.phone_number) {
      logger.log('[processPendingConversation] ✅ Conversa pronta, processando resposta:', {
        phone_number: conversation.phone_number
      })
      return await sendResponseToConversation(conversation, integrationsId)
    }

    // Se ainda está pending, tenta aguardar número aparecer
    if (conversation.status === 'pending') {
      logger.log('[processPendingConversation] ⏳ Conversa pendente, aguardando número real...', {
        lid: conversation.lid
      })

      // Retry: verifica a cada 2 segundos se número apareceu
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        await new Promise(resolve => setTimeout(resolve, retryInterval))

        // Busca conversa novamente
        const updatedResult = await getConversationByIdentifier(conversationId, integrationsId)
        
        if (updatedResult.success && updatedResult.conversation) {
          const updated = updatedResult.conversation
          
          if (updated.status === 'ready' && updated.phone_number) {
            logger.log('[processPendingConversation] ✅ Número real encontrado após retry:', {
              attempt,
              phone_number: updated.phone_number
            })
            return await sendResponseToConversation(updated, integrationsId)
          }
        }

        logger.log('[processPendingConversation] ⏳ Aguardando número real...', {
          attempt,
          maxRetries
        })
      }

      logger.warn('[processPendingConversation] ⚠️ Timeout: número real não apareceu após 30 segundos:', {
        conversationId
      })
      return {
        success: false,
        error: 'Timeout: número real não disponível após 30 segundos'
      }
    }

    return {
      success: false,
      error: 'Conversa não está pronta para processamento'
    }
  } catch (error: any) {
    logger.error('[processPendingConversation] ❌ Erro:', {
      message: error?.message,
      stack: error?.stack
    })
    return {
      success: false,
      error: error?.message || 'Erro desconhecido ao processar conversa'
    }
  }
}

/**
 * Envia resposta para uma conversa pronta
 */
async function sendResponseToConversation(
  conversation: any,
  integrationsId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verifica se tem número real
    if (!conversation.phone_number || !conversation.phone_number.endsWith('@s.whatsapp.net')) {
      logger.error('[sendResponseToConversation] ❌ Número inválido para envio:', {
        phone_number: conversation.phone_number
      })
      return {
        success: false,
        error: 'Número inválido: deve terminar com @s.whatsapp.net'
      }
    }

    // Busca última mensagem recebida desta conversa
    const { data: messages, error: messagesError } = await supabase
      .from('tb_whatsapp_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (messagesError || !messages) {
      logger.warn('[sendResponseToConversation] ⚠️ Nenhuma mensagem encontrada para responder:', {
        conversationId: conversation.id
      })
      return {
        success: false,
        error: 'Nenhuma mensagem encontrada para responder'
      }
    }

    // Busca integração para obter agent_id
    const { data: integration, error: integrationError } = await supabase
      .from('tb_integrations')
      .select('agent_id')
      .eq('id', integrationsId)
      .single()

    if (integrationError || !integration?.agent_id) {
      logger.warn('[sendResponseToConversation] ⚠️ Agente não configurado para esta integração')
      return {
        success: false,
        error: 'Agente não configurado'
      }
    }

    // Busca histórico do Redis
    const history = await getHistoryFromRedis(
      integrationsId,
      conversation.phone_number,
      10
    )

    // Gera resposta usando o agente
    logger.log('[sendResponseToConversation] 🤖 Gerando resposta com agente:', {
      agentId: integration.agent_id,
      message: messages.message
    })

    // Usa chatWithAgent para gerar e enviar resposta
    const response = await chatWithAgent(
      '', // email não necessário aqui
      integration.agent_id,
      messages.message,
      {
        phone_number: conversation.phone_number,
        conversation_id: conversation.id
      }
    )

    logger.log('[sendResponseToConversation] ✅ Resposta processada:', {
      success: !response.includes('❌')
    })

    return {
      success: !response.includes('❌')
    }
  } catch (error: any) {
    logger.error('[sendResponseToConversation] ❌ Erro:', {
      message: error?.message
    })
    return {
      success: false,
      error: error?.message || 'Erro ao enviar resposta'
    }
  }
}

/**
 * Worker principal: processa todas as conversas pendentes
 */
export async function processPendingConversations(
  integrationsId?: string
): Promise<{ success: boolean; processed: number; error?: string }> {
  try {
    logger.log('[processPendingConversations] 🔄 Iniciando processamento de conversas pendentes...')

    const result = await getPendingConversations(integrationsId, 50)
    
    if (!result.success || !result.conversations) {
      return {
        success: false,
        processed: 0,
        error: result.error
      }
    }

    const conversations = result.conversations
    let processed = 0

    for (const conversation of conversations) {
      const identifier = conversation.phone_number || conversation.lid || ''
      
      if (!identifier) continue

      const processResult = await processPendingConversation(
        identifier,
        conversation.integrations_id
      )

      if (processResult.success) {
        processed++
      }
    }

    logger.log('[processPendingConversations] ✅ Processamento concluído:', {
      total: conversations.length,
      processed
    })

    return {
      success: true,
      processed
    }
  } catch (error: any) {
    logger.error('[processPendingConversations] ❌ Erro:', {
      message: error?.message
    })
    return {
      success: false,
      processed: 0,
      error: error?.message || 'Erro ao processar conversas pendentes'
    }
  }
}
