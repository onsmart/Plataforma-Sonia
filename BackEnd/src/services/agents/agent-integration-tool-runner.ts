import { getRedisClient } from '../../lib/redis'
import {
  type AgentExtraFeaturesV2,
  type AgentToolEntry,
  getEnabledTools,
  parseAgentExtraFeatures,
  parseToolKey,
} from './agent-extra-features'
import { executeIntegrationTool } from '../integrations/toolkit/toolkit.service'
import { extractDateTimeFromMessage, slotMatchesRequestedTime } from './agent-scheduling-datetime'
import type { IntegrationToolExecutionResult } from '../integrations/toolkit/toolkit.types'

const LOOKUP_CACHE_TTL_SEC = 30 * 24 * 60 * 60

function lookupCacheKey(agentId: string, contactId: string): string {
  return `agent:calendly_lookup:${agentId}:${contactId}`
}

type CalendlyContactCache = {
  appointmentId?: string
  slotId?: string
  integrationId: string
  patientEmail?: string
  startsAt?: string
}

async function saveLastCalendlyLookup(
  agentId: string,
  contactId: string,
  record: CalendlyContactCache
): Promise<void> {
  if (!agentId || !contactId || !record.integrationId) return
  if (!record.appointmentId && !record.slotId) return
  try {
    const client = await getRedisClient()
    await client.setEx(lookupCacheKey(agentId, contactId), LOOKUP_CACHE_TTL_SEC, JSON.stringify(record))
  } catch {
    // noop
  }
}

async function loadLastCalendlyLookup(
  agentId: string,
  contactId: string
): Promise<CalendlyContactCache | null> {
  if (!agentId || !contactId) return null
  try {
    const client = await getRedisClient()
    const raw = await client.get(lookupCacheKey(agentId, contactId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CalendlyContactCache
    if (!parsed?.integrationId) return null
    if (!parsed.appointmentId && !parsed.slotId) return null
    return parsed
  } catch {
    return null
  }
}

async function clearLastCalendlyLookup(agentId: string, contactId: string): Promise<void> {
  if (!agentId || !contactId) return
  try {
    const client = await getRedisClient()
    await client.del(lookupCacheKey(agentId, contactId))
  } catch {
    // noop
  }
}

/** Remove frases-meta que o LLM coloca em message ao chamar integration_tool (nao deve ir ao WhatsApp). */
export function stripSchedulingMetaPreamble(text: string): string {
  let t = String(text || '').trim()
  if (!t) return ''

  const globalPatterns = [
    /por favor,?\s*aguarde[^.!?\n]*(?:verific|consult|hor[aá]rio)[^.!?\n]*[.!?]?\s*/gi,
    /(?:vou|irei)\s+(?:verificar|consultar)[^.!?\n]*(?:hor[aá]rio|disponib|agenda|livres?)[^.!?\n]*[.!?]?\s*/gi,
    /aguarde[^.!?\n]*(?:verific|consult)[^.!?\n]*(?:hor[aá]rio|livres?)?[^.!?\n]*[.!?]?\s*/gi,
    /(?:um\s+)?momento[^.!?\n]*(?:verific|consult)[^.!?\n]*[.!?]?\s*/gi,
    /consultando[^.!?\n]*(?:hor[aá]rio|disponib|agenda|livres?)?[^.!?\n]*[.!?]?\s*/gi,
    /verificar\s+quais\s+s[aã]o\s+os\s+hor[aá]rios\s+livres[^.!?\n]*[.!?]?\s*/gi,
  ]
  for (const p of globalPatterns) {
    t = t.replace(p, ' ').trim()
  }

  const lineStartPatterns = [
    /^vou verificar[^.!?\n]*[.!?]?\s*/i,
    /^deixa eu (verificar|consultar)[^.!?\n]*[.!?]?\s*/i,
    /^aguarde[^.!?\n]*[.!?]?\s*/i,
    /^um momento[^.!?\n]*[.!?]?\s*/i,
    /^consultando[^.!?\n]*[.!?]?\s*/i,
  ]
  for (const p of lineStartPatterns) {
    t = t.replace(p, '').trim()
  }

  return t.replace(/\s{2,}/g, ' ').trim()
}

const BLOCKED_SCHEDULING_SENTENCE =
  /vou verificar|estou verificando|verificar a disponibilidade|verificar.*disponib|deixa eu consultar|aguarde|um momento|consultando|confirmando o agendamento|finalizo a reserva|enquanto finalizo|nossos hor[aá]rios|hor[aá]rios dispon[ií]veis|segunda a sexta|das 9h|9h.{0,6}18h/i

export function messageContainsSchedulingMeta(text: string): boolean {
  return BLOCKED_SCHEDULING_SENTENCE.test(String(text || ''))
}

export const SCHEDULING_ASK_DATETIME_REPLY =
  'Qual *dia e horário* é melhor para você para a reunião?'

export const SCHEDULING_ASK_NAME_EMAIL_REPLY =
  'Para agendar a reunião, preciso do seu *nome completo* e do *e-mail*. Pode me enviar?'

export const SCHEDULING_NEUTRAL_GREETING_REPLY =
  'Olá! Posso ajudar com informações ou com sua agenda — marcar, consultar ou cancelar uma reunião. Como posso ajudar você hoje?'

function pickSchedulingSanitizeFallback(original: string): string {
  if (/confirmando|finalizo|enquanto finalizo|reserva/i.test(original)) {
    if (/\d{1,2}[\/\-]\d{1,2}/.test(original)) {
      return SCHEDULING_ASK_NAME_EMAIL_REPLY
    }
    return SCHEDULING_ASK_DATETIME_REPLY
  }
  if (/verificando|consultando|disponib/i.test(original)) {
    if (/\b(quero agendar|agendar|agendamento|marcar|reuni[aã]o)\b/i.test(original)) {
      return SCHEDULING_ASK_DATETIME_REPLY
    }
    return SCHEDULING_NEUTRAL_GREETING_REPLY
  }
  return SCHEDULING_ASK_DATETIME_REPLY
}

function stripSchedulingMetaSentences(text: string): string {
  const parts = String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const kept = parts.filter((p) => !BLOCKED_SCHEDULING_SENTENCE.test(p))
  return kept.join(' ').trim()
}

/** Limpa respostas reply do LLM quando o agente usa Calendly (evita "vou verificar…"). */
export function sanitizeSchedulingOutboundReply(text: string): string {
  const original = String(text || '').trim()
  if (!original) return ''

  let t = stripSchedulingMetaPreamble(original)
  t = stripSchedulingMetaSentences(t)
  t = t.replace(/\s{2,}/g, ' ').trim()

  const hadBlocked = BLOCKED_SCHEDULING_SENTENCE.test(original)
  const asksDateTime = /\b(dia|hor[aá]rio|horario)\b/i.test(t)

  if (!t && hadBlocked) {
    return pickSchedulingSanitizeFallback(original)
  }

  if (hadBlocked && !asksDateTime) {
    const fallback = pickSchedulingSanitizeFallback(original)
    return t ? `${t}\n\n${fallback}` : fallback
  }

  return t || original
}

function shouldDropLlmPreambleForTool(toolKey: string): boolean {
  return String(toolKey || '').toLowerCase().startsWith('calendly.')
}

function formatSlotWhen(startsAt: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(startsAt))
  } catch {
    return startsAt
  }
}

function findEnabledTool(extra: AgentExtraFeaturesV2 | null, toolKey: string): AgentToolEntry | null {
  const normalized = String(toolKey || '').trim().toLowerCase()
  return getEnabledTools(extra).find((t) => (t.toolKey || '').toLowerCase() === normalized) || null
}

function parseToolPayload(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'object' && raw !== null) return raw as Record<string, unknown>
  const text = String(raw).trim()
  if (!text) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return {}
  }
}

function enrichPayload(
  toolEntry: AgentToolEntry,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const merged = { ...payload }
  if (toolEntry.provider === 'calendly' && toolEntry.integrationId && !merged.integrationId) {
    merged.integrationId = toolEntry.integrationId
  }
  if (toolEntry.provider === 'hubspot' && toolEntry.crmIntegrationId && !merged.crmIntegrationId) {
    merged.crmIntegrationId = toolEntry.crmIntegrationId
  }
  if (toolEntry.config?.specialty && !merged.specialty) {
    merged.specialty = toolEntry.config.specialty
  }
  if (toolEntry.provider === 'calendly' && !merged.specialty) {
    merged.specialty = 'reuniao_atendimento'
  }
  if (toolEntry.provider === 'calendly' && !merged.timezone) {
    merged.timezone = 'America/Sao_Paulo'
  }
  return merged
}

function formatToolResultForUser(
  toolKey: string,
  result: IntegrationToolExecutionResult,
  preamble: string,
  opts?: {
    preferredDate?: string | null
    preferredTime?: string | null
    agentId?: string
    contactId?: string
    integrationId?: string
  }
): string {
  const parts: string[] = []
  if (!shouldDropLlmPreambleForTool(toolKey)) {
    const cleanedPreamble = stripSchedulingMetaPreamble(preamble)
    if (cleanedPreamble) parts.push(cleanedPreamble)
  }

  if (!result.success) {
    parts.push(result.userSafeMessage || 'Não foi possível concluir a operação no momento.')
    return parts.join('\n\n')
  }

  const data = result.data || {}

  if (toolKey === 'calendly.check_availability') {
    const slots = (data.slots || []) as Array<{ slotId?: string; startsAt?: string }>
    const preferredDate = String(opts?.preferredDate || '').trim() || null
    const preferredTime = String(opts?.preferredTime || '').trim() || null

    if (slots.length === 0) {
      if (preferredDate || preferredTime) {
        parts.push(
          'Esse *dia/horário* está ocupado ou indisponível no Calendly. Informe outro dia ou horário, por favor.'
        )
      } else {
        parts.push('Não encontrei horários livres para essa data. Pode sugerir outro dia ou horário?')
      }
      return parts.join('\n\n')
    }

    if (preferredDate || preferredTime) {
      const exact = slots.find((slot) =>
        slot.slotId && slot.startsAt
          ? slotMatchesRequestedTime(slot.startsAt, preferredDate, preferredTime)
          : false
      )

      if (exact?.slotId && exact.startsAt) {
        const when = formatSlotWhen(exact.startsAt)
        if (opts?.agentId && opts?.contactId && opts?.integrationId) {
          void saveLastCalendlyLookup(opts.agentId, opts.contactId, {
            slotId: exact.slotId,
            integrationId: opts.integrationId,
            startsAt: exact.startsAt,
          })
        }
        parts.push(
          `O horário *${when}* está *disponível*.\n\n` +
            'Para *confirmar a reserva* no Calendly, preciso do seu *nome completo* e do *e-mail*.'
        )
        return parts.join('\n\n')
      }

      const sameDay = preferredDate
        ? slots.filter((s) => s.startsAt && slotMatchesRequestedTime(s.startsAt, preferredDate, null))
        : slots
      if (sameDay.length > 0) {
        const lines = sameDay.slice(0, 6).map((slot, i) => {
          const when = slot.startsAt ? formatSlotWhen(slot.startsAt) : 'horário'
          return `${i + 1}. ${when}`
        })
        parts.push(
          'O horário que você pediu não está livre, mas há estas opções no mesmo dia:\n\n' +
            lines.join('\n') +
            '\n\nEscolha o *número* ou informe outro horário. Para confirmar, também preciso do *nome completo* e *e-mail*.'
        )
        return parts.join('\n\n')
      }

      parts.push(
        'Esse horário não está disponível. Informe outro *dia e horário*, por favor.'
      )
      return parts.join('\n\n')
    }

    const lines = slots.slice(0, 8).map((slot, i) => {
      const when = slot.startsAt ? formatSlotWhen(slot.startsAt) : 'horário'
      return `${i + 1}. ${when}`
    })
    parts.push('Horários disponíveis:\n\n' + lines.join('\n'))
    parts.push(
      'Peça ao contato para escolher o *número* da opção ou informar outro horário. Antes de confirmar, colete *nome completo* e *e-mail*.'
    )
    return parts.join('\n\n')
  }

  if (toolKey === 'calendly.list_upcoming_appointments') {
    const appointments = (data.appointments || []) as Array<{
      appointmentId?: string
      slot?: { startsAt?: string }
    }>
    const first = appointments[0]
    if (!first?.slot?.startsAt) {
      parts.push('Não encontrei reunião ativa no Calendly com os dados informados.')
      return parts.join('\n\n')
    }
    parts.push(`Próxima reunião: *${formatSlotWhen(first.slot.startsAt)}*.`)
    return parts.join('\n\n')
  }

  if (toolKey === 'calendly.cancel_appointment') {
    parts.push(result.userSafeMessage || 'Reunião cancelada no Calendly.')
    return parts.join('\n\n')
  }

  if (toolKey === 'calendly.book_appointment') {
    const appointment = data.appointment as { slot?: { startsAt?: string } } | undefined
    const when = appointment?.slot?.startsAt
      ? formatSlotWhen(appointment.slot.startsAt)
      : 'horário confirmado'
    parts.push(`Reunião *confirmada* no Calendly para ${when}.`)
    return parts.join('\n\n')
  }

  parts.push(result.userSafeMessage || 'Operação concluída.')
  return parts.join('\n\n')
}

export async function runAgentIntegrationToolFromLlm(input: {
  agentExtraFeatures: unknown
  toolKey: string
  toolPayload: unknown
  userMessage?: string
  agentId?: string
  contactId?: string
}): Promise<{ ok: boolean; reply: string }> {
  const extra = parseAgentExtraFeatures(input.agentExtraFeatures)
  const toolKey = String(input.toolKey || '').trim().toLowerCase()
  const parsed = parseToolKey(toolKey)

  if (!parsed) {
    return { ok: false, reply: 'Ferramenta inválida. Use o tool_key listado nas ferramentas ativas.' }
  }

  const toolEntry = findEnabledTool(extra, toolKey)
  if (!toolEntry) {
    return {
      ok: false,
      reply: `A ferramenta *${toolKey}* não está ativa neste agente. Ative-a nas configurações do agente.`,
    }
  }

  const payload = enrichPayload(toolEntry, parseToolPayload(input.toolPayload))
  const agentId = String(input.agentId || '').trim()
  const contactId = String(input.contactId || '').trim()

  if (toolKey === 'calendly.check_availability') {
    let preferredDate = String(payload.preferredDate || '').trim()
    let preferredTime = String(payload.preferredTime || '').trim()
    if (!preferredDate && input.userMessage) {
      const extracted = await extractDateTimeFromMessage(input.userMessage)
      if (extracted.date) preferredDate = extracted.date
      if (extracted.time) preferredTime = extracted.time
      if (preferredDate) payload.preferredDate = preferredDate
      if (preferredTime) payload.preferredTime = preferredTime
    }
    if (!preferredDate) {
      return {
        ok: false,
        reply:
          'Qual *dia e horário* você prefere para a reunião? (ex.: 25/05/2026 às 15:00)',
      }
    }
  }

  if (
    toolKey === 'calendly.book_appointment' &&
    !payload.slotId &&
    agentId &&
    contactId
  ) {
    const cached = await loadLastCalendlyLookup(agentId, contactId)
    if (cached?.slotId) {
      payload.slotId = cached.slotId
      if (!payload.integrationId && cached.integrationId) {
        payload.integrationId = cached.integrationId
      }
    }
  }

  if (toolKey === 'calendly.book_appointment') {
    const patientName = String(payload.patientName || '').trim()
    const patientEmail = String(payload.patientEmail || '').trim()
    const slotId = String(payload.slotId || '').trim()
    if (!slotId) {
      return {
        ok: false,
        reply:
          'Ainda não tenho o horário selecionado no sistema. Informe o *dia e horário* desejados (ou o número da opção da lista).',
      }
    }
    if (!patientName || !patientEmail) {
      return {
        ok: false,
        reply:
          'Para confirmar no Calendly, preciso do seu *nome completo* e do *e-mail* usados na reserva.',
      }
    }
  }

  if (
    toolKey === 'calendly.cancel_appointment' &&
    !payload.appointmentId &&
    agentId &&
    contactId
  ) {
    const cached = await loadLastCalendlyLookup(agentId, contactId)
    if (cached?.appointmentId) {
      payload.appointmentId = cached.appointmentId
      if (!payload.integrationId && cached.integrationId) {
        payload.integrationId = cached.integrationId
      }
    }
  }

  try {
    const result = await executeIntegrationTool({
      provider: parsed.provider,
      toolName: parsed.toolName,
      payload,
    })

    if (
      toolKey === 'calendly.list_upcoming_appointments' &&
      result.success &&
      agentId &&
      contactId
    ) {
      const appointments = (result.data?.appointments || []) as Array<{
        appointmentId?: string
        slot?: { startsAt?: string }
      }>
      const first = appointments[0]
      if (first?.appointmentId && toolEntry.integrationId) {
        await saveLastCalendlyLookup(agentId, contactId, {
          appointmentId: first.appointmentId,
          integrationId: toolEntry.integrationId,
          patientEmail:
            typeof payload.patientEmail === 'string' ? payload.patientEmail : undefined,
          startsAt: first.slot?.startsAt,
        })
      }
    }

    if (toolKey === 'calendly.cancel_appointment' && result.success && agentId && contactId) {
      await clearLastCalendlyLookup(agentId, contactId)
    }

    const reply = formatToolResultForUser(toolKey, result, String(input.userMessage || ''), {
      preferredDate:
        typeof payload.preferredDate === 'string' ? payload.preferredDate : null,
      preferredTime:
        typeof payload.preferredTime === 'string' ? payload.preferredTime : null,
      agentId,
      contactId,
      integrationId: toolEntry.integrationId,
    })

    if (toolKey === 'calendly.book_appointment' && result.success && agentId && contactId) {
      const appointment = (result.data?.appointment || {}) as {
        appointmentId?: string
        slot?: { startsAt?: string }
      }
      if (appointment.appointmentId && toolEntry.integrationId) {
        await saveLastCalendlyLookup(agentId, contactId, {
          appointmentId: appointment.appointmentId,
          integrationId: toolEntry.integrationId,
          patientEmail:
            typeof payload.patientEmail === 'string' ? payload.patientEmail : undefined,
          startsAt: appointment.slot?.startsAt,
        })
      }
    }

    return { ok: result.success, reply }
  } catch (error: any) {
    return {
      ok: false,
      reply: `Erro ao executar ${toolKey}: ${String(error?.message || error).slice(0, 200)}`,
    }
  }
}
