import logger from '../../lib/logger'
import { getRedisClient } from '../../lib/redis'

const DEFAULT_TTL_SECONDS = parseInt(process.env.FLOW_INBOUND_IDEMPOTENCY_TTL || '86400', 10)

function normalizeKeyPart(value: string): string {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128)
}

function buildInboundIdempotencyKey(params: {
  channel: string
  integrationId: string
  externalMessageId: string
}): string {
  const channel = normalizeKeyPart(params.channel || 'whatsapp')
  const integrationId = normalizeKeyPart(params.integrationId)
  const externalMessageId = normalizeKeyPart(params.externalMessageId)
  return `flow:inbound:${channel}:${integrationId}:${externalMessageId}`
}

export type InboundIdempotencyClaimResult =
  | { status: 'claimed' }
  | { status: 'duplicate' }
  | { status: 'skipped'; reason: string }

/**
 * Garante processamento unico de mensagem inbound (ex.: wamid do WhatsApp).
 * Retorna duplicate se a chave ja foi processada dentro do TTL.
 */
export async function claimInboundMessageProcessing(params: {
  channel?: string
  integrationId: string
  externalMessageId?: string | null
  ttlSeconds?: number
}): Promise<InboundIdempotencyClaimResult> {
  const integrationId = String(params.integrationId || '').trim()
  const externalMessageId = String(params.externalMessageId || '').trim()

  if (!integrationId || !externalMessageId) {
    return { status: 'skipped', reason: 'missing_integration_or_message_id' }
  }

  const key = buildInboundIdempotencyKey({
    channel: params.channel || 'whatsapp',
    integrationId,
    externalMessageId,
  })

  try {
    const client = await getRedisClient()
    const ttl = Number.isFinite(params.ttlSeconds) && (params.ttlSeconds || 0) > 0
      ? Math.floor(params.ttlSeconds as number)
      : DEFAULT_TTL_SECONDS

    const acquired = await client.set(key, new Date().toISOString(), {
      NX: true,
      EX: ttl,
    })

    if (!acquired) {
      logger.info('[flow-inbound-idempotency] Mensagem inbound duplicada ignorada', {
        integrationId,
        externalMessageIdPreview: externalMessageId.slice(0, 24),
      })
      return { status: 'duplicate' }
    }

    return { status: 'claimed' }
  } catch (error: any) {
    logger.warn('[flow-inbound-idempotency] Falha no lock; seguindo sem idempotencia', {
      integrationId,
      error: error?.message,
    })
    return { status: 'skipped', reason: 'redis_unavailable' }
  }
}
