import { Request, Response } from 'express'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

const emptySummary = {
  total_interactions: 0,
  total_cost: 0,
  active_channels: 0,
  total_tokens: 0,
  rag_usage_count: 0,
  rag_usage_rate: 0,
}

export type InsightsApiPayload = {
  overview: { name: string; date: string; conversations: number; cost: number }[]
  channels: { name: string; value: number }[]
  agents: { agent_name: string; avg_confidence: number }[]
  summary: typeof emptySummary
  issues: string[]
}

/**
 * GET /insights?period=7d|30d
 * Agrega RPCs de analytics (service role) — evita falhas de RPC direto no browser.
 */
export async function getInsightsApi(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email

    if (!userEmail) {
      return res.json({
        overview: [],
        channels: [],
        agents: [],
        summary: emptySummary,
        issues: [],
      } satisfies InsightsApiPayload)
    }

    const period = (req.query.period as string) || '7d'
    const daysParam = parseInt(String(req.query.days || ''), 10)
    const days =
      Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 90
        ? daysParam
        : period === '30d'
          ? 30
          : 7
    const issues: string[] = []

    const [overviewResult, channelsResult, summaryResult, agentsResult] = await Promise.all([
      supabase.rpc('sp_get_analytics_overview_by_email', {
        p_email: userEmail,
        p_days: days,
      }),
      supabase.rpc('sp_get_analytics_channel_distribution_by_email', {
        p_email: userEmail,
        p_days: days,
      }),
      supabase.rpc('sp_get_analytics_summary_by_email', {
        p_email: userEmail,
        p_days: days,
      }),
      supabase.rpc('sp_get_analytics_agent_performance_by_email', {
        p_email: userEmail,
        p_days: days,
      }),
    ])

    if (overviewResult.error) {
      logger.error('[getInsightsApi] overview:', overviewResult.error)
      issues.push('Histórico de interações indisponível.')
    }
    if (channelsResult.error) {
      logger.error('[getInsightsApi] channels:', channelsResult.error)
      issues.push('Distribuição por canal indisponível.')
    }
    if (summaryResult.error) {
      logger.error('[getInsightsApi] summary:', summaryResult.error)
      issues.push('Resumo consolidado indisponível.')
    }
    if (agentsResult.error) {
      logger.error('[getInsightsApi] agents:', agentsResult.error)
      issues.push('Performance por agente indisponível.')
    }

    const overview =
      overviewResult.data && Array.isArray(overviewResult.data) ? overviewResult.data : []
    const channels =
      channelsResult.data && Array.isArray(channelsResult.data) ? channelsResult.data : []
    const agents =
      agentsResult.data && Array.isArray(agentsResult.data) ? agentsResult.data : []
    const summary =
      summaryResult.data && Array.isArray(summaryResult.data) && summaryResult.data.length > 0
        ? summaryResult.data[0]
        : emptySummary

    return res.json({
      overview,
      channels,
      agents,
      summary,
      issues,
    } satisfies InsightsApiPayload)
  } catch (error: any) {
    logger.error('[getInsightsApi] Erro:', error)
    return res.json({
      overview: [],
      channels: [],
      agents: [],
      summary: emptySummary,
      issues: ['Erro ao carregar analytics.'],
    } satisfies InsightsApiPayload)
  }
}
