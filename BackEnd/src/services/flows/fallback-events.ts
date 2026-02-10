import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { getCompanyIdByEmail, getUserIdByEmail } from '../../utils/company-helper'

export interface FallbackEvent {
  user_id?: string
  companies_id?: string
  user_email?: string // Para buscar companies_id automaticamente
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

    // 🎯 PADRÃO MULTI-TENANT: email → user_id → companies_id
    let userIdValue = (event.user_id && event.user_id.trim() !== '') ? event.user_id : null
    let companyIdValue = event.companies_id || null
    
    // Se não tiver companies_id mas tiver user_email, buscar companies_id
    if (!companyIdValue && event.user_email) {
      companyIdValue = await getCompanyIdByEmail(event.user_email)
      if (companyIdValue) {
        logger.log(`[saveFallbackEvent] ✅ companies_id encontrado via user_email: ${companyIdValue}`)
      }
    }
    
    // Se não tiver user_id mas tiver user_email, buscar user_id
    if (!userIdValue && event.user_email) {
      userIdValue = await getUserIdByEmail(event.user_email)
      if (userIdValue) {
        logger.log(`[saveFallbackEvent] ✅ user_id encontrado via user_email: ${userIdValue}`)
      }
    }
    
    // 🎯 FALLBACK: Se companies_id não foi fornecido mas temos workflow_id, tentar buscar via workflow
    if (!companyIdValue && event.workflow_id) {
      try {
        // Busca companies_id e user_email do workflow
        const { data: flowData, error: flowError } = await supabase
          .from('tb_flows')
          .select('companies_id, user_email')
          .eq('id', event.workflow_id)
          .maybeSingle()
        
        if (!flowError && flowData) {
          // Se tiver companies_id direto, usa ele
          if (flowData.companies_id) {
            companyIdValue = flowData.companies_id
            logger.log(`[saveFallbackEvent] ✅ companies_id encontrado via workflow_id (campo direto): ${companyIdValue}`)
          } 
          // Se não tiver companies_id mas tiver user_email, busca companies_id e user_id pelo email
          else if (flowData.user_email) {
            const { getUserIdAndCompanyIdByEmail } = await import('../../utils/company-helper')
            const userCompanyData = await getUserIdAndCompanyIdByEmail(flowData.user_email)
            
            if (userCompanyData.userId && !userIdValue) {
              userIdValue = userCompanyData.userId
              logger.log(`[saveFallbackEvent] ✅ user_id encontrado via workflow_id -> user_email: ${userIdValue}`)
            }
            
            if (userCompanyData.companyId) {
              companyIdValue = userCompanyData.companyId
              logger.log(`[saveFallbackEvent] ✅ companies_id encontrado via workflow_id -> user_email: ${companyIdValue}`)
            }
          }
        }
      } catch (err: any) {
        logger.warn(`[saveFallbackEvent] Erro ao buscar companies_id via workflow_id: ${err.message}`)
      }
    }
    
    logger.log(`[saveFallbackEvent] Salvando evento:`, {
      event_type: event.event_type,
      user_id: userIdValue || 'null',
      companies_id: companyIdValue || 'null',
      workflow_id: event.workflow_id || 'null',
      has_user_id: !!userIdValue,
      has_companies_id: !!companyIdValue
    })

    const { data, error } = await supabase
      .from('tb_system_events')
      .insert({
        user_id: userIdValue, // ✅ Mantém para auditoria
        companies_id: companyIdValue, // ✅ Filtro principal agora
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
