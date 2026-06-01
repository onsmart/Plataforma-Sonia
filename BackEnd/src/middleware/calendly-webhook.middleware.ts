import crypto from 'crypto'
import type { NextFunction, Request, Response } from 'express'
import { loadCalendlyIntegrationConfig } from '../services/integrations/calendly/calendly.repository'
import logger from '../lib/logger'

const SIGNATURE_HEADER = 'calendly-webhook-signature'

function parseCalendlySignatureHeader(header: string): { t: string; signature: string } | null {
  const parts = String(header || '')
    .split(',')
    .map((p) => p.trim())
  const tPart = parts.find((p) => p.startsWith('t='))
  const v1Part = parts.find((p) => p.startsWith('v1='))
  if (!tPart || !v1Part) return null
  return { t: tPart.slice(2), signature: v1Part.slice(3) }
}

export async function validateCalendlyWebhook(
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

    const signatureHeader = String(req.headers[SIGNATURE_HEADER] || req.headers[SIGNATURE_HEADER.toLowerCase()] || '')
    if (!signatureHeader) {
      res.status(401).json({ error: 'Assinatura Calendly ausente', code: 'CALENDLY_SIGNATURE_MISSING' })
      return
    }

    const parsed = parseCalendlySignatureHeader(signatureHeader)
    if (!parsed) {
      res.status(401).json({ error: 'Assinatura Calendly inválida', code: 'CALENDLY_SIGNATURE_INVALID' })
      return
    }

    let signingKey = ''
    try {
      const config = await loadCalendlyIntegrationConfig(integrationId)
      signingKey = String(config.webhookSigningKey || '').trim()
    } catch {
      res.status(404).json({ error: 'Integração Calendly não encontrada' })
      return
    }

    if (!signingKey) {
      res.status(403).json({ error: 'Webhook Calendly não configurado para esta integração', code: 'CALENDLY_SIGNING_KEY_MISSING' })
      return
    }

    const rawBody =
      typeof req.body === 'string'
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString('utf8')
          : JSON.stringify(req.body || {})

    const signedPayload = `${parsed.t}.${rawBody}`
    const expected = crypto.createHmac('sha256', signingKey).update(signedPayload, 'utf8').digest('hex')

    const expectedBuf = Buffer.from(expected, 'utf8')
    const receivedBuf = Buffer.from(parsed.signature, 'utf8')
    if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
      logger.warn('[validateCalendlyWebhook] Assinatura rejeitada', { integrationId })
      res.status(401).json({ error: 'Assinatura Calendly inválida', code: 'CALENDLY_SIGNATURE_MISMATCH' })
      return
    }

    try {
      req.body = JSON.parse(rawBody)
    } catch {
      req.body = {}
    }

    next()
  } catch (error) {
    logger.error('[validateCalendlyWebhook] Erro:', error)
    res.status(500).json({ error: 'Erro ao validar webhook Calendly' })
  }
}
