import { supabase } from '../../../lib/supabase'
import logger from '../../../lib/logger'

export interface ConversationData {
  id?: string
  lid?: string | null
  phone_number?: string | null
  integrations_id: string
  status: 'pending' | 'ready'
}

/**
 * Cria ou atualiza uma conversa baseada em LID ou número real
 */
export async function createOrUpdateConversation(data: {
  lid?: string | null
  phone_number?: string | null
  integrations_id: string
}): Promise<{ success: boolean; conversation?: ConversationData; error?: string }> {
  try {
    const { lid, phone_number, integrations_id } = data

    // Validação: precisa ter pelo menos um identificador
    if (!lid && !phone_number) {
      return {
        success: false,
        error: 'É necessário fornecer lid ou phone_number'
      }
    }

    logger.log('[createOrUpdateConversation] 🔍 Criando/atualizando conversa:', {
      lid,
      phone_number,
      integrations_id
    })

    // Se tem número real, status é ready
    // Se só tem LID, status é pending
    const status: 'pending' | 'ready' = phone_number ? 'ready' : 'pending'

    // Tenta buscar conversa existente por LID ou número
    let existingConversation: ConversationData | null = null

    if (lid) {
      const { data: lidData, error: lidError } = await supabase
        .from('tb_whatsapp_conversations')
        .select('*')
        .eq('lid', lid)
        .eq('integrations_id', integrations_id)
        .single()

      if (!lidError && lidData) {
        existingConversation = lidData as ConversationData
        logger.log('[createOrUpdateConversation] ✅ Conversa encontrada por LID:', {
          id: existingConversation.id,
          lid: existingConversation.lid
        })
      }
    }

    if (!existingConversation && phone_number) {
      const { data: phoneData, error: phoneError } = await supabase
        .from('tb_whatsapp_conversations')
        .select('*')
        .eq('phone_number', phone_number)
        .eq('integrations_id', integrations_id)
        .single()

      if (!phoneError && phoneData) {
        existingConversation = phoneData as ConversationData
        logger.log('[createOrUpdateConversation] ✅ Conversa encontrada por número:', {
          id: existingConversation.id,
          phone_number: existingConversation.phone_number
        })
      }
    }

    if (existingConversation) {
      // Atualiza conversa existente
      const updateData: any = {
        status
      }

      // Se a conversa tinha só LID e agora temos número, atualiza
      if (phone_number && !existingConversation.phone_number) {
        updateData.phone_number = phone_number
        updateData.status = 'ready'
        logger.log('[createOrUpdateConversation] 🔄 Atualizando: LID vinculado ao número real:', {
          lid: existingConversation.lid,
          phone_number
        })
      }

      // Se a conversa tinha só número e agora temos LID, atualiza
      if (lid && !existingConversation.lid) {
        updateData.lid = lid
        logger.log('[createOrUpdateConversation] 🔄 Atualizando: número vinculado ao LID:', {
          phone_number: existingConversation.phone_number,
          lid
        })
      }

      const { data: updatedData, error: updateError } = await supabase
        .from('tb_whatsapp_conversations')
        .update(updateData)
        .eq('id', existingConversation.id)
        .select()
        .single()

      if (updateError) {
        logger.error('[createOrUpdateConversation] ❌ Erro ao atualizar conversa:', {
          error: updateError.message,
          conversationId: existingConversation.id
        })
        return {
          success: false,
          error: updateError.message
        }
      }

      logger.log('[createOrUpdateConversation] ✅ Conversa atualizada:', {
        id: updatedData.id,
        status: updatedData.status,
        hasLid: !!updatedData.lid,
        hasPhone: !!updatedData.phone_number
      })

      return {
        success: true,
        conversation: updatedData as ConversationData
      }
    } else {
      // Cria nova conversa
      const insertData: any = {
        integrations_id,
        status
      }

      if (lid) insertData.lid = lid
      if (phone_number) insertData.phone_number = phone_number

      const { data: newData, error: insertError } = await supabase
        .from('tb_whatsapp_conversations')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        logger.error('[createOrUpdateConversation] ❌ Erro ao criar conversa:', {
          error: insertError.message
        })
        return {
          success: false,
          error: insertError.message
        }
      }

      logger.log('[createOrUpdateConversation] ✅ Nova conversa criada:', {
        id: newData.id,
        status: newData.status,
        hasLid: !!newData.lid,
        hasPhone: !!newData.phone_number
      })

      return {
        success: true,
        conversation: newData as ConversationData
      }
    }
  } catch (error: any) {
    logger.error('[createOrUpdateConversation] ❌ Erro:', {
      message: error?.message,
      stack: error?.stack
    })
    return {
      success: false,
      error: error?.message || 'Erro desconhecido ao criar/atualizar conversa'
    }
  }
}

/**
 * Vincula LID ao número real quando o número aparecer em eventos de chat
 */
export async function linkLidToPhoneNumber(
  lid: string,
  phone_number: string,
  integrations_id: string
): Promise<{ success: boolean; conversation?: ConversationData; error?: string }> {
  try {
    logger.log('[linkLidToPhoneNumber] 🔗 Vinculando LID ao número real:', {
      lid,
      phone_number,
      integrations_id
    })

    // Busca conversa pelo LID
    const { data: conversation, error: findError } = await supabase
      .from('tb_whatsapp_conversations')
      .select('*')
      .eq('lid', lid)
      .eq('integrations_id', integrations_id)
      .single()

    if (findError || !conversation) {
      // Se não encontrou, cria nova conversa
      logger.log('[linkLidToPhoneNumber] ℹ️ Conversa não encontrada por LID, criando nova:', {
        lid
      })
      return await createOrUpdateConversation({
        lid,
        phone_number,
        integrations_id
      })
    }

    // Atualiza conversa existente
    const { data: updatedData, error: updateError } = await supabase
      .from('tb_whatsapp_conversations')
      .update({
        phone_number,
        status: 'ready'
      })
      .eq('id', conversation.id)
      .select()
      .single()

    if (updateError) {
      logger.error('[linkLidToPhoneNumber] ❌ Erro ao vincular LID:', {
        error: updateError.message
      })
      return {
        success: false,
        error: updateError.message
      }
    }

    logger.log('[linkLidToPhoneNumber] ✅ LID vinculado ao número real:', {
      conversationId: updatedData.id,
      lid,
      phone_number,
      status: updatedData.status
    })

    return {
      success: true,
      conversation: updatedData as ConversationData
    }
  } catch (error: any) {
    logger.error('[linkLidToPhoneNumber] ❌ Erro:', {
      message: error?.message
    })
    return {
      success: false,
      error: error?.message || 'Erro desconhecido ao vincular LID'
    }
  }
}

/**
 * Busca conversas pendentes que precisam ser processadas
 */
export async function getPendingConversations(
  integrations_id?: string,
  limit: number = 10
): Promise<{ success: boolean; conversations?: ConversationData[]; error?: string }> {
  try {
    let query = supabase
      .from('tb_whatsapp_conversations')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (integrations_id) {
      query = query.eq('integrations_id', integrations_id)
    }

    const { data, error } = await query

    if (error) {
      logger.error('[getPendingConversations] ❌ Erro ao buscar conversas pendentes:', {
        error: error.message
      })
      return {
        success: false,
        error: error.message
      }
    }

    logger.log('[getPendingConversations] ✅ Conversas pendentes encontradas:', {
      count: data?.length || 0
    })

    return {
      success: true,
      conversations: (data || []) as ConversationData[]
    }
  } catch (error: any) {
    logger.error('[getPendingConversations] ❌ Erro:', {
      message: error?.message
    })
    return {
      success: false,
      error: error?.message || 'Erro desconhecido ao buscar conversas pendentes'
    }
  }
}

/**
 * Busca conversa por LID ou número
 */
export async function getConversationByIdentifier(
  identifier: string,
  integrations_id: string
): Promise<{ success: boolean; conversation?: ConversationData; error?: string }> {
  try {
    const isLid = identifier.endsWith('@lid')
    const isPhone = identifier.endsWith('@s.whatsapp.net')

    let query = supabase
      .from('tb_whatsapp_conversations')
      .select('*')
      .eq('integrations_id', integrations_id)

    if (isLid) {
      query = query.eq('lid', identifier)
    } else if (isPhone) {
      query = query.eq('phone_number', identifier)
    } else {
      // Tenta ambos
      query = query.or(`lid.eq.${identifier},phone_number.eq.${identifier}`)
    }

    const { data, error } = await query.single()

    if (error || !data) {
      return {
        success: false,
        error: 'Conversa não encontrada'
      }
    }

    return {
      success: true,
      conversation: data as ConversationData
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Erro ao buscar conversa'
    }
  }
}
