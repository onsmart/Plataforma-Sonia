import { supabase } from '../lib/supabase'
import logger from '../lib/logger'

/**
 * Obtém o uso atual de agentes da empresa (todos os agentes)
 */
export async function getCurrentAgentCount(companiesId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('tb_agents')
      .select('*', { count: 'exact', head: true })
      .eq('companies_id', companiesId)

    if (error) {
      logger.warn(`[getCurrentAgentCount] Erro ao contar agentes: ${error.message}`)
      return 0
    }

    return count || 0
  } catch (err: any) {
    logger.error('[getCurrentAgentCount] Erro:', err)
    return 0
  }
}

/**
 * Obtém o número de agentes ATIVOS da empresa
 * status_id = 1 = ativo
 */
export async function getActiveAgentCount(companiesId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('tb_agents')
      .select('*', { count: 'exact', head: true })
      .eq('companies_id', companiesId)
      .eq('status_id', 1) // ✅ Só conta agentes ATIVOS

    if (error) {
      logger.warn(`[getActiveAgentCount] Erro ao contar agentes ativos: ${error.message}`)
      return 0
    }

    return count || 0
  } catch (err: any) {
    logger.error('[getActiveAgentCount] Erro:', err)
    return 0
  }
}

/**
 * Obtém o uso atual de mensagens da empresa no mês atual
 */
export async function getCurrentMessageCount(companiesId: string): Promise<number> {
  try {
    // Obter início e fim do mês atual
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    // Buscar integrações da empresa
    const { data: integrations, error: intError } = await supabase
      .from('tb_integrations')
      .select('id')
      .eq('companies_id', companiesId)

    if (intError || !integrations || integrations.length === 0) {
      return 0
    }

    const integrationIds = integrations.map(i => i.id)

    // Contar mensagens enviadas no mês atual
    const { count, error } = await supabase
      .from('tb_whatsapp_messages')
      .select('*', { count: 'exact', head: true })
      .in('integrations_id', integrationIds)
      .eq('direction', 'outbound')
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString())

    if (error) {
      logger.warn(`[getCurrentMessageCount] Erro ao contar mensagens: ${error.message}`)
      return 0
    }

    return count || 0
  } catch (err: any) {
    logger.error('[getCurrentMessageCount] Erro:', err)
    return 0
  }
}

/**
 * Incrementa o contador de mensagens no mês atual
 * Atualiza ou cria registro em tb_usage_metrics
 */
export async function incrementMessageCount(companiesId: string): Promise<void> {
  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthStartISO = monthStart.toISOString().split('T')[0] // YYYY-MM-DD

    // Primeiro, buscar registro existente
    const { data: existing, error: fetchError } = await supabase
      .from('tb_usage_metrics')
      .select('id, message_count')
      .eq('companies_id', companiesId)
      .eq('month_start', monthStartISO)
      .maybeSingle()

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows found (registro não existe)
      logger.warn(`[incrementMessageCount] Erro ao buscar métricas: ${fetchError.message}`)
    }

    // Se existe, atualizar incrementando
    if (existing) {
      const newCount = (existing.message_count || 0) + 1
      const { error: updateError } = await supabase
        .from('tb_usage_metrics')
        .update({ 
          message_count: newCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)

      if (updateError) {
        logger.error(`[incrementMessageCount] Erro ao atualizar métricas: ${updateError.message}`)
        return
      }

      logger.log(`[incrementMessageCount] ✅ Contador incrementado para ${companiesId} em ${monthStartISO} (${newCount})`)
    } else {
      // Se não existe, criar novo
      const { error: insertError } = await supabase
        .from('tb_usage_metrics')
        .insert({
          companies_id: companiesId,
          month_start: monthStartISO,
          message_count: 1,
          agent_count: 0 // Será atualizado separadamente se necessário
        })
        .select('id')
        .maybeSingle()

      if (insertError) {
        logger.error(`[incrementMessageCount] Erro ao criar métricas: ${insertError.message}`)
        return
      }

      logger.log(`[incrementMessageCount] ✅ Métricas criadas para ${companiesId} em ${monthStartISO}`)
    }
  } catch (err: any) {
    logger.error('[incrementMessageCount] Erro inesperado:', err)
  }
}
