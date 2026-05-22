import { getRedisClient } from '../../lib/redis'
import logger from '../../lib/logger'
import { supabase } from '../../lib/supabase'
import type { AppointmentSlot } from '../appointments/appointment-provider'
import { resolveAppointmentProvider } from '../appointments'
import { RealCalendlyProvider } from '../integrations/calendly/calendly.provider'
import { executeIntegrationTool } from '../integrations/toolkit/toolkit.service'
import {
  loadCalendlyIntegrationConfig,
  resolveCalendlyIntegrationIdForCompany,
} from '../integrations/calendly/calendly.repository'
import {
  extractPatientProfileFromMessage,
  isAffirmativeConfirmation,
  looksLikeSchedulingRequestMessage,
  normalizePhoneDigits,
} from '../flows/flow-patient-intake'
import { buildAppointmentSlotSelectionMessage } from '../flows/flow-appointment-selection'
import type { AgentSchedulingConfig } from './agent-extra-features'

function meetingLabel(config: AgentSchedulingConfig): string {
  return String(config.meeting_label || 'reunião').trim()
}
import {
  extractDateTimeFromMessage,
  slotMatchesRequestedTime,
} from './agent-scheduling-datetime'
import { getHistoryFromRedis } from '../integrations/whatsapp/whatsapp.redis'

const SCHEDULING_TTL_SEC = 7 * 24 * 60 * 60
const EMAIL_IN_TEXT_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const LAST_BOOKING_TTL_SEC = 30 * 24 * 60 * 60

export interface LastBookingRecord {
  appointmentId: string
  calendly_integration_id: string
  patient_email?: string
  starts_at?: string
  booked_at: string
}

export type SchedulingStatus =
  | 'idle'
  | 'collecting_identity'
  | 'awaiting_datetime'
  | 'offering_slots'
  | 'awaiting_booking_lookup'

export type PendingBookingAction = 'query' | 'cancel'

export interface SchedulingState {
  status: SchedulingStatus
  pending_booking_action?: PendingBookingAction
  patient_name?: string
  patient_email?: string
  patient_phone?: string
  preferred_date?: string | null
  preferred_time?: string | null
  appointment_slots?: AppointmentSlot[]
  /** Slot escolhido após checagem Calendly; book só após nome/e-mail */
  selected_slot_id?: string
}

export interface SchedulingTurnResult {
  handled: boolean
  reply?: string
  reset?: boolean
}

function schedulingKey(agentId: string, contactId: string): string {
  return `agent:scheduling:${agentId}:${contactId}`
}

function lastBookingKey(agentId: string, contactId: string): string {
  return `agent:last_booking:${agentId}:${contactId}`
}

function normalizeIntentText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function looksLikeQueryExistingAppointment(message: string): boolean {
  const n = normalizeIntentText(message)
  if (looksLikeCancelBookedAppointment(message)) return false
  const queryPatterns = [
    /\b(proximo|minha|meu|meu proximo).{0,25}(reuniao|agendamento|horario|consulta|compromisso)\b/,
    /\b(quando|qual|que dia|que hora|que horario).{0,35}(reuniao|agendamento|marcado|agendei|tenho)\b/,
    /\b(confirmar|ver|consultar|mostrar|lembrar).{0,25}(reuniao|agendamento|horario|data)\b/,
    /\btenho (algum |um )?agendamento\b/,
    /\bdata (da|do) (minha )?reuniao\b/,
    /\bhorario (da|do) (minha )?reuniao\b/,
    /\bja (tenho|agendei|marquei).{0,20}(reuniao|agendamento)\b/,
  ]
  return queryPatterns.some((p) => p.test(n))
}

export function looksLikeSchedulingIntent(message: string): boolean {
  if (looksLikeQueryExistingAppointment(message)) return false
  if (looksLikeCancelBookedAppointment(message)) return false
  if (looksLikeSchedulingRequestMessage(message)) return true
  const n = normalizeIntentText(message)
  if (isAffirmativeConfirmation(message) && /\b(agendar|horario|conversa|diagnostico)\b/.test(n)) {
    return true
  }
  if (isAffirmativeConfirmation(message) && /\breuniao\b/.test(n) && /\b(agendar|marcar|nova)\b/.test(n)) {
    return true
  }
  const patterns = [
    /\bagendar\b/,
    /\b(novo|nova)\s+agendamento\b/,
    /\bagendar (uma |outra )?reuniao\b/,
    /\bdiagnostico\b/,
    /\bconversar com (o )?time\b/,
    /\bfalar com (a )?equipe\b/,
    /\bmarcar (um )?(novo )?horario\b/,
    /\bmarcar (uma )?reuniao\b/,
    /\bhorario disponivel\b/,
    /\bquero (uma )?reuniao\b/,
    /\b(gostaria|quero).{0,40}(agendar|marcar)\b/,
    /\b(gostaria|quero).{0,20}reuniao\b/,
  ]
  return patterns.some((p) => p.test(n))
}

export function looksLikeCancelBookedAppointment(message: string): boolean {
  const n = normalizeIntentText(message)
  if (!/\b(cancelar|desmarcar)\b/.test(n)) return false
  return (
    /\b(reuniao|agendamento|consulta|horario|compromisso|reserva|marcacao)\b/.test(n) ||
    /\b(minha|a|o)\s+(reuniao|agendamento)\b/.test(n)
  )
}

function looksLikeAbortSchedulingFlow(message: string): boolean {
  if (looksLikeCancelBookedAppointment(message)) return false
  const n = normalizeIntentText(message)
  if (/\b(obrigad|valeu|agradec).{0,40}(cancelar|cancelou|cancelada)\b/.test(n)) return false
  if (/\b(cancelar|cancelou|cancelada).{0,40}(obrigad|valeu|agradec)\b/.test(n)) return false
  return /\b(cancelar|desistir|voltar ao menu|parar agendamento)\b/.test(n)
}

async function loadState(agentId: string, contactId: string): Promise<SchedulingState> {
  try {
    const client = await getRedisClient()
    const raw = await client.get(schedulingKey(agentId, contactId))
    if (!raw) return { status: 'idle' }
    const parsed = JSON.parse(raw) as SchedulingState
    return parsed?.status ? parsed : { status: 'idle' }
  } catch (err: any) {
    logger.warn('[scheduling] loadState', err?.message)
    return { status: 'idle' }
  }
}

async function loadLastBooking(
  agentId: string,
  contactId: string
): Promise<LastBookingRecord | null> {
  try {
    const client = await getRedisClient()
    const raw = await client.get(lastBookingKey(agentId, contactId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as LastBookingRecord
    return parsed?.appointmentId ? parsed : null
  } catch (err: any) {
    logger.warn('[scheduling] loadLastBooking', err?.message)
    return null
  }
}

async function saveLastBooking(
  agentId: string,
  contactId: string,
  record: LastBookingRecord
): Promise<void> {
  try {
    const client = await getRedisClient()
    await client.setEx(
      lastBookingKey(agentId, contactId),
      LAST_BOOKING_TTL_SEC,
      JSON.stringify(record)
    )
  } catch (err: any) {
    logger.warn('[scheduling] saveLastBooking', err?.message)
  }
}

async function clearLastBooking(agentId: string, contactId: string): Promise<void> {
  try {
    const client = await getRedisClient()
    await client.del(lastBookingKey(agentId, contactId))
  } catch (err: any) {
    logger.warn('[scheduling] clearLastBooking', err?.message)
  }
}

async function saveState(
  agentId: string,
  contactId: string,
  state: SchedulingState
): Promise<void> {
  try {
    const client = await getRedisClient()
    if (state.status === 'idle') {
      await client.del(schedulingKey(agentId, contactId))
      return
    }
    await client.setEx(schedulingKey(agentId, contactId), SCHEDULING_TTL_SEC, JSON.stringify(state))
  } catch (err: any) {
    logger.warn('[scheduling] saveState', err?.message)
  }
}

function mergeProfile(state: SchedulingState, message: string): SchedulingState {
  const hints = extractPatientProfileFromMessage(message)
  return {
    ...state,
    patient_name: state.patient_name || hints.patient_name,
    patient_email: state.patient_email || hints.patient_email,
    patient_phone: state.patient_phone || hints.patient_phone,
  }
}

function getMissingOnsmartBookingFields(
  state: SchedulingState,
  fallbackPhone?: string | null
): string[] {
  const missing: string[] = []
  const name = String(state.patient_name || '').trim()
  const email = String(state.patient_email || '').trim()
  const phone = String(state.patient_phone || fallbackPhone || '').trim()

  if (name.length < 2) missing.push('patient_name')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) missing.push('patient_email')
  if (normalizePhoneDigits(phone).length < 10) missing.push('patient_phone')

  return missing
}

function hasOnsmartBookingProfile(
  state: SchedulingState,
  fallbackPhone?: string | null
): boolean {
  return getMissingOnsmartBookingFields(state, fallbackPhone).length === 0
}

function askMissingIdentityFields(
  state: SchedulingState,
  fallbackPhone?: string | null
): string {
  const missing = getMissingOnsmartBookingFields(state, fallbackPhone)
  if (missing.includes('patient_name')) {
    return 'Para confirmar o agendamento, preciso do seu *nome completo*.'
  }
  if (missing.includes('patient_email')) {
    return 'Obrigada! Agora informe seu *e-mail* para enviarmos o convite da reunião.'
  }
  if (missing.includes('patient_phone')) {
    return 'Por último, seu *telefone* com DDD (apenas números).'
  }
  return 'Informe *nome completo* e *e-mail* para eu confirmar a reunião no Calendly.'
}

async function resolveSchedulingCalendlyConfig(
  agentId: string,
  config: AgentSchedulingConfig
): Promise<AgentSchedulingConfig> {
  const configuredId = String(config.calendly_integration_id || '').trim()
  if (!configuredId) {
    throw new Error('Integracao do Calendly nao encontrada.')
  }

  try {
    await loadCalendlyIntegrationConfig(configuredId)
    return config
  } catch {
    const { data: agent } = await supabase
      .from('tb_agents')
      .select('companies_id')
      .eq('id', agentId)
      .maybeSingle()

    const companyId = String(agent?.companies_id || '').trim()
    const fallbackId = companyId
      ? await resolveCalendlyIntegrationIdForCompany(companyId)
      : null

    if (fallbackId && fallbackId !== configuredId) {
      logger.warn('[scheduling] integrationId do agente invalido; usando Calendly da empresa', {
        agentId,
        configuredId,
        fallbackId,
      })
      return { ...config, calendly_integration_id: fallbackId }
    }

    if (fallbackId) {
      return config
    }

    throw new Error('Integracao do Calendly nao encontrada.')
  }
}

function isCalendlyMappingNotFoundError(error: unknown): boolean {
  const msg = String((error as Error)?.message || error || '').toLowerCase()
  return msg.includes('event_type_mapping_not_found')
}

function calendlyMappingNotConfiguredReply(specialty: string): string {
  return (
    'A integração Calendly está conectada, mas falta vincular o tipo de evento.\n\n' +
    `No painel: *Integrações → Calendly → Mapeamento*, defina a chave *${specialty}* no evento da sua conta ` +
    '(ex.: "30 Minute Meeting") e salve.\n\n' +
    'Depois tente informar o dia e horário novamente.'
  )
}

async function fetchAvailability(
  agentId: string,
  config: AgentSchedulingConfig,
  state: SchedulingState,
  preferredDate?: string | null
): Promise<AppointmentSlot[]> {
  const resolved = await resolveSchedulingCalendlyConfig(agentId, config)
  try {
    const result = await executeIntegrationTool({
      provider: 'calendly',
      toolName: 'check_availability',
      payload: {
        integrationId: resolved.calendly_integration_id,
        specialty: config.specialty,
        preferredDate: preferredDate || state.preferred_date || null,
        patientName: state.patient_name || null,
        timezone: 'America/Sao_Paulo',
      },
    })

    const slots = (result.data?.slots || []) as AppointmentSlot[]
    return Array.isArray(slots) ? slots : []
  } catch (error) {
    if (isCalendlyMappingNotFoundError(error)) {
      throw Object.assign(new Error('CALENDLY_MAPPING_NOT_CONFIGURED'), { specialty: config.specialty })
    }
    throw error
  }
}

function formatAppointmentWhen(startsAt: string | undefined | null): string {
  if (!startsAt) return 'horário confirmado'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(startsAt))
  } catch {
    return String(startsAt)
  }
}

interface BookingLookupHints {
  email: string | null
  phone: string | null
  name: string | null
}

function extractEmailsFromText(text: string): string[] {
  const found = new Set<string>()
  const matches = String(text || '').match(EMAIL_IN_TEXT_PATTERN) || []
  for (const raw of matches) {
    const email = raw.trim().toLowerCase()
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) found.add(email)
  }
  return Array.from(found)
}

async function extractEmailsFromConversationHistory(
  integrationsId: string | null | undefined,
  historyContactKey: string | null | undefined
): Promise<string[]> {
  const integration = String(integrationsId || '').trim()
  const contactKey = String(historyContactKey || '').trim()
  if (!integration || !contactKey) return []

  try {
    const history = await getHistoryFromRedis(integration, contactKey, 30)
    const emails = new Set<string>()
    for (const item of history) {
      for (const email of extractEmailsFromText(item.content)) {
        emails.add(email)
      }
    }
    return Array.from(emails)
  } catch (err: any) {
    logger.warn('[scheduling] extractEmailsFromConversationHistory', err?.message)
    return []
  }
}

async function buildBookingLookupHints(input: {
  agentId: string
  contactId: string
  state: SchedulingState
  message: string
  fallbackPhone?: string | null
  integrationsId?: string | null
  historyContactKey?: string | null
  contactDisplayName?: string | null
}): Promise<BookingLookupHints> {
  const merged = mergeProfile(input.state, input.message)
  const last = await loadLastBooking(input.agentId, input.contactId)
  const historyEmails = await extractEmailsFromConversationHistory(
    input.integrationsId,
    input.historyContactKey
  )
  const messageEmails = extractEmailsFromText(input.message)

  const email =
    merged.patient_email ||
    last?.patient_email ||
    messageEmails[0] ||
    historyEmails[0] ||
    null

  const phone =
    merged.patient_phone ||
    (input.fallbackPhone ? normalizePhoneDigits(input.fallbackPhone) || input.fallbackPhone : null)

  const name =
    merged.patient_name ||
    String(input.contactDisplayName || '').trim() ||
    null

  return {
    email: email ? email.toLowerCase() : null,
    phone: phone || null,
    name: name && name.length >= 2 ? name : null,
  }
}

function hasBookingLookupIdentifier(hints: BookingLookupHints): boolean {
  if (hints.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hints.email)) return true
  if (normalizePhoneDigits(hints.phone || '').length >= 10) return true
  if (hints.name && hints.name.length >= 3) return true
  return false
}

function askBookingLookupFields(action: PendingBookingAction): string {
  const verb = action === 'cancel' ? 'cancelar' : 'localizar'
  return (
    `Para ${verb} seu agendamento no Calendly (mesmo que tenha sido em outra conversa), preciso do *e-mail* usado na reserva.\n\n` +
    'Envie o e-mail (ex.: seu.nome@empresa.com). Se quiser, inclua também seu *nome completo* na mesma mensagem.'
  )
}

function bookingNotFoundReply(action: PendingBookingAction, triedEmail?: string | null): string {
  const emailHint = triedEmail ? ` com o e-mail *${triedEmail}*` : ''
  if (action === 'cancel') {
    return (
      `Não encontrei reunião ativa no Calendly${emailHint}. Confira se o e-mail está correto ou use o link de cancelamento no convite do Calendly.\n\n` +
      'Pode enviar outro e-mail para eu tentar de novo, ou digite *agendar* para marcar um novo horário.'
    )
  }
  return (
    `Não encontrei reunião ativa no Calendly${emailHint}. Confira o e-mail usado no agendamento.\n\n` +
    'Envie outro e-mail para eu buscar de novo, ou digite *agendar* para marcar um horário.'
  )
}

async function getCalendlyProvider(
  agentId: string,
  config: AgentSchedulingConfig
): Promise<{ provider: RealCalendlyProvider; config: AgentSchedulingConfig }> {
  const resolved = await resolveSchedulingCalendlyConfig(agentId, config)
  const provider = resolveAppointmentProvider('calendly', {
    integrationId: resolved.calendly_integration_id,
  }) as RealCalendlyProvider
  return { provider, config: resolved }
}

async function resolveActiveAppointmentId(
  agentId: string,
  contactId: string,
  config: AgentSchedulingConfig,
  hints: BookingLookupHints
): Promise<{ appointmentId: string; integrationId: string; startsAt?: string; patientEmail?: string } | null> {
  const last = await loadLastBooking(agentId, contactId)
  if (last?.appointmentId) {
    return {
      appointmentId: last.appointmentId,
      integrationId: last.calendly_integration_id || config.calendly_integration_id,
      startsAt: last.starts_at,
      patientEmail: last.patient_email || hints.email || undefined,
    }
  }

  const { provider, config: resolved } = await getCalendlyProvider(agentId, config)
  const appointmentId = await provider.findActiveAppointmentForPatient({
    email: hints.email,
    phone: hints.phone,
    name: hints.name,
    specialty: resolved.specialty,
  })

  if (!appointmentId) return null

  const record = await provider.getAppointmentById(appointmentId)
  const startsAt = record?.slot?.startsAt

  await saveLastBooking(agentId, contactId, {
    appointmentId,
    calendly_integration_id: resolved.calendly_integration_id,
    patient_email: hints.email || last?.patient_email,
    starts_at: startsAt,
    booked_at: last?.booked_at || new Date().toISOString(),
  })

  return {
    appointmentId,
    integrationId: resolved.calendly_integration_id,
    startsAt,
    patientEmail: hints.email || undefined,
  }
}

async function startBookingLookup(
  agentId: string,
  contactId: string,
  state: SchedulingState,
  action: PendingBookingAction
): Promise<SchedulingTurnResult> {
  const next: SchedulingState = {
    ...state,
    status: 'awaiting_booking_lookup',
    pending_booking_action: action,
  }
  await saveState(agentId, contactId, next)
  return { handled: true, reply: askBookingLookupFields(action) }
}

async function handleAwaitingBookingLookup(input: {
  agentId: string
  contactId: string
  message: string
  config: AgentSchedulingConfig
  state: SchedulingState
  fallbackPhone?: string | null
  integrationsId?: string | null
  historyContactKey?: string | null
  contactDisplayName?: string | null
}): Promise<SchedulingTurnResult> {
  const action = input.state.pending_booking_action || 'query'
  const hints = await buildBookingLookupHints({
    agentId: input.agentId,
    contactId: input.contactId,
    state: input.state,
    message: input.message,
    fallbackPhone: input.fallbackPhone,
    integrationsId: input.integrationsId,
    historyContactKey: input.historyContactKey,
    contactDisplayName: input.contactDisplayName,
  })

  if (!hints.email) {
    return { handled: true, reply: askBookingLookupFields(action) }
  }

  const active = await resolveActiveAppointmentId(
    input.agentId,
    input.contactId,
    input.config,
    hints
  )

  if (!active?.appointmentId) {
    await saveState(input.agentId, input.contactId, {
      ...input.state,
      status: 'awaiting_booking_lookup',
      pending_booking_action: action,
      patient_email: hints.email || input.state.patient_email,
      patient_name: hints.name || input.state.patient_name,
      patient_phone: hints.phone || input.state.patient_phone,
    })
    return { handled: true, reply: bookingNotFoundReply(action, hints.email) }
  }

  await saveState(input.agentId, input.contactId, {
    status: 'idle',
    patient_email: hints.email || input.state.patient_email,
    patient_name: hints.name || input.state.patient_name,
    patient_phone: hints.phone || input.state.patient_phone,
  })

  if (action === 'cancel') {
    return tryCancelResolvedAppointment(input.agentId, input.contactId, input.config, active)
  }

  const { provider } = await getCalendlyProvider(input.agentId, input.config)
  const record = await provider.getAppointmentById(active.appointmentId)
  const when = formatAppointmentWhen(record?.slot?.startsAt || active.startsAt)

  return {
    handled: true,
    reply:
      `Sua próxima ${meetingLabel(input.config)} está marcada para *${when}*.\n\n` +
      'Para *cancelar*, digite: *cancelar reunião*. Para remarcar, diga *agendar*.',
  }
}

async function tryQueryExistingAppointment(
  agentId: string,
  contactId: string,
  config: AgentSchedulingConfig,
  state: SchedulingState,
  message: string,
  lookupContext: {
    fallbackPhone?: string | null
    integrationsId?: string | null
    historyContactKey?: string | null
    contactDisplayName?: string | null
  }
): Promise<SchedulingTurnResult> {
  const hints = await buildBookingLookupHints({
    agentId,
    contactId,
    state,
    message,
    fallbackPhone: lookupContext.fallbackPhone,
    integrationsId: lookupContext.integrationsId,
    historyContactKey: lookupContext.historyContactKey,
    contactDisplayName: lookupContext.contactDisplayName,
  })

  const active = await resolveActiveAppointmentId(agentId, contactId, config, hints)

  if (!active?.appointmentId) {
    if (!hints.email) {
      return startBookingLookup(agentId, contactId, state, 'query')
    }
    await saveState(agentId, contactId, {
      ...state,
      status: 'awaiting_booking_lookup',
      pending_booking_action: 'query',
      patient_email: hints.email || state.patient_email,
      patient_name: hints.name || state.patient_name,
      patient_phone: hints.phone || state.patient_phone,
    })
    return { handled: true, reply: bookingNotFoundReply('query', hints.email) }
  }

  const { provider } = await getCalendlyProvider(agentId, config)
  const record = await provider.getAppointmentById(active.appointmentId)
  const when = formatAppointmentWhen(record?.slot?.startsAt || active.startsAt)

  await saveState(agentId, contactId, { status: 'idle' })

  return {
    handled: true,
    reply:
      `Sua próxima ${meetingLabel(config)} está marcada para *${when}*.\n\n` +
      'Para *cancelar*, digite: *cancelar reunião*. Para remarcar, diga *agendar*.',
  }
}

function formatBookedConfirmation(appointment: any, config: AgentSchedulingConfig): string {
  const startsAt = appointment?.slot?.startsAt || appointment?.scheduledAt
  const when = startsAt
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date(startsAt))
    : 'horário confirmado'

  return (
    `Perfeito! Sua ${meetingLabel(config)} foi *agendada* para ${when}.\n\n` +
    'Você receberá os detalhes no e-mail informado.\n\n' +
    'Para *cancelar* essa reunião depois, digite: *cancelar reunião*.'
  )
}

async function tryCancelResolvedAppointment(
  agentId: string,
  contactId: string,
  config: AgentSchedulingConfig,
  active: { appointmentId: string; integrationId: string; startsAt?: string }
): Promise<SchedulingTurnResult> {
  const integrationId = active.integrationId || config.calendly_integration_id

  try {
    const result = await executeIntegrationTool({
      provider: 'calendly',
      toolName: 'cancel_appointment',
      payload: {
        integrationId,
        appointmentId: active.appointmentId,
        reason: 'Cancelado pelo contato via Sonia (WhatsApp)',
      },
    })

    if (!result.success) {
      return {
        handled: true,
        reply:
          'Não consegui cancelar no Calendly agora. Tente novamente em alguns minutos ou cancele pelo link do convite no seu e-mail.',
      }
    }

    await clearLastBooking(agentId, contactId)
    await saveState(agentId, contactId, { status: 'idle' })

    const when = formatAppointmentWhen(active.startsAt)

    return {
      handled: true,
      reply:
        `Pronto! Sua reunião de ${when} foi *cancelada* no Calendly. ` +
        'Se quiser remarcar, é só dizer *agendar*.',
      reset: true,
    }
  } catch (error: any) {
    const msg = String(error?.message || error || '')
    logger.warn('[scheduling] cancel Calendly falhou', { message: msg.slice(0, 300) })
    return {
      handled: true,
      reply:
        'Não foi possível cancelar automaticamente. Use o link de cancelamento no e-mail do Calendly ou digite *agendar* para tentar outro fluxo.',
    }
  }
}

async function tryCancelLastBooking(
  agentId: string,
  contactId: string,
  config: AgentSchedulingConfig,
  state: SchedulingState,
  message: string,
  lookupContext: {
    fallbackPhone?: string | null
    integrationsId?: string | null
    historyContactKey?: string | null
    contactDisplayName?: string | null
  }
): Promise<SchedulingTurnResult> {
  const hints = await buildBookingLookupHints({
    agentId,
    contactId,
    state,
    message,
    fallbackPhone: lookupContext.fallbackPhone,
    integrationsId: lookupContext.integrationsId,
    historyContactKey: lookupContext.historyContactKey,
    contactDisplayName: lookupContext.contactDisplayName,
  })

  const active = await resolveActiveAppointmentId(agentId, contactId, config, hints)

  if (!active?.appointmentId) {
    if (!hints.email) {
      return startBookingLookup(agentId, contactId, state, 'cancel')
    }
    await saveState(agentId, contactId, {
      ...state,
      status: 'awaiting_booking_lookup',
      pending_booking_action: 'cancel',
      patient_email: hints.email || state.patient_email,
      patient_name: hints.name || state.patient_name,
      patient_phone: hints.phone || state.patient_phone,
    })
    return { handled: true, reply: bookingNotFoundReply('cancel', hints.email) }
  }

  return tryCancelResolvedAppointment(agentId, contactId, config, active)
}

async function tryBookSlot(
  agentId: string,
  contactId: string,
  config: AgentSchedulingConfig,
  state: SchedulingState,
  slotId: string
): Promise<{ ok: boolean; reply: string }> {
  const resolved = await resolveSchedulingCalendlyConfig(agentId, config)
  try {
    const result = await executeIntegrationTool({
      provider: 'calendly',
      toolName: 'book_appointment',
      payload: {
        integrationId: resolved.calendly_integration_id,
        specialty: config.specialty,
        slotId,
        patientName: state.patient_name,
        patientEmail: state.patient_email,
        patientPhone: state.patient_phone,
        notes: 'Agendamento conversacional via Sonia (WhatsApp)',
      },
    })

    if (!result.success) {
      const preferredDate = state.preferred_date || null
      if (preferredDate) {
        try {
          const freshSlots = await fetchAvailability(agentId, config, state, preferredDate)
          const recovery = await offerSlotsAfterOccupiedTime({
            agentId,
            contactId,
            config,
            state,
            allSlots: freshSlots,
            preferredDate,
            preferredTime: state.preferred_time || null,
          })
          if (recovery.reply) {
            return { ok: false, reply: recovery.reply }
          }
        } catch {
          // segue mensagem genérica
        }
      }
      return {
        ok: false,
        reply:
          'Esse horário acabou de ser ocupado por outra pessoa. Informe outro *dia e horário* ou digite *cancelar*.',
      }
    }

    const appointment = result.data?.appointment as Record<string, unknown> | undefined
    const appointmentId = String(appointment?.appointmentId || appointment?.scheduledEventUri || '').trim()
    if (appointmentId) {
      const startsAt =
        (appointment?.slot as { startsAt?: string } | undefined)?.startsAt ||
        String(appointment?.startsAt || '')
      await saveLastBooking(agentId, contactId, {
        appointmentId,
        calendly_integration_id: resolved.calendly_integration_id,
        patient_email: state.patient_email,
        starts_at: startsAt || undefined,
        booked_at: new Date().toISOString(),
      })
    }

    return {
      ok: true,
      reply: formatBookedConfirmation(result.data?.appointment, config),
    }
  } catch (error: any) {
    const msg = String(error?.message || error || '')
    logger.warn('[scheduling] book Calendly falhou', { message: msg.slice(0, 300) })

    if (
      msg.includes('questions_and_answers') ||
      msg.includes('Invalid Argument') ||
      msg.includes('Calendly API 400')
    ) {
      return {
        ok: false,
        reply:
          'Quase lá! O Calendly exige uma resposta no formulário do evento. Tente outro horário ou peça ao time para simplificar as perguntas do "30 Minute Meeting".',
      }
    }

    return {
      ok: false,
      reply:
        'Não consegui confirmar a reunião no Calendly agora. Tente outro horário ou digite *cancelar* para recomeçar.',
    }
  }
}

export function pickSlotFromNumericChoice(message: string, slots: AppointmentSlot[]): AppointmentSlot | null {
  const match = String(message || '').trim().match(/^\s*(\d{1,2})\s*$/)
  if (!match) return null
  const index = parseInt(match[1], 10) - 1
  if (index < 0 || index >= slots.length) return null
  return slots[index] || null
}

function slotDateIsoInSaoPaulo(startsAt: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(startsAt))
  } catch {
    return ''
  }
}

function filterSlotsOnDate(slots: AppointmentSlot[], dateIso: string | null): AppointmentSlot[] {
  if (!dateIso) return slots
  return slots.filter((slot) => slotDateIsoInSaoPaulo(slot.startsAt) === dateIso)
}

function formatRequestedDateTime(date: string | null, time: string | null): string {
  if (!date && !time) return 'o horário informado'
  let brDate = 'esse dia'
  if (date) {
    const [y, m, d] = date.split('-')
    if (y && m && d) brDate = `${d}/${m}/${y}`
  }
  return time ? `${brDate} às ${time}` : brDate
}

async function offerSlotsAfterOccupiedTime(input: {
  agentId: string
  contactId: string
  config: AgentSchedulingConfig
  state: SchedulingState
  allSlots: AppointmentSlot[]
  preferredDate: string | null
  preferredTime: string | null
}): Promise<SchedulingTurnResult> {
  const sameDay = filterSlotsOnDate(input.allSlots, input.preferredDate)
  const toOffer = (sameDay.length > 0 ? sameDay : input.allSlots).slice(0, 8)
  const requested = formatRequestedDateTime(input.preferredDate, input.preferredTime)

  if (toOffer.length === 0) {
    await saveState(input.agentId, input.contactId, { status: 'idle' })
    return {
      handled: true,
      reply:
        `O horário de *${requested}* já está *ocupado* e não há mais vagas nesse dia.\n\n` +
        'Informe outro *dia e horário* ou digite *cancelar*.',
    }
  }

  const nextState: SchedulingState = {
    ...input.state,
    status: 'offering_slots',
    appointment_slots: toOffer,
    preferred_date: input.preferredDate,
    preferred_time: input.preferredTime,
  }
  await saveState(input.agentId, input.contactId, nextState)

  const slotMessage = buildAppointmentSlotSelectionMessage({
    specialty: meetingLabel(input.config),
    appointment_slots: toOffer,
  })

  const intro =
    input.preferredDate && input.preferredTime
      ? `Esse horário (*${requested}*) já está *ocupado*. No mesmo dia, ainda temos estas opções:\n\n`
      : 'Esse horário exato não está livre. Veja as opções disponíveis:\n\n'

  return { handled: true, reply: intro + slotMessage }
}

function formatSlotPreview(startsAt: string): string {
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

export async function processSchedulingTurn(input: {
  agentId: string
  contactId: string
  message: string
  schedulingConfig: AgentSchedulingConfig
  fallbackPhone?: string | null
  integrationsId?: string | null
  historyContactKey?: string | null
  contactDisplayName?: string | null
  templateRole?: string | null
}): Promise<SchedulingTurnResult> {
  const message = String(input.message || '').trim()
  const config = input.schedulingConfig
  void input.templateRole
  const fallbackPhone = input.fallbackPhone
  const lookupContext = {
    fallbackPhone,
    integrationsId: input.integrationsId,
    historyContactKey: input.historyContactKey || input.contactId,
    contactDisplayName: input.contactDisplayName,
  }

  let state = await loadState(input.agentId, input.contactId)

  state = mergeProfile(state, message)

  if (state.status === 'awaiting_booking_lookup') {
    return handleAwaitingBookingLookup({
      agentId: input.agentId,
      contactId: input.contactId,
      message,
      config,
      state,
      ...lookupContext,
    })
  }

  if (looksLikeCancelBookedAppointment(message)) {
    return tryCancelLastBooking(
      input.agentId,
      input.contactId,
      config,
      state,
      message,
      lookupContext
    )
  }

  if (looksLikeQueryExistingAppointment(message)) {
    return tryQueryExistingAppointment(
      input.agentId,
      input.contactId,
      config,
      state,
      message,
      lookupContext
    )
  }

  if (looksLikeAbortSchedulingFlow(message)) {
    await saveState(input.agentId, input.contactId, { status: 'idle' })
    return {
      handled: true,
      reply:
        'Sem problemas, interrompi o agendamento. Posso tirar outras dúvidas ou reiniciar quando quiser — é só dizer *agendar*.',
      reset: true,
    }
  }

  if (state.status === 'idle') {
    if (!looksLikeSchedulingIntent(message)) {
      return { handled: false }
    }
    state = { status: 'awaiting_datetime' }
    await saveState(input.agentId, input.contactId, state)
    return {
      handled: true,
      reply:
        `Que ótimo, ficamos felizes com seu interesse! Vou consultar a agenda para sua ${meetingLabel(config)}.\n\n` +
        'Qual *dia e horário* você prefere para a reunião? (ex.: 25/05/2026 às 15:00)',
    }
  }

  if (state.status === 'awaiting_datetime') {
    const extracted = await extractDateTimeFromMessage(message)
    state.preferred_date = extracted.date
    state.preferred_time = extracted.time

    if (!extracted.date && extracted.confidence === 'low') {
      return {
        handled: true,
        reply: 'Pode informar o *dia e horário* desejados? Ex.: 20/05/2026 às 14:30',
      }
    }

    let slots: AppointmentSlot[] = []
    try {
      slots = await fetchAvailability(input.agentId, config, state, extracted.date)
      if (slots.length === 0 && extracted.date) {
        slots = await fetchAvailability(input.agentId, config, state, null)
      }
    } catch (error: any) {
      if (String(error?.message || '') === 'CALENDLY_MAPPING_NOT_CONFIGURED') {
        return {
          handled: true,
          reply: calendlyMappingNotConfiguredReply(String(error?.specialty || config.specialty)),
        }
      }
      throw error
    }

    const exact = slots.find((slot) =>
      slotMatchesRequestedTime(slot.startsAt, extracted.date, extracted.time)
    )

    if (exact?.slotId) {
      state.selected_slot_id = exact.slotId
      state.status = 'collecting_identity'
      await saveState(input.agentId, input.contactId, state)
      const when = formatSlotPreview(exact.startsAt)
      return {
        handled: true,
        reply:
          `Ótimo! O horário *${when}* está disponível.\n\n` +
          'Para confirmar no Calendly, preciso do seu *nome completo* e *e-mail*.\n\n' +
          askMissingIdentityFields(state, fallbackPhone),
      }
    }

    if (slots.length === 0) {
      await saveState(input.agentId, input.contactId, { status: 'idle' })
      return {
        handled: true,
        reply:
          'No momento não encontrei horários disponíveis nessa data. Informe outro *dia e horário* ou digite *cancelar*.',
      }
    }

    if (extracted.date || extracted.time) {
      return offerSlotsAfterOccupiedTime({
        agentId: input.agentId,
        contactId: input.contactId,
        config,
        state,
        allSlots: slots,
        preferredDate: extracted.date,
        preferredTime: extracted.time,
      })
    }

    state.status = 'offering_slots'
    state.appointment_slots = slots
    await saveState(input.agentId, input.contactId, state)

    const slotMessage = buildAppointmentSlotSelectionMessage({
      specialty: meetingLabel(config),
      appointment_slots: slots,
    })

    return {
      handled: true,
      reply: `Encontrei horários disponíveis:\n\n${slotMessage}`,
    }
  }

  if (state.status === 'offering_slots') {
    const slots = state.appointment_slots || []
    const picked = pickSlotFromNumericChoice(message, slots)

    if (picked?.slotId) {
      state.selected_slot_id = picked.slotId
      state = mergeProfile(state, message)
      if (!hasOnsmartBookingProfile(state, fallbackPhone)) {
        state.status = 'collecting_identity'
        await saveState(input.agentId, input.contactId, state)
        return {
          handled: true,
          reply:
            `Perfeito, opção *${formatSlotPreview(picked.startsAt)}*.\n\n` +
            askMissingIdentityFields(state, fallbackPhone),
        }
      }
      const booked = await tryBookSlot(input.agentId, input.contactId, config, state, picked.slotId)
      await saveState(input.agentId, input.contactId, { status: 'idle' })
      return { handled: true, reply: booked.reply }
    }

    const extracted = await extractDateTimeFromMessage(message)
    if (extracted.date || extracted.time) {
      state.status = 'awaiting_datetime'
      state.preferred_date = extracted.date
      state.preferred_time = extracted.time
      await saveState(input.agentId, input.contactId, state)
      return processSchedulingTurn({
        agentId: input.agentId,
        contactId: input.contactId,
        message,
        schedulingConfig: config,
        fallbackPhone,
      })
    }

    return {
      handled: true,
      reply: 'Responda com o *número* da opção desejada ou informe outro dia e horário.',
    }
  }

  if (state.status === 'collecting_identity') {
    state = mergeProfile(state, message)
    if (fallbackPhone && !state.patient_phone) {
      state.patient_phone = normalizePhoneDigits(fallbackPhone) || fallbackPhone
    }

    if (!hasOnsmartBookingProfile(state, fallbackPhone)) {
      await saveState(input.agentId, input.contactId, state)
      return { handled: true, reply: askMissingIdentityFields(state, fallbackPhone) }
    }

    const slotId = state.selected_slot_id
    if (!slotId) {
      state.status = 'awaiting_datetime'
      await saveState(input.agentId, input.contactId, state)
      return {
        handled: true,
        reply:
          `Obrigada, ${state.patient_name?.split(/\s+/)[0] || ''}! Qual *dia e horário* você prefere? (ex.: 25/05/2026 às 15:00)`,
      }
    }

    const booked = await tryBookSlot(input.agentId, input.contactId, config, state, slotId)
    await saveState(input.agentId, input.contactId, { status: 'idle' })
    return { handled: true, reply: booked.reply }
  }

  return { handled: false }
}

/** Compat testes e imports legados */
export const looksLikeOnsmartSchedulingIntent = looksLikeSchedulingIntent

export const __test__ = {
  looksLikeSchedulingIntent,
  looksLikeOnsmartSchedulingIntent: looksLikeSchedulingIntent,
  looksLikeQueryExistingAppointment,
  looksLikeCancelBookedAppointment,
  pickSlotFromNumericChoice,
}
