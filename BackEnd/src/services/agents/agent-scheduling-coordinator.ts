import { getRedisClient } from '../../lib/redis'
import logger from '../../lib/logger'
import { supabase } from '../../lib/supabase'
import type { AppointmentSlot } from '../appointments/appointment-provider'
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
import type { OnsmartSchedulingConfig } from './onsmart-agent-config'
import {
  extractDateTimeFromMessage,
  slotMatchesRequestedTime,
} from './agent-scheduling-datetime'

const SCHEDULING_TTL_SEC = 7 * 24 * 60 * 60
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

export interface SchedulingState {
  status: SchedulingStatus
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

export function looksLikeOnsmartSchedulingIntent(message: string): boolean {
  if (looksLikeSchedulingRequestMessage(message)) return true
  const n = normalizeIntentText(message)
  if (isAffirmativeConfirmation(message) && /\b(agendar|reuniao|horario|conversa|diagnostico)\b/.test(n)) {
    return true
  }
  const patterns = [
    /\bagendar\b/,
    /\bagendamento\b/,
    /\bdiagnostico\b/,
    /\breuniao\b/,
    /\bconversar com (o )?time\b/,
    /\bfalar com (a )?equipe\b/,
    /\bmarcar (um )?horario\b/,
    /\bhorario disponivel\b/,
    /\bquero (uma )?reuniao\b/,
    /\b(gostaria|quero).{0,40}(agendar|reuniao|marcar)\b/,
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
  config: OnsmartSchedulingConfig
): Promise<OnsmartSchedulingConfig> {
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
  config: OnsmartSchedulingConfig,
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

function formatBookedConfirmation(appointment: any): string {
  const startsAt = appointment?.slot?.startsAt || appointment?.scheduledAt
  const when = startsAt
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date(startsAt))
    : 'horário confirmado'

  return (
    `Perfeito! Sua reunião com a Onsmart foi *agendada* para ${when}.\n\n` +
    'Você receberá os detalhes no e-mail informado.\n\n' +
    'Para *cancelar* essa reunião depois, digite: *cancelar reunião*.'
  )
}

async function tryCancelLastBooking(
  agentId: string,
  contactId: string,
  config: OnsmartSchedulingConfig
): Promise<SchedulingTurnResult> {
  const last = await loadLastBooking(agentId, contactId)
  if (!last?.appointmentId) {
    return {
      handled: true,
      reply:
        'Não encontrei uma reunião recente vinculada a esta conversa. Se acabou de agendar, aguarde um instante e tente de novo, ou digite *agendar* para marcar outro horário.',
    }
  }

  const resolved = await resolveSchedulingCalendlyConfig(agentId, config)
  const integrationId = last.calendly_integration_id || resolved.calendly_integration_id

  try {
    const result = await executeIntegrationTool({
      provider: 'calendly',
      toolName: 'cancel_appointment',
      payload: {
        integrationId,
        appointmentId: last.appointmentId,
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

    const when = last.starts_at
      ? new Intl.DateTimeFormat('pt-BR', {
          dateStyle: 'full',
          timeStyle: 'short',
          timeZone: 'America/Sao_Paulo',
        }).format(new Date(last.starts_at))
      : 'o horário informado'

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

async function tryBookSlot(
  agentId: string,
  contactId: string,
  config: OnsmartSchedulingConfig,
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
        notes: 'Agendamento via Sonia demo Onsmart (WhatsApp)',
      },
    })

    if (!result.success) {
      return {
        ok: false,
        reply:
          'Não consegui concluir o agendamento agora. Pode tentar outro horário da lista ou digitar *cancelar* para voltar.',
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
      reply: formatBookedConfirmation(result.data?.appointment),
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
  schedulingConfig: OnsmartSchedulingConfig
  fallbackPhone?: string | null
}): Promise<SchedulingTurnResult> {
  const message = String(input.message || '').trim()
  const config = input.schedulingConfig
  const fallbackPhone = input.fallbackPhone

  let state = await loadState(input.agentId, input.contactId)

  if (looksLikeCancelBookedAppointment(message)) {
    return tryCancelLastBooking(input.agentId, input.contactId, config)
  }

  if (looksLikeAbortSchedulingFlow(message)) {
    await saveState(input.agentId, input.contactId, { status: 'idle' })
    return {
      handled: true,
      reply: 'Sem problemas, interrompi o agendamento. Posso tirar dúvidas sobre a Onsmart ou reiniciar quando quiser — é só dizer *agendar*.',
      reset: true,
    }
  }

  if (state.status === 'idle') {
    if (!looksLikeOnsmartSchedulingIntent(message)) {
      return { handled: false }
    }
    state = { status: 'awaiting_datetime' }
    await saveState(input.agentId, input.contactId, state)
    return {
      handled: true,
      reply:
        'Que ótimo, ficamos felizes com seu interesse! Vou consultar a agenda do time na Onsmart.\n\n' +
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

    state.status = 'offering_slots'
    state.appointment_slots = slots
    await saveState(input.agentId, input.contactId, state)

    const slotMessage = buildAppointmentSlotSelectionMessage({
      specialty: 'reunião com a Onsmart',
      appointment_slots: slots,
    })

    return {
      handled: true,
      reply:
        (extracted.date || extracted.time
          ? 'Esse horário exato não está livre, mas encontrei estas opções:\n\n'
          : '') + slotMessage,
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

export const __test__ = {
  looksLikeOnsmartSchedulingIntent,
  looksLikeCancelBookedAppointment,
  pickSlotFromNumericChoice,
}
