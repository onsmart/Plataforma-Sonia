import { describe, expect, it } from 'vitest'
import {
  buildMetaWebhookSignature,
  maskMetaSignatureForLog,
  verifyMetaSignature,
} from '../utils/meta-webhook-signature'

describe('meta-webhook-signature', () => {
  const secret = 'test-meta-app-secret'
  const payload = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: '123', changes: [] }],
  })

  it('aceita assinatura HMAC correta para o corpo bruto', () => {
    const signature = buildMetaWebhookSignature(payload, secret)
    expect(verifyMetaSignature(payload, signature, secret)).toBe(true)
  })

  it('aceita assinatura quando payload é Buffer', () => {
    const buffer = Buffer.from(payload, 'utf8')
    const signature = buildMetaWebhookSignature(buffer, secret)
    expect(verifyMetaSignature(buffer, signature, secret)).toBe(true)
  })

  it('rejeita assinatura ausente ou com secret errado', () => {
    const signature = buildMetaWebhookSignature(payload, secret)
    expect(verifyMetaSignature(payload, '', secret)).toBe(false)
    expect(verifyMetaSignature(payload, signature, 'outro-secret')).toBe(false)
  })

  it('rejeita header sem prefixo sha256=', () => {
    expect(verifyMetaSignature(payload, 'deadbeef', secret)).toBe(false)
  })

  it('rejeita assinatura alterada (tamper)', () => {
    const signature = buildMetaWebhookSignature(payload, secret)
    const tampered = signature.replace(/a/g, 'b')
    expect(verifyMetaSignature(payload, tampered, secret)).toBe(false)
  })

  it('mascara assinatura para log sem expor hash completo', () => {
    const signature = buildMetaWebhookSignature(payload, secret)
    const masked = maskMetaSignatureForLog(signature)
    expect(masked).toMatch(/^sha256=[0-9a-f]{8}\.\.\.$/)
    expect(masked).not.toBe(signature)
    expect(maskMetaSignatureForLog(undefined)).toBe('(ausente)')
  })
})
