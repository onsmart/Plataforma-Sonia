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

function looksLikeCancelScheduling(message: string): boolean {
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

async function fetchAvailability(
  agentId: string,
  config: OnsmartSchedulingConfig,
  state: SchedulingState,
  preferredDate?: string | null
): Promise<AppointmentSlot[]> {
  const resolved = await resolveSchedulingCalendlyConfig(agentId, config)
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
    'Você receberá os detalhes no e-mail informado. Se precisar de outra coisa sobre nossas soluções de IA, é só chamar.'
  )
}

async function tryBookSlot(
  agentId: string,
  config: OnsmartSchedulingConfig,
  state: SchedulingState,
  slotId: string
): Promise<{ ok: boolean; reply: string }> {
  const resolved = await resolveSchedulingCalendlyConfig(agentId, config)
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

  return {
    ok: true,
    reply: formatBookedConfirmation(result.data?.appointment),
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

  if (looksLikeCancelScheduling(message)) {
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

    let slots = await fetchAvailability(input.agentId, config, state, extracted.date)
    if (slots.length === 0 && extracted.date) {
      slots = await fetchAvailability(input.agentId, config, state, null)
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
      const booked = await tryBookSlot(input.agentId, config, state, picked.slotId)
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

    const booked = await tryBookSlot(input.agentId, config, state, slotId)
    await saveState(input.agentId, input.contactId, { status: 'idle' })
    return { handled: true, reply: booked.reply }
  }

  return { handled: false }
}

export const __test__ = {
  looksLikeOnsmartSchedulingIntent,
  pickSlotFromNumericChoice,
}
