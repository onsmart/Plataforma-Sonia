import { getRedisClient } from '../../lib/redis'
import logger from '../../lib/logger'
import {
  type AgentExtraFeaturesV2,
  type AgentToolEntry,
  getEnabledTools,
  parseAgentExtraFeatures,
  parseToolKey,
} from './agent-extra-features'
import { executeIntegrationTool } from '../integrations/toolkit/toolkit.service'
import {
  extractDateTimeFromMessage,
  isSlotStartInPast,
  parseCalendlySlotId,
  pickCalendlySlotForRequest,
  slotMatchesRequestedTime,
  todayIsoInSaoPaulo,
  trySwapMonthDayIfPast,
  type CalendlySlotPick,
} from './agent-scheduling-datetime'
import { extractPatientProfileFromMessage } from '../flows/flow-patient-intake'
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
  patientName?: string
  startsAt?: string
  pendingOptions?: Array<{ slotId: string; startsAt: string }>
}

export function messageHasExplicitSchedulingDate(text: string): boolean {
  const t = String(text || '').trim()
  if (!t) return false
  return (
    /\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/.test(t) ||
    /\b(\d{1,2})[:h](\d{2})\b/i.test(t) ||
    /\b(amanh[aã]|hoje|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)\b/i.test(t)
  )
}

function resolveCalendlyIdentityFromChannel(channelUserMessage: string): {
  patientName: string
  patientEmail: string
} | null {
  const profile = extractPatientProfileFromMessage(channelUserMessage)
  const patientName = String(profile.patient_name || '').trim()
  const patientEmail = String(profile.patient_email || '').trim()
  if (!patientName || !patientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) {
    return null
  }
  return { patientName, patientEmail }
}

export function messageLooksLikeIdentitySubmission(text: string): boolean {
  return resolveCalendlyIdentityFromChannel(text) !== null
}

/** Evita vazar mensagens técnicas da API Calendly no WhatsApp. */
export function sanitizeCalendlyUserReply(reply: string): string {
  const text = String(reply || '').trim()
  if (!text) return text
  const lower = text.toLowerCase()

  if (lower.includes('start_time must be before end_time')) {
    return 'Não consegui consultar essa data no Calendly. Informe uma data futura assim: *03/06/2026 às 15:00* (dia/mês/ano).'
  }
  if (lower.includes('start_time must be in the future')) {
    return 'Esse horário já passou ou não é mais válido. Informe outro *dia e horário* futuros.'
  }
  if (lower.includes('calendly api') && (lower.includes('must be') || lower.includes('invalid'))) {
    return 'Não consegui concluir o agendamento no Calendly. Tente informar a data como *03/06/2026 às 15:00*.'
  }
  if (text.startsWith('Erro ao executar calendly.')) {
    return 'Não consegui consultar a agenda agora. Informe o dia e horário no formato *03/06/2026 às 15:00*.'
  }

  return text
}

async function buildCalendlyBookPayloadIfReady(input: {
  agentId: string
  contactId: string
  channelUserMessage: string
  fallbackPhone?: string | null
}): Promise<Record<string, unknown> | null> {
  const cached = await loadLastCalendlyLookup(input.agentId, input.contactId)
  if (!cached?.integrationId) return null

  let slotId = cached.slotId
  let startsAt = cached.startsAt

  const numericChoice = String(input.channelUserMessage || '').trim().match(/^(\d{1,2})$/)
  if (numericChoice && cached.pendingOptions?.length) {
    const idx = Number(numericChoice[1]) - 1
    const picked = cached.pendingOptions[idx]
    if (picked?.slotId) {
      slotId = picked.slotId
      startsAt = picked.startsAt
    }
  }

  if (!slotId) return null

  const fromMsg = extractPatientProfileFromMessage(input.channelUserMessage)
  const patientName = String(fromMsg.patient_name || cached.patientName || '').trim()
  const patientEmail = String(fromMsg.patient_email || cached.patientEmail || '').trim()
  if (!patientName || !patientEmail) return null

  if (
    messageHasExplicitSchedulingDate(input.channelUserMessage) &&
    !messageLooksLikeIdentitySubmission(input.channelUserMessage) &&
    !numericChoice
  ) {
    return null
  }

  return {
    slotId,
    integrationId: cached.integrationId,
    patientName,
    patientEmail,
    patientPhone: fromMsg.patient_phone || input.fallbackPhone || null,
    startsAt,
  }
}

async function persistCalendlyCheckCache(input: {
  agentId: string
  contactId: string
  integrationId: string
  slots: Array<{ slotId?: string; startsAt?: string }>
  preferredDate: string | null
  preferredTime: string | null
  channelUserMessage: string
}): Promise<CalendlySlotPick | null> {
  const picked = pickCalendlySlotForRequest(input.slots, input.preferredDate, input.preferredTime)
  const sameDay = input.preferredDate
    ? input.slots.filter(
        (s) => s.startsAt && s.slotId && slotMatchesRequestedTime(s.startsAt, input.preferredDate, null)
      )
    : input.slots.filter((s) => s.startsAt && s.slotId)

  const pendingOptions = sameDay
    .filter((s): s is { slotId: string; startsAt: string } => Boolean(s.slotId && s.startsAt))
    .slice(0, 8)
    .map((s) => ({ slotId: s.slotId, startsAt: s.startsAt }))

  const profile = extractPatientProfileFromMessage(input.channelUserMessage)

  if (picked) {
    await saveLastCalendlyLookup(input.agentId, input.contactId, {
      slotId: picked.slotId,
      integrationId: input.integrationId,
      startsAt: picked.startsAt,
      patientName: profile.patient_name,
      patientEmail: profile.patient_email,
      pendingOptions,
    })
    return picked
  }

  if (pendingOptions.length > 0) {
    await saveLastCalendlyLookup(input.agentId, input.contactId, {
      integrationId: input.integrationId,
      pendingOptions,
      patientName: profile.patient_name,
      patientEmail: profile.patient_email,
    })
  }

  return null
}

/** Quando ja ha slot pendente e o cliente enviou nome/e-mail, confirma no Calendly sem depender do LLM. */
export async function tryAutoBookCalendlyFromMessage(input: {
  agentExtraFeatures: unknown
  agentId: string
  contactId: string
  channelUserMessage: string
  fallbackPhone?: string | null
}): Promise<{ ok: boolean; reply: string } | null> {
  const extra = parseAgentExtraFeatures(input.agentExtraFeatures)
  const hasBook = getEnabledTools(extra).some(
    (t) => (t.toolKey || '').toLowerCase() === 'calendly.book_appointment' && t.enabled
  )
  if (!hasBook) return null

  const bookPayload = await buildCalendlyBookPayloadIfReady(input)
  if (!bookPayload) return null

  logger.info('[calendly.auto-book] Confirmando reserva pendente', {
    agentId: input.agentId,
    contactId: input.contactId,
    hasSlotId: Boolean(bookPayload.slotId),
  })

  return runAgentIntegrationToolFromLlm({
    agentExtraFeatures: input.agentExtraFeatures,
    toolKey: 'calendly.book_appointment',
    toolPayload: JSON.stringify(bookPayload),
    channelUserMessage: input.channelUserMessage,
    agentId: input.agentId,
    contactId: input.contactId,
    skipPromotion: true,
  })
}

async function saveLastCalendlyLookup(
  agentId: string,
  contactId: string,
  record: CalendlyContactCache
): Promise<void> {
  if (!agentId || !contactId || !record.integrationId) return
  if (!record.appointmentId && !record.slotId && !(record.pendingOptions?.length)) return
  try {
    const client = await getRedisClient()
    await client.setEx(lookupCacheKey(agentId, contactId), LOOKUP_CACHE_TTL_SEC, JSON.stringify(record))
    logger.info('[calendly.cache] Slot/lookup salvo', {
      agentId,
      contactId,
      hasSlotId: Boolean(record.slotId),
      hasAppointmentId: Boolean(record.appointmentId),
      pendingOptions: record.pendingOptions?.length || 0,
    })
  } catch (err: unknown) {
    logger.warn('[calendly.cache] Falha ao salvar cache Calendly', {
      agentId,
      contactId,
      error: err instanceof Error ? err.message : String(err),
    })
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
    if (!parsed.appointmentId && !parsed.slotId && !parsed.pendingOptions?.length) return null
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

export const SCHEDULING_ASK_IDENTITY_FOR_LOOKUP_REPLY =
  'Para localizar ou cancelar a reserva, preciso do seu *nome completo* e do *e-mail* usados no agendamento. Pode me enviar?'

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
    channelUserMessage?: string
    slotPick?: CalendlySlotPick | null
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
      const picked =
        opts?.slotPick || pickCalendlySlotForRequest(slots, preferredDate, preferredTime)

      if (picked?.slotId && picked.startsAt) {
        const when = formatSlotWhen(picked.startsAt)
        if (picked.match === 'exact') {
          parts.push(
            `O horário *${when}* está *disponível*.\n\n` +
              'Para *confirmar a reserva* no Calendly, preciso do seu *nome completo* e do *e-mail*.'
          )
        } else {
          parts.push(
            `O horário que você pediu não está livre, mas *${when}* está *disponível*.\n\n` +
              'Para *confirmar a reserva*, envie seu *nome completo* e *e-mail* (ou diga outro horário).'
          )
        }
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
  channelUserMessage?: string
  agentId?: string
  contactId?: string
  skipPromotion?: boolean
}): Promise<{ ok: boolean; reply: string }> {
  const extra = parseAgentExtraFeatures(input.agentExtraFeatures)
  let toolKey = String(input.toolKey || '').trim().toLowerCase()
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

  const agentId = String(input.agentId || '').trim()
  const contactId = String(input.contactId || '').trim()
  const channelUserMessage = String(
    input.channelUserMessage || input.userMessage || ''
  ).trim()

  let promotedBookPayload: Record<string, unknown> | null = null
  if (!input.skipPromotion && agentId && contactId) {
    promotedBookPayload = await buildCalendlyBookPayloadIfReady({
      agentId,
      contactId,
      channelUserMessage,
    })
    if (promotedBookPayload && toolKey === 'calendly.check_availability') {
      toolKey = 'calendly.book_appointment'
    } else if (
      toolKey === 'calendly.check_availability' &&
      messageLooksLikeIdentitySubmission(channelUserMessage) &&
      !messageHasExplicitSchedulingDate(channelUserMessage)
    ) {
      const cached = await loadLastCalendlyLookup(agentId, contactId)
      if (!cached?.slotId) {
        return {
          ok: false,
          reply:
            'Recebi seus dados. Qual *dia e horário* você prefere para a reunião?',
        }
      }
    }
  }

  const activeToolEntry = findEnabledTool(extra, toolKey)
  if (!activeToolEntry) {
    return {
      ok: false,
      reply: `A ferramenta *${toolKey}* não está ativa neste agente. Ative-a nas configurações do agente.`,
    }
  }

  let payload = enrichPayload(activeToolEntry, parseToolPayload(input.toolPayload))
  if (promotedBookPayload) {
    payload = enrichPayload(activeToolEntry, { ...payload, ...promotedBookPayload })
  }

  if (toolKey === 'calendly.check_availability') {
    const today = todayIsoInSaoPaulo()
    let preferredDate = trySwapMonthDayIfPast(String(payload.preferredDate || '').trim(), today)
    let preferredTime = String(payload.preferredTime || '').trim()
    const dateSource = channelUserMessage || String(input.userMessage || '')
    if (!preferredDate && dateSource) {
      const extracted = await extractDateTimeFromMessage(dateSource)
      if (extracted.date) preferredDate = trySwapMonthDayIfPast(extracted.date, today)
      if (extracted.time) preferredTime = extracted.time
      if (preferredDate) payload.preferredDate = preferredDate
      if (preferredTime) payload.preferredTime = preferredTime
    } else if (preferredDate) {
      payload.preferredDate = preferredDate
    }
    if (!preferredDate) {
      return {
        ok: false,
        reply:
          'Qual *dia e horário* você prefere para a reunião? (ex.: 03/06/2026 às 15:00)',
      }
    }
    if (preferredDate < today) {
      return {
        ok: false,
        reply:
          'Essa data já passou. Informe um *dia futuro* (ex.: 03/06/2026 às 15:00).',
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
    const slotMeta = slotId ? parseCalendlySlotId(slotId) : null
    if (slotMeta?.startsAt && isSlotStartInPast(slotMeta.startsAt)) {
      if (agentId && contactId) {
        await clearLastCalendlyLookup(agentId, contactId)
      }
      return {
        ok: false,
        reply:
          'Esse horário já não está mais disponível para reserva (data/hora no passado). Informe outro *dia e horário*, por favor.',
      }
    }
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
    if (agentId && contactId) {
      await saveLastCalendlyLookup(agentId, contactId, {
        slotId,
        integrationId: String(payload.integrationId || toolEntry.integrationId || ''),
        patientName,
        patientEmail,
        startsAt: typeof payload.startsAt === 'string' ? payload.startsAt : undefined,
      })
    }
  }

  if (
    toolKey === 'calendly.list_upcoming_appointments' ||
    toolKey === 'calendly.cancel_appointment'
  ) {
    const identity = resolveCalendlyIdentityFromChannel(channelUserMessage)
    if (!identity) {
      return { ok: false, reply: SCHEDULING_ASK_IDENTITY_FOR_LOOKUP_REPLY }
    }
    payload.patientName = identity.patientName
    payload.patientEmail = identity.patientEmail
    payload.email = identity.patientEmail
  }

  if (toolKey === 'calendly.cancel_appointment' && !payload.appointmentId) {
    const listResult = await executeIntegrationTool({
      provider: 'calendly',
      toolName: 'list_upcoming_appointments',
      payload: enrichPayload(activeToolEntry, payload),
    })
    if (!listResult.success) {
      return {
        ok: false,
        reply:
          listResult.userSafeMessage ||
          'Não encontrei reserva ativa no Calendly com esses dados.',
      }
    }
    const appointments = (listResult.data?.appointments || []) as Array<{ appointmentId?: string }>
    const first = appointments.find((a) => a.appointmentId)
    if (!first?.appointmentId) {
      return {
        ok: false,
        reply: 'Não encontrei reserva ativa no Calendly com esse *nome* e *e-mail*.',
      }
    }
    payload.appointmentId = first.appointmentId
  }

  try {
    const execProvider = toolKey === 'calendly.book_appointment' ? 'calendly' : parsed.provider
    const execToolName =
      toolKey === 'calendly.book_appointment' ? 'book_appointment' : parsed.toolName

    const result = await executeIntegrationTool({
      provider: execProvider,
      toolName: execToolName,
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

    let slotPick: CalendlySlotPick | null = null
    if (
      toolKey === 'calendly.check_availability' &&
      result.success &&
      agentId &&
      contactId &&
      activeToolEntry.integrationId
    ) {
      const slots = (result.data?.slots || []) as Array<{ slotId?: string; startsAt?: string }>
      slotPick = await persistCalendlyCheckCache({
        agentId,
        contactId,
        integrationId: activeToolEntry.integrationId,
        slots,
        preferredDate:
          typeof payload.preferredDate === 'string' ? payload.preferredDate : null,
        preferredTime:
          typeof payload.preferredTime === 'string' ? payload.preferredTime : null,
        channelUserMessage,
      })
    }

    if (toolKey === 'calendly.book_appointment') {
      logger.info('[calendly.book] Tentativa de agendamento', {
        agentId,
        contactId,
        ok: result.success,
        hasSlotId: Boolean(payload.slotId),
        error: result.success ? undefined : result.userSafeMessage || result.error,
      })
    }

    const reply = formatToolResultForUser(toolKey, result, String(input.userMessage || ''), {
      preferredDate:
        typeof payload.preferredDate === 'string' ? payload.preferredDate : null,
      preferredTime:
        typeof payload.preferredTime === 'string' ? payload.preferredTime : null,
      agentId,
      contactId,
      integrationId: activeToolEntry.integrationId,
      channelUserMessage,
      slotPick,
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

    return { ok: result.success, reply: sanitizeCalendlyUserReply(reply) }
  } catch (error: any) {
    return {
      ok: false,
      reply: sanitizeCalendlyUserReply(
        `Erro ao executar ${toolKey}: ${String(error?.message || error).slice(0, 200)}`
      ),
    }
  }
}
