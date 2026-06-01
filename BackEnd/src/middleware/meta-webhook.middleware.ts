import { Request, Response, NextFunction } from 'express'
import logger from '../lib/logger'
import {
  maskMetaSignatureForLog,
  verifyMetaSignature,
} from '../utils/meta-webhook-signature'
import {
  getEnvMetaAppSecret,
  resolveMetaWebhookVerificationSecrets,
} from '../services/integrations/whatsapp/meta-webhook-secret.service'

/** @deprecated Prefer getEnvMetaAppSecret() — mantido para compatibilidade com index.ts */
export function getWhatsAppMetaAppSecret(): string {
  return getEnvMetaAppSecret()
}

/**
 * Corpo deve ser Buffer (express.raw) — valida X-Hub-Signature-256 antes do parse JSON.
 * Aceita WHATSAPP_META_APP_SECRET (env) ou meta_app_secret salvo em tb_integrations.
 */
export async function validateMetaWhatsAppWebhook(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const signatureHeader = req.headers['x-hub-signature-256'] as string | undefined
  const rawBody = Buffer.isBuffer(req.body) ? req.body : null

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

  let candidateSecrets: string[] = []
  try {
    candidateSecrets = await resolveMetaWebhookVerificationSecrets(rawBody)
  } catch (error: unknown) {
    logger.error('[validateMetaWhatsAppWebhook] Erro ao resolver App Secret', {
      path: req.path,
      error: error instanceof Error ? error.message : String(error),
    })
    return res.status(403).json({
      error: 'Assinatura do webhook inválida',
      code: 'WEBHOOK_SIGNATURE_INVALID',
    })
  }

  if (candidateSecrets.length === 0) {
    logger.error('[validateMetaWhatsAppWebhook] Nenhum App Secret configurado (env ou integração)', {
      path: req.path,
      ip: req.ip || req.socket?.remoteAddress,
    })
    return res.status(403).json({
      error: 'Assinatura do webhook inválida',
      code: 'WEBHOOK_SIGNATURE_INVALID',
    })
  }

  const signatureValid = candidateSecrets.some((secret) =>
    verifyMetaSignature(rawBody, signatureHeader, secret)
  )

  if (!signatureValid) {
    logger.warn('[validateMetaWhatsAppWebhook] Assinatura HMAC inválida', {
      path: req.path,
      ip: req.ip || req.socket?.remoteAddress,
      signature: maskMetaSignatureForLog(signatureHeader),
      payloadBytes: rawBody.length,
      secretCandidates: candidateSecrets.length,
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
