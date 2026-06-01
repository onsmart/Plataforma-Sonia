/**
 * Extrai Phone Number IDs do payload bruto do webhook Meta (WhatsApp Cloud API).
 * Usado apenas para escolher o App Secret correto antes de validar a assinatura HMAC.
 */
export function extractMetaWebhookPhoneNumberIds(rawBody: Buffer | string): string[] {
  try {
    const text = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')
    if (!text.trim()) {
      return []
    }

    const parsed = JSON.parse(text) as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            metadata?: {
              phone_number_id?: unknown
            }
          }
        }>
      }>
    }

    const ids = new Set<string>()
    const entries = Array.isArray(parsed?.entry) ? parsed.entry : []

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : []
      for (const change of changes) {
        const phoneNumberId = String(change?.value?.metadata?.phone_number_id || '').trim()
        if (phoneNumberId) {
          ids.add(phoneNumberId)
        }
      }
    }

    return [...ids]
  } catch {
    return []
  }
}
