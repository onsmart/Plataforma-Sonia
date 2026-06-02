/**
 * Extrai Phone Number IDs do payload bruto do webhook Meta (WhatsApp Cloud API).
 * Usado apenas para escolher o App Secret correto antes de validar a assinatura HMAC.
 */
function collectPhoneNumberIds(value: unknown, ids: Set<string>): void {
  if (value === null || value === undefined) return

  if (Array.isArray(value)) {
    for (const item of value) collectPhoneNumberIds(item, ids)
    return
  }

  if (typeof value !== 'object') return

  const record = value as Record<string, unknown>
  if ('phone_number_id' in record) {
    const id = String(record.phone_number_id ?? '').trim()
    if (id) ids.add(id)
  }

  for (const nested of Object.values(record)) {
    collectPhoneNumberIds(nested, ids)
  }
}

export function extractMetaWebhookPhoneNumberIds(rawBody: Buffer | string): string[] {
  try {
    const text = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')
    if (!text.trim()) {
      return []
    }

    const parsed = JSON.parse(text) as unknown
    const ids = new Set<string>()
    collectPhoneNumberIds(parsed, ids)
    return [...ids]
  } catch {
    return []
  }
}
