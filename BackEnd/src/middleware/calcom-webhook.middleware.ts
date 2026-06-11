import crypto from 'crypto'
import type { NextFunction, Request, Response } from 'express'
import { loadCalComIntegrationConfig } from '../services/integrations/calcom/calcom.repository'
import logger from '../lib/logger'

const SIGNATURE_HEADER = 'x-cal-signature-256'

export async function validateCalComWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const integrationId = String(req.params?.id || '').trim()
    if (!integrationId) {
      res.status(400).json({ error: 'integration_id obrigatório' })
      return
    }

    const signatureHeader = String(
      req.headers[SIGNATURE_HEADER] || req.headers[SIGNATURE_HEADER.toLowerCase()] || ''
    ).trim()
    if (!signatureHeader) {
      res.status(401).json({ error: 'Assinatura Cal.com ausente', code: 'CALCOM_SIGNATURE_MISSING' })
      return
    }

    let webhookSecret = ''
    try {
      const config = await loadCalComIntegrationConfig(integrationId)
      webhookSecret = String(config.webhookSecret || '').trim()
    } catch {
      res.status(404).json({ error: 'Integração Cal.com não encontrada' })
      return
    }

    if (!webhookSecret) {
      res.status(403).json({ error: 'Webhook Cal.com não configurado para esta integração', code: 'CALCOM_SECRET_MISSING' })
      return
    }

    const rawBody =
      typeof req.body === 'string'
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString('utf8')
          : JSON.stringify(req.body || {})

    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody, 'utf8')
      .digest('hex')

    const expectedBuf = Buffer.from(expected, 'utf8')
    const receivedBuf = Buffer.from(signatureHeader, 'utf8')
    if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
      logger.warn('[validateCalComWebhook] Assinatura rejeitada', { integrationId })
      res.status(401).json({ error: 'Assinatura Cal.com inválida', code: 'CALCOM_SIGNATURE_MISMATCH' })
      return
    }

    try {
      req.body = JSON.parse(rawBody)
    } catch {
      req.body = {}
    }

    next()
  } catch (error) {
    logger.error('[validateCalComWebhook] Erro:', error)
    res.status(500).json({ error: 'Erro ao validar webhook Cal.com' })
  }
}
