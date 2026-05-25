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
    const day = regexDate[1].padStart(2, '0')
    const month = regexDate[2].padStart(2, '0')
    let year = regexDate[3]
    if (year.length === 2) year = `20${year}`
    const date = `${year}-${month}-${day}`
    const time = regexTime ? `${regexTime[1].padStart(2, '0')}:${regexTime[2]}` : null
    return { date, time, confidence: 'high' }
  }

  if (regexDateShort) {
    const day = regexDateShort[1].padStart(2, '0')
    const month = regexDateShort[2].padStart(2, '0')
    const today = todayIsoInSaoPaulo()
    let year = today.slice(0, 4)
    const candidate = `${year}-${month}-${day}`
    if (candidate < today) {
      year = String(Number(year) + 1)
    }
    const date = `${year}-${month}-${day}`
    const time = regexTime ? `${regexTime[1].padStart(2, '0')}:${regexTime[2]}` : null
    return { date, time, confidence: 'high' }
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
    return {
      date: parsed.date ? String(parsed.date).trim() : null,
      time: parsed.time ? String(parsed.time).trim() : null,
      confidence: parsed.confidence === 'high' ? 'high' : 'low',
    }
  } catch {
    return { date: null, time: null, confidence: 'low' }
  }
}

function todayIsoInSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
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
