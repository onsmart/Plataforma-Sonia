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
      incorrectRoutingFrequency: uxMetrics.incorrectRoutingFrequency
    }

    logger.log('[calculateKPIs] ✅ KPIs calculados com sucesso:', {
      taskSuccessRate: result.taskSuccessRate,
      averageResponseTime: result.averageResponseTime,
      violationsCount: result.violationsCount,
      costPerInteraction: result.costPerInteraction,
      csatScore: result.csatScore,
      npsScore: result.npsScore
    })
    
    return result
  } catch (error: any) {
    logger.error('[calculateKPIs] ❌ Erro ao calcular KPIs:', error)
    throw error
  }
}

/**
 * Calcula taxa de sucesso de tarefas (workflows completados com sucesso)
 */
async function calculateTaskSuccessRate(
  companyId: string,
  filters: KPIFilters
): Promise<number> {
  try {
    let query = supabase
      .from('tb_system_logs')
      .select('id, metadata', { count: 'exact' })
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

    const { data, count, error } = await query

    if (error) {
      logger.error('[calculateTaskSuccessRate] Erro:', error)
      return 0
    }

    if (!count || count === 0) return 0

    // Conta quantos tiveram success: true no metadata
    const successful = data?.filter(
      (log) => log.metadata?.success === true
    ).length || 0

    return (successful / count) * 100
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

    if (error) {
      logger.error('[calculateAverageResponseTime] Erro na query:', error)
      return 0
    }

    if (!data || data.length === 0) {
      logger.log('[calculateAverageResponseTime] Nenhuma mensagem encontrada')
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
      .select('total_tokens, model, provider, created_at, conversation_id')
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
      
      // Aproximação: assume 50% input, 50% output
      const inputTokens = usage.total_tokens * 0.5
      const outputTokens = usage.total_tokens * 0.5
      
      const cost = (inputTokens / 1_000_000) * prices.input + (outputTokens / 1_000_000) * prices.output
      totalCost += cost

      // Usa conversation_id ou cria ID único baseado em timestamp
      const interactionId = usage.conversation_id || `interaction_${usage.created_at}`
      interactions.add(interactionId)
    }

    const costPerInteraction = interactions.size > 0 ? totalCost / interactions.size : 0

    return {
      costPerInteraction: Math.round(costPerInteraction * 100) / 100, // 2 casas decimais
      totalCost: Math.round(totalCost * 100) / 100
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
 */
async function calculateHumanTransferRate(
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
      logger.log('[calculateHumanTransferRate] Nenhuma integração WhatsApp encontrada')
      return 0
    }

    const integrationIds = integrations.map(i => i.id)

    // Busca conversas que foram transferidas para humano
    // Assumindo que há um campo status ou metadata indicando human_takeover
    let query = supabase
      .from('tb_whatsapp_conversations')
      .select('id, status, metadata', { count: 'exact' })
      .in('integrations_id', integrationIds)

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }

    const { data, count, error } = await query

    if (error || !count || count === 0) return 0

    // Conta conversas com human_takeover no status ou metadata
    const humanTakeovers = data?.filter(
      (conv) => conv.status === 'human_takeover' || conv.metadata?.human_takeover === true
    ).length || 0

    return (humanTakeovers / count) * 100
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
      incorrectRoutingFrequency: Math.round(incorrectRoutingFrequency * 100) / 100
    }
  } catch (error: any) {
    logger.error('[calculateUXMetrics] Erro:', error)
    return {
      csatScore: 0,
      npsScore: 0,
      averageSentiment: 0,
      incorrectRoutingFrequency: 0
    }
  }
}
