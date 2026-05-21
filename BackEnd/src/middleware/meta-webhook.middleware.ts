import { Request, Response, NextFunction } from 'express'
import logger from '../lib/logger'
import {
  maskMetaSignatureForLog,
  verifyMetaSignature,
} from '../utils/meta-webhook-signature'

export function getWhatsAppMetaAppSecret(): string {
  return String(process.env.WHATSAPP_META_APP_SECRET || '').trim()
}

/**
 * Corpo deve ser Buffer (express.raw) — valida X-Hub-Signature-256 antes do parse JSON.
 */
export function validateMetaWhatsAppWebhook(req: Request, res: Response, next: NextFunction) {
  const secret = getWhatsAppMetaAppSecret()
  const signatureHeader = req.headers['x-hub-signature-256'] as string | undefined
  const rawBody = Buffer.isBuffer(req.body) ? req.body : null

  if (!secret) {
    logger.error('[validateMetaWhatsAppWebhook] WHATSAPP_META_APP_SECRET não configurado', {
      path: req.path,
      ip: req.ip || req.socket?.remoteAddress,
    })
    return res.status(403).json({
      error: 'Assinatura do webhook inválida',
      code: 'WEBHOOK_SIGNATURE_INVALID',
    })
  }

  if (!signatureHeader) {
    logger.warn('[validateMetaWhatsAppWebhook] POST sem X-Hub-Signature-256', {
      path: req.path,
      ip: req.ip || req.socket?.remoteAddress,
      contentType: req.headers['content-type'],
    })
    return res.status(403).json({
      error: 'Assinatura do webhook inválida',
      code: 'WEBHOOK_SIGNATURE_INVALID',
    })
  }

  if (!rawBody) {
    logger.warn('[validateMetaWhatsAppWebhook] Corpo bruto ausente (middleware raw body requerido)', {
      path: req.path,
      bodyType: typeof req.body,
    })
    return res.status(403).json({
      error: 'Assinatura do webhook inválida',
      code: 'WEBHOOK_SIGNATURE_INVALID',
    })
  }

  if (!verifyMetaSignature(rawBody, signatureHeader, secret)) {
    logger.warn('[validateMetaWhatsAppWebhook] Assinatura HMAC inválida', {
      path: req.path,
      ip: req.ip || req.socket?.remoteAddress,
      signature: maskMetaSignatureForLog(signatureHeader),
      payloadBytes: rawBody.length,
    })
    return res.status(403).json({
      error: 'Assinatura do webhook inválida',
      code: 'WEBHOOK_SIGNATURE_INVALID',
    })
  }

  next()
}

export function parseMetaWhatsAppWebhookJson(req: Request, res: Response, next: NextFunction) {
  if (!Buffer.isBuffer(req.body)) {
    return next()
  }

  try {
    const text = req.body.toString('utf8')
    req.body = text.length ? JSON.parse(text) : {}
    next()
  } catch {
    logger.warn('[parseMetaWhatsAppWebhookJson] JSON inválido no webhook Meta', {
      path: req.path,
      payloadBytes: req.body.length,
    })
    return res.status(400).json({
      error: 'Payload JSON inválido',
      code: 'WEBHOOK_JSON_INVALID',
    })
  }
}
