import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

export interface FallbackEvent {
  user_id?: string
  agent_id?: string
  workflow_id?: string
  node_id?: string
  conversation_id?: string
  execution_id?: string
  event_type: 'fallback_variable_missing' | 'condition_defaulted' | 'input_defaulted' | 'template_substitution_failed' | 'agent_blocked'
  level: 'info' | 'warn' | 'error'
  message: string
  metadata: Record<string, any>
  impact_level: 'low' | 'medium' | 'high'
}

/**
 * Valida se uma string é um UUID válido
 */
function isValidUUID(str: string | undefined): boolean {
  if (!str) return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

/**
 * Salva um evento de fallback na tabela tb_system_events
 */
export async function saveFallbackEvent(event: FallbackEvent): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Validar se node_id é um UUID válido, senão usar null
    // Se node_id for uma string (ex: "node-3"), salva no metadata
    const nodeIdValue = isValidUUID(event.node_id) ? event.node_id : null
    const metadataWithNodeId = {
      ...event.metadata,
      // Se node_id não for UUID válido, salva como string no metadata
      ...(event.node_id && !isValidUUID(event.node_id) ? { node_id_string: event.node_id } : {})
    }

    // Validar user_id: se for string vazia ou undefined, tentar buscar pelo workflow_id
    let userIdValue = (event.user_id && event.user_id.trim() !== '') ? event.user_id : null
    
    // 🎯 FALLBACK: Se user_id não foi fornecido mas temos workflow_id, tentar buscar o user_id via user_email do workflow
    if (!userIdValue && event.workflow_id) {
      try {
        // Primeiro tenta buscar user_id diretamente (se a tabela tiver)
        const { data: flowData, error: flowError } = await supabase
          .from('tb_flows')
          .select('user_id, user_email')
          .eq('id', event.workflow_id)
          .maybeSingle()
        
        if (!flowError && flowData) {
          // Se tiver user_id direto, usa ele
          if (flowData.user_id) {
            userIdValue = flowData.user_id
            logger.log(`[saveFallbackEvent] ✅ user_id encontrado via workflow_id (campo direto): ${userIdValue}`)
          } 
          // Se não tiver user_id mas tiver user_email, busca o user_id pelo email
          else if (flowData.user_email) {
            const { data: userData, error: userError } = await supabase
              .from('tb_users')
              .select('id')
              .eq('email', flowData.user_email)
              .maybeSingle()
            
            if (!userError && userData?.id) {
              userIdValue = userData.id
              logger.log(`[saveFallbackEvent] ✅ user_id encontrado via workflow_id -> user_email: ${userIdValue}`)
            }
          }
        }
      } catch (err: any) {
        logger.warn(`[saveFallbackEvent] Erro ao buscar user_id via workflow_id: ${err.message}`)
      }
    }
    
    logger.log(`[saveFallbackEvent] Salvando evento:`, {
      event_type: event.event_type,
      user_id: userIdValue || 'null',
      workflow_id: event.workflow_id || 'null',
      has_user_id: !!userIdValue
    })

    const { data, error } = await supabase
      .from('tb_system_events')
      .insert({
        user_id: userIdValue, // ✅ Usa null se user_id for vazio/undefined
        agent_id: event.agent_id || null,
        workflow_id: event.workflow_id || null,
        node_id: nodeIdValue, // Só passa se for UUID válido, senão null
        conversation_id: event.conversation_id || null,
        execution_id: event.execution_id || null,
        event_type: event.event_type,
        level: event.level,
        message: event.message,
        metadata: metadataWithNodeId,
        impact_level: event.impact_level
      })
      .select('id')
      .single()

    if (error) {
      logger.error('[saveFallbackEvent] Erro ao salvar evento:', error)
      return { success: false, error: error.message }
    }

    logger.log(`[saveFallbackEvent] ✅ Evento de fallback salvo: ${event.event_type}`, {
      id: data.id,
      message: event.message,
      node_id: nodeIdValue || event.node_id || 'null'
    })

    return { success: true, id: data.id }
  } catch (err: any) {
    logger.error('[saveFallbackEvent] Erro:', err)
    return { success: false, error: err.message }
  }
}
