import crypto from 'crypto'

const SIGNATURE_PREFIX = 'sha256='

function toPayloadBuffer(payload: string | Buffer): Buffer {
  return typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload
}

/**
 * Gera o header X-Hub-Signature-256 esperado pela Meta (WhatsApp Cloud API).
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
export function buildMetaWebhookSignature(payload: string | Buffer, secret: string): string {
  const digest = crypto.createHmac('sha256', secret).update(toPayloadBuffer(payload)).digest('hex')
  return `${SIGNATURE_PREFIX}${digest}`
}

/**
 * Valida HMAC SHA-256 do corpo bruto do webhook Meta (header X-Hub-Signature-256).
 */
export function verifyMetaSignature(
  payload: string | Buffer,
  signatureHeader: string,
  secret: string
): boolean {
  const normalizedSecret = String(secret || '').trim()
  const normalizedHeader = String(signatureHeader || '').trim()

  if (!normalizedSecret || !normalizedHeader) {
    return false
  }

  const lowerHeader = normalizedHeader.toLowerCase()
  if (!lowerHeader.startsWith(SIGNATURE_PREFIX)) {
    return false
  }

  const receivedHex = normalizedHeader.slice(SIGNATURE_PREFIX.length).trim()
  if (!/^[0-9a-f]+$/i.test(receivedHex) || receivedHex.length % 2 !== 0) {
    return false
  }

  const expectedHex = crypto
    .createHmac('sha256', normalizedSecret)
    .update(toPayloadBuffer(payload))
    .digest('hex')

  const receivedBuf = Buffer.from(receivedHex, 'hex')
  const expectedBuf = Buffer.from(expectedHex, 'hex')

  if (receivedBuf.length !== expectedBuf.length) {
    return false
  }

  return crypto.timingSafeEqual(receivedBuf, expectedBuf)
}

export function maskMetaSignatureForLog(signatureHeader: string | undefined): string {
  const normalized = String(signatureHeader || '').trim()
  if (!normalized) {
    return '(ausente)'
  }

  const hex = normalized.toLowerCase().startsWith(SIGNATURE_PREFIX)
    ? normalized.slice(SIGNATURE_PREFIX.length)
    : normalized

  if (hex.length <= 8) {
    return `${SIGNATURE_PREFIX}***`
  }

  return `${SIGNATURE_PREFIX}${hex.slice(0, 8)}...`
}
