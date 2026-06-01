const seenEvents = new Map<string, number>()
const TTL_MS = 24 * 60 * 60 * 1000

function purgeExpired(now: number) {
  for (const [key, expiresAt] of seenEvents.entries()) {
    if (expiresAt <= now) seenEvents.delete(key)
  }
}

export function buildWebhookEventKey(provider: string, eventId: string): string {
  return `${provider}:${String(eventId || '').trim()}`
}

export function isDuplicateWebhookEvent(provider: string, eventId: string): boolean {
  const key = buildWebhookEventKey(provider, eventId)
  if (!eventId) return false
  return seenEvents.has(key)
}

export function markWebhookEventProcessed(provider: string, eventId: string): void {
  const key = buildWebhookEventKey(provider, eventId)
  if (!eventId) return
  const now = Date.now()
  purgeExpired(now)
  seenEvents.set(key, now + TTL_MS)
}
