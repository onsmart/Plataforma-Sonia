import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

import {
  buildMetaWebhookSignature,
} from '../utils/meta-webhook-signature'
import {
  parseMetaWhatsAppWebhookJson,
  validateMetaWhatsAppWebhook,
} from '../middleware/meta-webhook.middleware'

function createRes() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status: vi.fn((code: number) => {
      res.statusCode = code
      return res
    }),
    json: vi.fn((payload: unknown) => {
      res.body = payload
      return res
    }),
  }
  return res
}

describe('validateMetaWhatsAppWebhook', () => {
  const secret = 'middleware-test-secret'
  const payload = '{"object":"whatsapp_business_account"}'

  beforeEach(() => {
    vi.unstubAllEnvs()
    process.env.WHATSAPP_META_APP_SECRET = secret
  })

  it('retorna 403 quando header de assinatura está ausente', () => {
    const req = { body: Buffer.from(payload), headers: {}, path: '/whatsapp/webhook', ip: '127.0.0.1' } as any
    const res = createRes()
    const next = vi.fn()

    validateMetaWhatsAppWebhook(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.body?.code).toBe('WEBHOOK_SIGNATURE_INVALID')
    expect(next).not.toHaveBeenCalled()
  })

  it('retorna 403 quando assinatura não confere', () => {
    const req = {
      body: Buffer.from(payload),
      headers: { 'x-hub-signature-256': 'sha256=deadbeef' },
      path: '/whatsapp/webhook',
      ip: '127.0.0.1',
    } as any
    const res = createRes()
    const next = vi.fn()

    validateMetaWhatsAppWebhook(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('chama next quando assinatura é válida', () => {
    const signature = buildMetaWebhookSignature(payload, secret)
    const req = {
      body: Buffer.from(payload),
      headers: { 'x-hub-signature-256': signature },
      path: '/whatsapp/webhook',
      ip: '127.0.0.1',
    } as any
    const res = createRes()
    const next = vi.fn()

    validateMetaWhatsAppWebhook(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('parseMetaWhatsAppWebhookJson converte Buffer em objeto', () => {
    const req = { body: Buffer.from(payload), path: '/whatsapp/webhook' } as any
    const res = createRes()
    const next = vi.fn()

    parseMetaWhatsAppWebhookJson(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.body).toEqual({ object: 'whatsapp_business_account' })
  })
})
