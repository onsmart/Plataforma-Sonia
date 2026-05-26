import { supabase } from '../../lib/supabase'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import logger from '../../lib/logger'

export interface KPIMetrics {
  // Operacional
  taskSuccessRate: number // Taxa de sucesso de tarefas (%)
  averageResponseTime: number // Tempo médio de resposta (ms)
  taskAbandonmentRate: number // Taxa de abandono de tarefas (%)
  
  // Financeiro
  costPerInteraction: number // Custo por interação (R$)
  totalCost: number // Custo total (R$)
  
  // Conformidade e Risco
  violationsCount: number // Número de violações
  hallucinationsFlagged: number // Alucinações sinalizadas
  
  // Feedback de Aprendizagem
  humanTransferRate: number // Taxa de transferência humana (%)
  quickReworkRate: number // Taxa de retrabalho rápido (%)
  
  // UX / Fatores Humanos
  csatScore: number // Customer Satisfaction Score (1-5)
  npsScore: number // Net Promoter Score (0-10)
  averageSentiment: number // Sentimento médio (-1 a 1)
  feedbackCount: number // Total de feedbacks no período
  csatCount: number // Total de feedbacks com CSAT
  npsCount: number // Total de feedbacks com NPS
  sentimentCount: number // Total de feedbacks com sentimento
  incorrectRoutingFrequency: number // Frequência de roteamento incorreto
}

export interface KPIFilters {
  email: string
  agentId?: string
  startDate?: string
  endDate?: string
  channel?: string
}

/**
 * Calcula todos os KPIs baseado nos filtros fornecidos
 */
export async function calculateKPIs(filters: KPIFilters): Promise<KPIMetrics> {
  try {
    logger.log('[calculateKPIs] Iniciando cálculo de KPIs para email:', filters.email)
    const companyId = await getCompanyIdByEmail(filters.email)
    if (!companyId) {
      logger.error('[calculateKPIs] Company ID não encontrado para email:', filters.email)
      throw new Error('Company ID não encontrado')
    }

    logger.log('[calculateKPIs] Company ID encontrado:', companyId)
    
    // ✅ DEBUG: Verificar se há logs no banco antes de calcular
    const { data: debugLogs, error: debugError } = await supabase
      .from('tb_system_logs')
      .select('id, log_type, companies_id, metadata, created_at')
      .eq('companies_id', companyId)
      .eq('log_type', 'workflow_execution_completed')
      .order('created_at', { ascending: false })
      .limit(5)
    
    logger.log('[calculateKPIs] 🔍 DEBUG - Logs encontrados no banco:', {
      totalLogs: debugLogs?.length || 0,
      logs: debugLogs?.map(l => ({
        id: l.id,
        log_type: l.log_type,
        companies_id: l.companies_id,
        hasMetadata: !!l.metadata,
        metadataSuccess: l.metadata?.success,
        created_at: l.created_at
      })),
      error: debugError?.message
    })

    // Calcula todos os KPIs em paralelo
    const [
      taskSuccessRate,
      averageResponseTime,
      taskAbandonmentRate,
      costMetrics,
      violationsCount,
      hallucinationsFlagged,
      humanTransferRate,
      quickReworkRate,
      uxMetrics
    ] = await Promise.all([
      calculateTaskSuccessRate(companyId, filters),
      calculateAverageResponseTime(companyId, filters),
      calculateTaskAbandonmentRate(companyId, filters),
      calculateCostMetrics(companyId, filters),
      calculateViolationsCount(companyId, filters),
      calculateHallucinationsFlagged(companyId, filters),
      calculateHumanTransferRate(companyId, filters),
      calculateQuickReworkRate(companyId, filters),
      calculateUXMetrics(companyId, filters)
    ])

    const result = {
      taskSuccessRate,
      averageResponseTime,
      taskAbandonmentRate,
      costPerInteraction: costMetrics.costPerInteraction,
      totalCost: costMetrics.totalCost,
      violationsCount,
      hallucinationsFlagged,
      humanTransferRate,
      quickReworkRate,
      csatScore: uxMetrics.csatScore,
      npsScore: uxMetrics.npsScore,
      averageSentiment: uxMetrics.averageSentiment,
      feedbackCount: uxMetrics.feedbackCount,
      csatCount: uxMetrics.csatCount,
      npsCount: uxMetrics.npsCount,
      sentimentCount: uxMetrics.sentimentCount,
      incorrectRoutingFrequency: uxMetrics.incorrectRoutingFrequency
    }

    logger.log('[calculateKPIs] ✅ KPIs calculados com sucesso:', {
      taskSuccessRate: result.taskSuccessRate,
      averageResponseTime: result.averageResponseTime,
      violationsCount: result.violationsCount,
      costPerInteraction: result.costPerInteraction,
      csatScore: result.csatScore,
      npsScore: result.npsScore,
      totalCost: result.totalCost,
      hallucinationsFlagged: result.hallucinationsFlagged,
      humanTransferRate: result.humanTransferRate
    })
    
    // Log detalhado para debug
    logger.log('[calculateKPIs] 📊 Detalhes dos cálculos:', {
      companyId,
      hasTaskSuccessData: result.taskSuccessRate > 0,
      hasResponseTimeData: result.averageResponseTime > 0,
      hasCostData: result.costPerInteraction > 0,
      hasViolations: result.violationsCount > 0,
      hasFeedback: result.csatScore > 0 || result.npsScore > 0
    })
    
    return result
  } catch (error: any) {
    logger.error('[calculateKPIs] ❌ Erro ao calcular KPIs:', error)
    throw error
  }
}

/**
 * Conta logs workflow_execution_completed no banco (sem limite de página do select).
 */
async function countWorkflowCompletedLogs(
  companyId: string,
  filters: KPIFilters,
  options?: { successOnly?: boolean }
): Promise<number> {
  let query = supabase
    .from('tb_system_logs')
    .select('id', { count: 'exact', head: true })
    .eq('companies_id', companyId)
    .eq('log_type', 'workflow_execution_completed')

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate)
  }
  if (filters.agentId) {
    query = query.eq('agent_id', filters.agentId)
  }
  if (options?.successOnly) {
    query = query.contains('metadata', { success: true })
  }

  const { count, error } = await query

  if (error) {
    throw error
  }

  return count ?? 0
}

/**
 * Calcula taxa de sucesso de tarefas (workflows completados com sucesso)
 */
async function calculateTaskSuccessRate(
  companyId: string,
  filters: KPIFilters
): Promise<number> {
  try {
    logger.log(`[calculateTaskSuccessRate] 🔍 Buscando logs para companyId: ${companyId}`)

    const [total, successful] = await Promise.all([
      countWorkflowCompletedLogs(companyId, filters),
      countWorkflowCompletedLogs(companyId, filters, { successOnly: true }),
    ])

    logger.log(`[calculateTaskSuccessRate] 📊 Resultados:`, {
      totalLogs: total,
      successfulLogs: successful,
    })

    if (total === 0) {
      logger.log(`[calculateTaskSuccessRate] ⚠️ Nenhum log encontrado para companyId: ${companyId}`)
      return 0
    }

    const rate = (successful / total) * 100
    logger.log(`[calculateTaskSuccessRate] ✅ Taxa calculada:`, {
      successful,
      total,
      rate: `${rate.toFixed(2)}%`,
    })

    return rate
  } catch (error: any) {
    logger.error('[calculateTaskSuccessRate] Erro:', error)
    return 0
  }
}

/**
 * Calcula tempo médio de resposta
 * Nota: Requer que as mensagens tenham timestamps de início e fim
 */
async function calculateAverageResponseTime(
  companyId: string,
  filters: KPIFilters
): Promise<number> {
  try {
    // Primeiro busca integrações da empresa
    const { data: integrations, error: intError } = await supabase
      .from('tb_integrations')
      .select('id')
      .eq('companies_id', companyId)
      .eq('type', 'whatsapp')

    if (intError || !integrations || integrations.length === 0) {
      logger.log('[calculateAverageResponseTime] Nenhuma integração WhatsApp encontrada para companyId:', companyId)
      return 0
    }

    const integrationIds = integrations.map(i => i.id)

    // Agora busca conversas dessas integrações
    let conversationsQuery = supabase
      .from('tb_whatsapp_conversations')
      .select('id')
      .in('integrations_id', integrationIds)

    if (filters.agentId) {
      conversationsQuery = conversationsQuery.eq('agent_id', filters.agentId)
    }

    const { data: conversations, error: convError } = await conversationsQuery

    if (convError || !conversations || conversations.length === 0) {
      logger.log('[calculateAverageResponseTime] Nenhuma conversa encontrada para companyId:', companyId)
      return 0
    }

    const conversationIds = conversations.map(c => c.id)

    // Agora busca mensagens dessas conversas
    let query = supabase
      .from('tb_whatsapp_messages')
      .select('created_at, metadata, conversation_id')
      .eq('direction', 'outbound') // Apenas respostas do agente
      .in('conversation_id', conversationIds)
      .not('metadata->request_started_at', 'is', null)

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }

    const { data, error } = await query

    logger.log('[calculateAverageResponseTime] 🔍 DEBUG - Mensagens encontradas:', {
      totalMessages: data?.length || 0,
      sampleMessage: data?.[0],
      error: error?.message,
      companyId
    })

    if (error) {
      logger.error('[calculateAverageResponseTime] Erro na query:', error)
      return 0
    }

    if (!data || data.length === 0) {
      logger.log('[calculateAverageResponseTime] ⚠️ Nenhuma mensagem encontrada com request_started_at')
      return 0
    }

    // Calcula diferença entre request_started_at e created_at (response_sent_at)
    const responseTimes = data
      .map((msg) => {
        const requestTime = msg.metadata?.request_started_at
        const responseTime = new Date(msg.created_at).getTime()
        
        if (requestTime) {
          const requestTimestamp = new Date(requestTime).getTime()
          return responseTime - requestTimestamp
        }
        return null
      })
      .filter((time): time is number => time !== null && time > 0)

    if (responseTimes.length === 0) return 0

    const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    return Math.round(average) // Retorna em milissegundos
  } catch (error: any) {
    logger.error('[calculateAverageResponseTime] Erro:', error)
    return 0
  }
}

/**
 * Calcula taxa de abandono de tarefas
 * Define abandono como: conversas sem resposta em 24 horas
 */
async function calculateTaskAbandonmentRate(
  companyId: string,
  filters: KPIFilters
): Promise<number> {
  try {
    const abandonmentThreshold = 24 * 60 * 60 * 1000 // 24 horas em ms

    // Primeiro busca integrações da empresa
    const { data: integrations, error: intError } = await supabase
      .from('tb_integrations')
      .select('id')
      .eq('companies_id', companyId)
      .eq('type', 'whatsapp')

    if (intError || !integrations || integrations.length === 0) {
      logger.log('[calculateTaskAbandonmentRate] Nenhuma integração WhatsApp encontrada')
      return 0
    }

    const integrationIds = integrations.map(i => i.id)

    let query = supabase
      .from('tb_whatsapp_conversations')
      .select('id, created_at, updated_at, status', { count: 'exact' })
      .in('integrations_id', integrationIds)
      .eq('status', 'ready') // Apenas conversas prontas

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }

    const { data, count, error } = await query

    if (error || !count || count === 0) return 0

    const now = Date.now()
    const abandoned = data?.filter((conv) => {
      const lastUpdate = new Date(conv.updated_at || conv.created_at).getTime()
      const timeSinceUpdate = now - lastUpdate
      return timeSinceUpdate > abandonmentThreshold
    }).length || 0

    return (abandoned / count) * 100
  } catch (error: any) {
    logger.error('[calculateTaskAbandonmentRate] Erro:', error)
    return 0
  }
}

/**
 * Calcula custo por interação e custo total
 */
async function calculateCostMetrics(
  companyId: string,
  filters: KPIFilters
): Promise<{ costPerInteraction: number; totalCost: number }> {
  try {
    // Busca uso de tokens
    let query = supabase
      .from('tb_agent_token_usage')
      .select('id, companies_id, agent_id, input_tokens, output_tokens, total_tokens, model, provider, created_at, conversation_id')
      .eq('companies_id', companyId)

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }
    if (filters.agentId) {
      query = query.eq('agent_id', filters.agentId)
    }

    const { data, error } = await query

    logger.log('[calculateCostMetrics] 🔍 DEBUG - Token usage encontrado:', {
      totalRecords: data?.length || 0,
      sampleRecord: data?.[0] ? {
        id: data[0].id,
        companies_id: data[0].companies_id,
        agent_id: data[0].agent_id,
        input_tokens: data[0].input_tokens,
        output_tokens: data[0].output_tokens,
        total_tokens: data[0].total_tokens,
        model: data[0].model,
        created_at: data[0].created_at
      } : null,
      error: error?.message,
      errorCode: error?.code,
      companyId,
      queryFilters: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        agentId: filters.agentId
      }
    })

    if (error) {
      logger.error('[calculateCostMetrics] ❌ Erro na query:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        companyId
      })
      return { costPerInteraction: 0, totalCost: 0 }
    }

    if (!data || data.length === 0) {
      logger.log('[calculateCostMetrics] ⚠️ Nenhum registro encontrado na tabela tb_agent_token_usage', {
        companyId,
        filters: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          agentId: filters.agentId
        }
      })
      
      // ✅ DEBUG: Verificar se há registros sem filtros
      const { data: allRecords, count: totalCount } = await supabase
        .from('tb_agent_token_usage')
        .select('id, companies_id, created_at', { count: 'exact' })
        .eq('companies_id', companyId)
        .limit(5)
      
      logger.log('[calculateCostMetrics] 🔍 DEBUG - Verificação sem filtros:', {
        totalRecordsInTable: totalCount || 0,
        sampleRecords: allRecords?.map(r => ({
          id: r.id,
          companies_id: r.companies_id,
          created_at: r.created_at
        }))
      })
      
      return { costPerInteraction: 0, totalCost: 0 }
    }

    // Preços aproximados por 1M tokens (ajustar conforme necessário)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 2.5, output: 10 }, // $2.5/$10 por 1M tokens
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
      'gpt-4': { input: 30, output: 60 },
      'gpt-3.5-turbo': { input: 0.5, output: 1.5 }
    }

    let totalCost = 0
    const interactions = new Set<string>()

    for (const usage of data) {
      const modelKey = usage.model || 'gpt-4o'
      const prices = pricing[modelKey] || pricing['gpt-4o']
      
      // Calcular total_tokens se não existir (soma input + output)
      const totalTokens = usage.total_tokens || ((usage.input_tokens || 0) + (usage.output_tokens || 0))
      const inputTokens = usage.input_tokens || (totalTokens * 0.5)
      const outputTokens = usage.output_tokens || (totalTokens * 0.5)
      
      const cost = (inputTokens / 1_000_000) * prices.input + (outputTokens / 1_000_000) * prices.output
      totalCost += cost

      // Usa conversation_id ou cria ID único baseado em timestamp
      const interactionId = usage.conversation_id || `interaction_${usage.created_at}`
      interactions.add(interactionId)
    }

    // Calcular custo por interação
    // Se não houver conversation_id, cada registro é uma interação separada
    const costPerInteraction = interactions.size > 0 ? totalCost / interactions.size : 0
    
    // ✅ Usar mais casas decimais para valores pequenos (4 casas ao invés de 2)
    // Exemplo: 0.16 / 126 = 0.00127, que arredondado para 2 casas vira 0.00
    const roundedCostPerInteraction = costPerInteraction > 0 
      ? Math.round(costPerInteraction * 10000) / 10000 // 4 casas decimais
      : 0

    logger.log('[calculateCostMetrics] ✅ Cálculo final:', {
      totalCost: Math.round(totalCost * 100) / 100,
      costPerInteraction: roundedCostPerInteraction,
      costPerInteractionRaw: costPerInteraction,
      totalInteractions: interactions.size,
      totalRecords: data.length,
      calculation: `${totalCost.toFixed(4)} / ${interactions.size} = ${costPerInteraction.toFixed(6)}`
    })

    return {
      costPerInteraction: roundedCostPerInteraction, // Retorna com 4 casas decimais
      totalCost: Math.round(totalCost * 100) / 100 // Total com 2 casas decimais
    }
  } catch (error: any) {
    logger.error('[calculateCostMetrics] Erro:', error)
    return { costPerInteraction: 0, totalCost: 0 }
  }
}

/**
 * Calcula número de violações (decisões bloqueadas)
 */
async function calculateViolationsCount(
  companyId: string,
  filters: KPIFilters
): Promise<number> {
  try {
    let query = supabase
      .from('tb_agent_decisions')
      .select('id', { count: 'exact' })
      .eq('companies_id', companyId)
      .eq('status', 'pending_approval') // Decisões bloqueadas

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }
    if (filters.agentId) {
      query = query.eq('agent_id', filters.agentId)
    }

    const { count, error } = await query

    if (error) {
      logger.error('[calculateViolationsCount] Erro:', error)
      return 0
    }

    return count || 0
  } catch (error: any) {
    logger.error('[calculateViolationsCount] Erro:', error)
    return 0
  }
}

/**
 * Calcula alucinações sinalizadas
 * Define como: decisões com confidence_score baixo E sem sources do RAG
 */
async function calculateHallucinationsFlagged(
  companyId: string,
  filters: KPIFilters
): Promise<number> {
  try {
    let query = supabase
      .from('tb_agent_decisions')
      .select('id, confidence_score, sources')
      .eq('companies_id', companyId)
      .lt('confidence_score', 0.7) // Confidence baixo

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }
    if (filters.agentId) {
      query = query.eq('agent_id', filters.agentId)
    }

    const { data, error } = await query

    if (error || !data) return 0

    // Conta apenas os que não têm sources (indicando possível alucinação)
    const hallucinations = data.filter(
      (decision) => !decision.sources || (Array.isArray(decision.sources) && decision.sources.length === 0)
    )

    return hallucinations.length
  } catch (error: any) {
    logger.error('[calculateHallucinationsFlagged] Erro:', error)
    return 0
  }
}

/**
 * Calcula taxa de transferência humana
 * Baseado em decisões que requerem aprovação humana (pending_approval)
 */
async function calculateHumanTransferRate(
  companyId: string,
  filters: KPIFilters
): Promise<number> {
  try {
    // Busca todas as decisões da empresa
    let totalQuery = supabase
      .from('tb_agent_decisions')
      .select('id', { count: 'exact' })
      .eq('companies_id', companyId)

    if (filters.startDate) {
      totalQuery = totalQuery.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      totalQuery = totalQuery.lte('created_at', filters.endDate)
    }
    if (filters.agentId) {
      totalQuery = totalQuery.eq('agent_id', filters.agentId)
    }

    const { count: totalCount, error: totalError } = await totalQuery

    if (totalError || !totalCount || totalCount === 0) {
      logger.log('[calculateHumanTransferRate] Nenhuma decisão encontrada')
      return 0
    }

    // ✅ DEBUG: Verificar distribuição de status (com os MESMOS filtros)
    let statusQuery = supabase
      .from('tb_agent_decisions')
      .select('status')
      .eq('companies_id', companyId)

    if (filters.startDate) {
      statusQuery = statusQuery.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      statusQuery = statusQuery.lte('created_at', filters.endDate)
    }
    if (filters.agentId) {
      statusQuery = statusQuery.eq('agent_id', filters.agentId)
    }
    
    const { data: statusDistribution } = await statusQuery
    
    const statusCounts = statusDistribution?.reduce((acc: Record<string, number>, item: any) => {
      acc[item.status] = (acc[item.status] || 0) + 1
      return acc
    }, {}) || {}

    logger.log('[calculateHumanTransferRate] 🔍 Distribuição de status (com filtros):', {
      totalDecisions: totalCount,
      statusCounts,
      companyId,
      filters: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        agentId: filters.agentId
      }
    })

    // Busca decisões que requerem aprovação humana (pending_approval)
    let pendingQuery = supabase
      .from('tb_agent_decisions')
      .select('id', { count: 'exact' })
      .eq('companies_id', companyId)
      .eq('status', 'pending_approval')

    if (filters.startDate) {
      pendingQuery = pendingQuery.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      pendingQuery = pendingQuery.lte('created_at', filters.endDate)
    }
    if (filters.agentId) {
      pendingQuery = pendingQuery.eq('agent_id', filters.agentId)
    }

    const { count: pendingCount, error: pendingError } = await pendingQuery

    if (pendingError) {
      logger.error('[calculateHumanTransferRate] Erro:', pendingError)
      return 0
    }

    logger.log('[calculateHumanTransferRate] 📊 Valores para cálculo:', {
      totalCount,
      pendingCount: pendingCount || 0,
      pendingCountType: typeof pendingCount,
      totalCountType: typeof totalCount,
      statusCountsFromDistribution: statusCounts
    })

    const rate = (pendingCount || 0) / totalCount * 100

    logger.log('[calculateHumanTransferRate] ✅ Taxa calculada:', {
      totalDecisions: totalCount,
      pendingDecisions: pendingCount || 0,
      rate: `${rate.toFixed(2)}%`,
      calculation: `${pendingCount} / ${totalCount} * 100 = ${rate.toFixed(2)}%`
    })

    return rate
  } catch (error: any) {
    logger.error('[calculateHumanTransferRate] Erro:', error)
    return 0
  }
}

/**
 * Calcula taxa de retrabalho rápido
 * Define como: decisões rejeitadas dentro de 1 hora
 */
async function calculateQuickReworkRate(
  companyId: string,
  filters: KPIFilters
): Promise<number> {
  try {
    let query = supabase
      .from('tb_agent_decisions')
      .select('id, status, created_at, updated_at')
      .eq('companies_id', companyId)
      .eq('status', 'rejected')

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }
    if (filters.agentId) {
      query = query.eq('agent_id', filters.agentId)
    }

    const { data, error } = await query

    if (error || !data) return 0

    const oneHour = 60 * 60 * 1000 // 1 hora em ms
    const quickReworks = data.filter((decision) => {
      const createdAt = new Date(decision.created_at).getTime()
      const updatedAt = new Date(decision.updated_at || decision.created_at).getTime()
      const timeToReject = updatedAt - createdAt
      return timeToReject < oneHour
    })

    const totalDecisions = data.length
    return totalDecisions > 0 ? (quickReworks.length / totalDecisions) * 100 : 0
  } catch (error: any) {
    logger.error('[calculateQuickReworkRate] Erro:', error)
    return 0
  }
}

/**
 * Calcula métricas de UX (CSAT, NPS, Sentimento, Roteamento)
 */
async function calculateUXMetrics(
  companyId: string,
  filters: KPIFilters
): Promise<{
  csatScore: number
  npsScore: number
  averageSentiment: number
  feedbackCount: number
  csatCount: number
  npsCount: number
  sentimentCount: number
  incorrectRoutingFrequency: number
}> {
  try {
    let query = supabase
      .from('tb_feedback')
      .select('csat_score, nps_score, sentiment_score, metadata')
      .eq('companies_id', companyId)

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }
    if (filters.agentId) {
      query = query.eq('agent_id', filters.agentId)
    }

    const { data, error } = await query

    if (error || !data || data.length === 0) {
      return {
        csatScore: 0,
        npsScore: 0,
        averageSentiment: 0,
        feedbackCount: 0,
        csatCount: 0,
        npsCount: 0,
        sentimentCount: 0,
        incorrectRoutingFrequency: 0
      }
    }

    // Calcula CSAT médio
    const csatScores = data
      .map((f) => f.csat_score)
      .filter((score): score is number => score !== null && score !== undefined)
    const csatScore = csatScores.length > 0
      ? csatScores.reduce((sum, score) => sum + score, 0) / csatScores.length
      : 0

    // Calcula NPS médio
    const npsScores = data
      .map((f) => f.nps_score)
      .filter((score): score is number => score !== null && score !== undefined)
    const npsScore = npsScores.length > 0
      ? npsScores.reduce((sum, score) => sum + score, 0) / npsScores.length
      : 0

    // Calcula sentimento médio
    const sentimentScores = data
      .map((f) => f.sentiment_score)
      .filter((score): score is number => score !== null && score !== undefined)
    const averageSentiment = sentimentScores.length > 0
      ? sentimentScores.reduce((sum, score) => sum + score, 0) / sentimentScores.length
      : 0

    // Calcula frequência de roteamento incorreto
    // Assumindo que está no metadata como incorrect_routing: true
    const incorrectRoutings = data.filter(
      (f) => f.metadata?.incorrect_routing === true
    ).length
    const incorrectRoutingFrequency = data.length > 0
      ? (incorrectRoutings / data.length) * 100
      : 0

    return {
      csatScore: Math.round(csatScore * 100) / 100,
      npsScore: Math.round(npsScore * 100) / 100,
      averageSentiment: Math.round(averageSentiment * 100) / 100,
      feedbackCount: data.length,
      csatCount: csatScores.length,
      npsCount: npsScores.length,
      sentimentCount: sentimentScores.length,
      incorrectRoutingFrequency: Math.round(incorrectRoutingFrequency * 100) / 100
    }
  } catch (error: any) {
    logger.error('[calculateUXMetrics] Erro:', error)
    return {
      csatScore: 0,
      npsScore: 0,
      averageSentiment: 0,
      feedbackCount: 0,
      csatCount: 0,
      npsCount: 0,
      sentimentCount: 0,
      incorrectRoutingFrequency: 0
    }
  }
}
