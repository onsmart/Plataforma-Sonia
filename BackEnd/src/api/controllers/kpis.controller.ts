import { Request, Response } from 'express'
import { calculateKPIs, KPIFilters, KPIMetrics } from '../../services/kpis/kpis.service'
import { getUserIdAndCompanyIdByEmail } from '../../utils/company-helper'
import logger from '../../lib/logger'
import { getAuthenticatedEmail } from '../../utils/request-auth'

const ZERO_KPIS: KPIMetrics = {
  taskSuccessRate: 0,
  averageResponseTime: 0,
  taskAbandonmentRate: 0,
  costPerInteraction: 0,
  totalCost: 0,
  violationsCount: 0,
  hallucinationsFlagged: 0,
  humanTransferRate: 0,
  quickReworkRate: 0,
  csatScore: 0,
  npsScore: 0,
  averageSentiment: 0,
  feedbackCount: 0,
  csatCount: 0,
  npsCount: 0,
  sentimentCount: 0,
  incorrectRoutingFrequency: 0
}

/**
 * GET /kpis
 * Retorna todos os KPIs calculados
 */
export async function getKPIs(req: Request, res: Response) {
  try {
    const userEmail = getAuthenticatedEmail(req)

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Email do usuário não fornecido. Token de autenticação inválido ou email não fornecido'
      })
    }

    // Extrai filtros opcionais da query string
    const filters: KPIFilters = {
      email: userEmail,
      agentId: req.query.agentId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      channel: req.query.channel as string | undefined
    }

    logger.log('[getKPIs] Calculando KPIs:', filters)

    let kpis: KPIMetrics
    try {
      kpis = await calculateKPIs(filters)
    } catch (calcErr: any) {
      if (calcErr?.message?.includes('Company ID não encontrado')) {
        logger.warn('[getKPIs] Sem workspace — retornando KPIs zerados')
        return res.status(403).json({
          success: false,
          error: 'Workspace não configurado',
          code: 'WORKSPACE_REQUIRED',
          data: ZERO_KPIS,
          filters,
        })
      }
      throw calcErr
    }

    logger.log('[getKPIs] KPIs calculados, retornando resposta:', {
      taskSuccessRate: kpis.taskSuccessRate,
      averageResponseTime: kpis.averageResponseTime,
      violationsCount: kpis.violationsCount,
      costPerInteraction: kpis.costPerInteraction,
      csatScore: kpis.csatScore,
      npsScore: kpis.npsScore
    })

    return res.json({
      success: true,
      data: kpis,
      filters
    })
  } catch (error: any) {
    logger.error('[getKPIs] Erro:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao calcular KPIs'
    })
  }
}

/**
 * POST /kpis/feedback
 * Salva feedback do usuário (CSAT, NPS, Sentimento)
 */
export async function saveFeedback(req: Request, res: Response) {
  try {
    const userEmail = getAuthenticatedEmail(req)

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Email do usuário não fornecido'
      })
    }

    const { agentId, conversationId, channel, csatScore, npsScore, sentimentScore, feedbackText, metadata } = req.body

    // Validação básica
    if (csatScore !== undefined && (csatScore < 1 || csatScore > 5)) {
      return res.status(400).json({
        success: false,
        error: 'CSAT score deve estar entre 1 e 5'
      })
    }

    if (npsScore !== undefined && (npsScore < 0 || npsScore > 10)) {
      return res.status(400).json({
        success: false,
        error: 'NPS score deve estar entre 0 e 10'
      })
    }

    if (sentimentScore !== undefined && (sentimentScore < -1 || sentimentScore > 1)) {
      return res.status(400).json({
        success: false,
        error: 'Sentiment score deve estar entre -1 e 1'
      })
    }

    const { companyId, userId } = await getUserIdAndCompanyIdByEmail(userEmail)

    if (!companyId) {
      return res.status(404).json({
        success: false,
        error: 'Company não encontrada'
      })
    }

    const { supabase } = await import('../../lib/supabase')

    const { data, error } = await supabase
      .from('tb_feedback')
      .insert({
        companies_id: companyId,
        user_id: userId || null,
        agent_id: agentId || null,
        conversation_id: conversationId || null,
        channel: channel || 'webchat',
        csat_score: csatScore || null,
        nps_score: npsScore || null,
        sentiment_score: sentimentScore || null,
        feedback_text: feedbackText || null,
        metadata: metadata || {}
      })
      .select('id')
      .single()

    if (error) {
      logger.error('[saveFeedback] Erro ao salvar feedback:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao salvar feedback'
      })
    }

    logger.log('[saveFeedback] ✅ Feedback salvo:', { id: data.id })

    return res.json({
      success: true,
      data: { id: data.id }
    })
  } catch (error: any) {
    logger.error('[saveFeedback] Erro:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao salvar feedback'
    })
  }
}
