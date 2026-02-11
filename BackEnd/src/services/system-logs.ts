import { supabase } from '../lib/supabase'
import logger from '../lib/logger'
import { getCompanyIdByEmail, getUserIdByEmail } from '../utils/company-helper'

export interface SystemLog {
  user_id?: string
  companies_id?: string
  user_email?: string // Para buscar companies_id automaticamente
  agent_id?: string
  workflow_id?: string
  node_id?: string
  conversation_id?: string
  execution_id?: string
  log_type: 'agent_blocked' | 'workflow_node_executed' | 'workflow_execution_completed' | 'error' | 'warning' | 'info' | 'debug' | string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  metadata?: Record<string, any>
  impact_level: 'low' | 'medium' | 'high' | 'critical'
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
 * Salva um log do sistema na tabela tb_system_logs
 */
export async function saveSystemLog(log: SystemLog): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Validar se node_id é um UUID válido, senão usar null
    const nodeIdValue = isValidUUID(log.node_id) ? log.node_id : null
    const metadataWithNodeId = {
      ...(log.metadata || {}),
      // Se node_id não for UUID válido, salva como string no metadata
      ...(log.node_id && !isValidUUID(log.node_id) ? { node_id_string: log.node_id } : {})
    }

    // 🎯 PADRÃO MULTI-TENANT: email → user_id → companies_id
    let userIdValue = (log.user_id && log.user_id.trim() !== '') ? log.user_id : null
    let companyIdValue = log.companies_id || null
    
    // Se não tiver companies_id mas tiver user_email, buscar companies_id
    if (!companyIdValue && log.user_email) {
      companyIdValue = await getCompanyIdByEmail(log.user_email)
      if (companyIdValue) {
        logger.log(`[saveSystemLog] ✅ companies_id encontrado via user_email: ${companyIdValue}`)
      }
    }
    
    // Se não tiver user_id mas tiver user_email, buscar user_id
    if (!userIdValue && log.user_email) {
      userIdValue = await getUserIdByEmail(log.user_email)
      if (userIdValue) {
        logger.log(`[saveSystemLog] ✅ user_id encontrado via user_email: ${userIdValue}`)
      }
    }
    
    // 🎯 FALLBACK: Se companies_id não foi fornecido mas temos workflow_id, tentar buscar via workflow
    if (!companyIdValue && log.workflow_id) {
      try {
        // Busca companies_id e user_email do workflow
        const { data: flowData, error: flowError } = await supabase
          .from('tb_flows')
          .select('companies_id, user_email')
          .eq('id', log.workflow_id)
          .maybeSingle()
        
        if (!flowError && flowData) {
          // Se tiver companies_id direto, usa ele
          if (flowData.companies_id) {
            companyIdValue = flowData.companies_id
            logger.log(`[saveSystemLog] ✅ companies_id encontrado via workflow_id (campo direto): ${companyIdValue}`)
          } 
          // Se não tiver companies_id mas tiver user_email, busca companies_id e user_id pelo email
          else if (flowData.user_email) {
            const { getUserIdAndCompanyIdByEmail } = await import('../utils/company-helper')
            const userCompanyData = await getUserIdAndCompanyIdByEmail(flowData.user_email)
            
            if (userCompanyData.userId && !userIdValue) {
              userIdValue = userCompanyData.userId
              logger.log(`[saveSystemLog] ✅ user_id encontrado via workflow_id -> user_email: ${userIdValue}`)
            }
            
            if (userCompanyData.companyId) {
              companyIdValue = userCompanyData.companyId
              logger.log(`[saveSystemLog] ✅ companies_id encontrado via workflow_id -> user_email: ${companyIdValue}`)
            }
          }
        }
      } catch (err: any) {
        logger.warn(`[saveSystemLog] Erro ao buscar companies_id via workflow_id: ${err.message}`)
      }
    }
    
    logger.log(`[saveSystemLog] Salvando log:`, {
      log_type: log.log_type,
      user_id: userIdValue || 'null',
      companies_id: companyIdValue || 'null',
      workflow_id: log.workflow_id || 'null',
      impact_level: log.impact_level,
      has_user_id: !!userIdValue,
      has_companies_id: !!companyIdValue
    })

    const { data, error } = await supabase
      .from('tb_system_logs')
      .insert({
        user_id: userIdValue,
        companies_id: companyIdValue,
        agent_id: log.agent_id || null,
        workflow_id: log.workflow_id || null,
        node_id: nodeIdValue,
        conversation_id: log.conversation_id || null,
        execution_id: log.execution_id || null,
        log_type: log.log_type,
        level: log.level,
        message: log.message,
        metadata: metadataWithNodeId,
        impact_level: log.impact_level
      })
      .select('id')
      .single()

    if (error) {
      logger.error('[saveSystemLog] Erro ao salvar log:', error)
      return { success: false, error: error.message }
    }

    logger.log(`[saveSystemLog] ✅ Log salvo: ${log.log_type}`, {
      id: data.id,
      message: log.message,
      impact_level: log.impact_level
    })

    return { success: true, id: data.id }
  } catch (err: any) {
    logger.error('[saveSystemLog] Erro:', err)
    return { success: false, error: err.message }
  }
}
