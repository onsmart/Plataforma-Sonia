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

export function slotMatchesRequestedTime(
  startsAt: string,
  preferredDate: string | null,
  preferredTime: string | null
): boolean {
  if (!preferredDate && !preferredTime) return false
  const slotDate = new Date(startsAt)
  if (Number.isNaN(slotDate.getTime())) return false

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
  const slotIsoDate = `${y}-${m}-${d}`
  const slotTime = `${h}:${min}`

  if (preferredDate && slotIsoDate !== preferredDate) return false
  if (preferredTime && slotTime !== preferredTime) return false
  return true
}
