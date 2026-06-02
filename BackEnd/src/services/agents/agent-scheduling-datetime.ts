import { chatText } from '../llm/openai'

export interface ExtractedDateTime {
  date: string | null
  time: string | null
  confidence: 'high' | 'low'
}

const DATE_TIME_SCHEMA = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'scheduling_datetime',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['date', 'time', 'confidence'],
      properties: {
        date: { type: ['string', 'null'], description: 'YYYY-MM-DD ou null' },
        time: { type: ['string', 'null'], description: 'HH:MM 24h ou null' },
        confidence: { type: 'string', enum: ['high', 'low'] },
      },
    },
  },
}

export async function extractDateTimeFromMessage(message: string): Promise<ExtractedDateTime> {
  const text = String(message || '').trim()
  if (!text) {
    return { date: null, time: null, confidence: 'low' }
  }

  const regexDate = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/)
  const regexDateShort = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})\b/)
  const regexTime = text.match(/\b(\d{1,2})[:h](\d{2})\b/i)

  if (regexDate) {
    const date = buildBrazilianIsoDate(regexDate[1], regexDate[2], regexDate[3])
    const time = regexTime ? `${regexTime[1].padStart(2, '0')}:${regexTime[2]}` : null
    return { date: trySwapMonthDayIfPast(date, todayIsoInSaoPaulo()), time, confidence: 'high' }
  }

  if (regexDateShort) {
    const date = buildBrazilianIsoDateShort(regexDateShort[1], regexDateShort[2])
    const time = regexTime ? `${regexTime[1].padStart(2, '0')}:${regexTime[2]}` : null
    return { date: trySwapMonthDayIfPast(date, todayIsoInSaoPaulo()), time, confidence: 'high' }
  }

  const result = await chatText({
    system: `Extraia data e hora pedidas pelo usuario em portugues (Brasil). Timezone: America/Sao_Paulo.
Responda JSON: date (YYYY-MM-DD ou null), time (HH:MM ou null), confidence high|low.
Exemplos: "terca as 15h" -> proxima terca; "amanha 10:30" -> data calculada.`,
    user: `Mensagem: ${text}\nData de referencia (hoje): ${todayIsoInSaoPaulo()}`,
    model: 'gpt-4o-mini',
    temperature: 0,
    maxTokens: 120,
    responseFormat: DATE_TIME_SCHEMA,
  })

  if (!result.success) {
    return { date: null, time: null, confidence: 'low' }
  }

  try {
    const parsed = JSON.parse(String(result.content || '{}')) as ExtractedDateTime
    const today = todayIsoInSaoPaulo()
    const rawDate = parsed.date ? String(parsed.date).trim() : null
    return {
      date: rawDate ? trySwapMonthDayIfPast(rawDate, today) : null,
      time: parsed.time ? String(parsed.time).trim() : null,
      confidence: parsed.confidence === 'high' ? 'high' : 'low',
    }
  } catch {
    return { date: null, time: null, confidence: 'low' }
  }
}

export function todayIsoInSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** DD/MM — primeiro segmento é dia, segundo é mês (padrão Brasil). */
function buildBrazilianIsoDate(dayRaw: string, monthRaw: string, yearRaw: string): string {
  const day = dayRaw.padStart(2, '0')
  const month = monthRaw.padStart(2, '0')
  let year = String(yearRaw || '').trim()
  if (year.length === 2) year = `20${year}`
  if (!year) {
    year = todayIsoInSaoPaulo().slice(0, 4)
  }
  return `${year}-${month}-${day}`
}

function buildBrazilianIsoDateShort(dayRaw: string, monthRaw: string): string {
  const today = todayIsoInSaoPaulo()
  let year = today.slice(0, 4)
  const day = dayRaw.padStart(2, '0')
  const month = monthRaw.padStart(2, '0')
  let candidate = `${year}-${month}-${day}`
  if (candidate < today) {
    year = String(Number(year) + 1)
    candidate = `${year}-${month}-${day}`
  }
  return candidate
}

/**
 * Corrige YYYY-MM-DD vindos da IA no formato americano (MM-DD) quando a data já passou
 * mas a troca dia↔mês cai no futuro — ex.: 2026-03-06 → 2026-06-03 para "03/06".
 */
export function trySwapMonthDayIfPast(dateIso: string, todayIso: string): string {
  const normalized = String(dateIso || '').trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized)
  if (!match) return normalized

  const year = match[1]
  const partA = match[2]
  const partB = match[3]
  if (Number(partA) > 12 || Number(partB) > 12) return normalized

  if (normalized >= todayIso) return normalized

  const swapped = `${year}-${partB}-${partA}`
  if (swapped >= todayIso) return swapped

  return normalized
}

/** Limites do dia civil em America/Sao_Paulo (UTC−3 fixo) para consulta Calendly. */
export function brazilDayBoundsUtc(dateIso: string): { startTime: string; endTime: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateIso || '').trim())
  if (!match) {
    const start = new Date(Date.now() + 60 * 60 * 1000)
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
    return { startTime: start.toISOString(), endTime: end.toISOString() }
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const start = new Date(Date.UTC(year, month - 1, day, 3, 0, 0))
  const end = new Date(Date.UTC(year, month - 1, day + 1, 3, 0, 0))
  return { startTime: start.toISOString(), endTime: end.toISOString() }
}

export function parseCalendlySlotId(slotId: string): { startsAt: string } | null {
  const normalized = String(slotId || '').trim()
  if (!normalized) return null
  try {
    const parsed = JSON.parse(Buffer.from(normalized, 'base64url').toString('utf8')) as {
      startsAt?: string
    }
    const startsAt = String(parsed.startsAt || '').trim()
    return startsAt ? { startsAt } : null
  } catch {
    return null
  }
}

export function isSlotStartInPast(startsAt: string, bufferMs = 90_000): boolean {
  const ms = Date.parse(startsAt)
  if (!Number.isFinite(ms)) return true
  return ms <= Date.now() + bufferMs
}

function slotLocalParts(startsAt: string): { date: string; time: string } | null {
  const slotDate = new Date(startsAt)
  if (Number.isNaN(slotDate.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(slotDate)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  const h = parts.find((p) => p.type === 'hour')?.value
  const min = parts.find((p) => p.type === 'minute')?.value
  if (!y || !m || !d || !h || !min) return null
  return { date: `${y}-${m}-${d}`, time: `${h}:${min}` }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map((v) => Number(v))
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1
  return h * 60 + m
}

export function slotMatchesRequestedTime(
  startsAt: string,
  preferredDate: string | null,
  preferredTime: string | null
): boolean {
  if (!preferredDate && !preferredTime) return false
  const local = slotLocalParts(startsAt)
  if (!local) return false
  if (preferredDate && local.date !== preferredDate) return false
  if (preferredTime && local.time !== preferredTime) return false
  return true
}

export type CalendlySlotPick = {
  slotId: string
  startsAt: string
  match: 'exact' | 'closest' | 'same_day'
}

export function pickCalendlySlotForRequest(
  slots: Array<{ slotId?: string; startsAt?: string }>,
  preferredDate: string | null,
  preferredTime: string | null
): CalendlySlotPick | null {
  const valid = slots.filter((s) => s.slotId && s.startsAt) as Array<{ slotId: string; startsAt: string }>
  if (valid.length === 0) return null

  const exact = valid.find((slot) => slotMatchesRequestedTime(slot.startsAt, preferredDate, preferredTime))
  if (exact) return { ...exact, match: 'exact' }

  const sameDay = preferredDate
    ? valid.filter((slot) => slotMatchesRequestedTime(slot.startsAt, preferredDate, null))
  : valid
  if (sameDay.length === 0) return null

  if (preferredTime) {
    const target = timeToMinutes(preferredTime)
    if (target >= 0) {
      const ranked = sameDay
        .map((slot) => {
          const local = slotLocalParts(slot.startsAt)
          const minutes = local ? timeToMinutes(local.time) : -1
          return { slot, distance: minutes >= 0 ? Math.abs(minutes - target) : Number.MAX_SAFE_INTEGER }
        })
        .sort((a, b) => a.distance - b.distance)
      const best = ranked[0]
      if (best && best.distance <= 120) {
        return { ...best.slot, match: 'closest' }
      }
    }
  }

  if (sameDay.length === 1) {
    return { ...sameDay[0], match: 'same_day' }
  }

  return null
}
