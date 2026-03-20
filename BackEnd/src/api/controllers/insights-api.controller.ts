import { Request, Response } from 'express'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

const emptySummary = {
  total_interactions: 0,
  total_cost: 0,
  active_channels: 0,
  total_tokens: 0,
  rag_usage_count: 0,
  rag_usage_rate: 0
}

/**
 * GET /insights?period=7d|30d
 * Mesma lógica da Edge Function (RPCs de analytics por email).
 */
export async function getInsightsApi(req: Request, res: Response) {
  try {
    // Mesmo email do JWT usado no front nas RPCs (Insights/Cockpit)
    const userEmail = req.user?.email

    if (!userEmail) {
      return res.json({
        overview: [],
        channels: [],
        summary: emptySummary
      })
    }

    const period = (req.query.period as string) || '7d'
    const days = period === '30d' ? 30 : 7

    const [overviewResult, channelsResult, summaryResult] = await Promise.all([
      supabase.rpc('sp_get_analytics_overview_by_email', {
        p_email: userEmail,
        p_days: days
      }),
      supabase.rpc('sp_get_analytics_channel_distribution_by_email', {
        p_email: userEmail,
        p_days: days
      }),
      supabase.rpc('sp_get_analytics_summary_by_email', {
        p_email: userEmail,
        p_days: days
      })
    ])

    if (overviewResult.error) {
      logger.error('[getInsightsApi] overview:', overviewResult.error)
    }
    if (channelsResult.error) {
      logger.error('[getInsightsApi] channels:', channelsResult.error)
    }
    if (summaryResult.error) {
      logger.error('[getInsightsApi] summary:', summaryResult.error)
    }

    const overview = overviewResult.data && Array.isArray(overviewResult.data) ? overviewResult.data : []
    const channels = channelsResult.data && Array.isArray(channelsResult.data) ? channelsResult.data : []
    const summary =
      summaryResult.data && Array.isArray(summaryResult.data) && summaryResult.data.length > 0
        ? summaryResult.data[0]
        : emptySummary

    return res.json({ overview, channels, summary })
  } catch (error: any) {
    logger.error('[getInsightsApi] Erro:', error)
    return res.json({
      overview: [],
      channels: [],
      summary: emptySummary
    })
  }
}
