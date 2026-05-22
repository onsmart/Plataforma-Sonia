import { getRedisClient } from '../../lib/redis'
import logger from '../../lib/logger'
import type { AppointmentSlot } from '../appointments/appointment-provider'
import { executeIntegrationTool } from '../integrations/toolkit/toolkit.service'
import {
  extractPatientProfileFromMessage,
  getMissingRegistrationFields,
  hasMinimalPatientProfile,
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

function profileAsRecord(state: SchedulingState): Record<string, unknown> {
  return {
    patient_name: state.patient_name,
    patient_email: state.patient_email,
    patient_phone: state.patient_phone,
  }
}

function askMissingIdentityFields(state: SchedulingState): string {
  const missing = getMissingRegistrationFields(profileAsRecord(state))
  if (missing.includes('patient_name')) {
    return 'Para agendar, preciso do seu *nome completo*.'
  }
  if (missing.includes('patient_email')) {
    return 'Obrigada! Agora informe seu *e-mail* para enviarmos o convite da reunião.'
  }
  if (missing.includes('patient_phone')) {
    return 'Perfeito. Por último, seu *telefone* com DDD (apenas números).'
  }
  return 'Informe *nome completo*, *e-mail* e *telefone* em uma ou mais mensagens.'
}

async function fetchAvailability(
  config: OnsmartSchedulingConfig,
  state: SchedulingState,
  preferredDate?: string | null
): Promise<AppointmentSlot[]> {
  const result = await executeIntegrationTool({
    provider: 'calendly',
    toolName: 'check_availability',
    payload: {
      integrationId: config.calendly_integration_id,
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
  config: OnsmartSchedulingConfig,
  state: SchedulingState,
  slotId: string
): Promise<{ ok: boolean; reply: string }> {
  const result = await executeIntegrationTool({
    provider: 'calendly',
    toolName: 'book_appointment',
    payload: {
      integrationId: config.calendly_integration_id,
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

export async function processSchedulingTurn(input: {
  agentId: string
  contactId: string
  message: string
  schedulingConfig: OnsmartSchedulingConfig
}): Promise<SchedulingTurnResult> {
  const message = String(input.message || '').trim()
  const config = input.schedulingConfig

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
    state = { status: 'collecting_identity' }
    await saveState(input.agentId, input.contactId, state)
    return {
      handled: true,
      reply:
        'Que ótimo, ficamos felizes com seu interesse! Para agendar sua conversa com nosso time, preciso de alguns dados.\n\n' +
        askMissingIdentityFields(state),
    }
  }

  if (state.status === 'collecting_identity') {
    state = mergeProfile(state, message)
    if (!hasMinimalPatientProfile(profileAsRecord(state))) {
      await saveState(input.agentId, input.contactId, state)
      return { handled: true, reply: askMissingIdentityFields(state) }
    }
    state.status = 'awaiting_datetime'
    await saveState(input.agentId, input.contactId, state)
    return {
      handled: true,
      reply:
        `Obrigada, ${state.patient_name?.split(/\s+/)[0] || ''}! Qual *dia e horário* você prefere para a reunião? (ex.: 25/05/2026 às 15:00)`,
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

    let slots = await fetchAvailability(config, state, extracted.date)
    if (slots.length === 0 && extracted.date) {
      slots = await fetchAvailability(config, state, null)
    }

    const exact = slots.find((slot) =>
      slotMatchesRequestedTime(slot.startsAt, extracted.date, extracted.time)
    )

    if (exact?.slotId) {
      const booked = await tryBookSlot(config, state, exact.slotId)
      await saveState(input.agentId, input.contactId, { status: 'idle' })
      return { handled: true, reply: booked.reply }
    }

    if (slots.length === 0) {
      await saveState(input.agentId, input.contactId, { status: 'idle' })
      return {
        handled: true,
        reply:
          'No momento não encontrei horários disponíveis na sua data. Nossa equipe pode ajudar pelo site https://www.onsmart.ai — ou tente outro dia da semana.',
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
          ? 'Esse horário não está mais disponível.\n\n'
          : '') + slotMessage,
    }
  }

  if (state.status === 'offering_slots') {
    const slots = state.appointment_slots || []
    const picked = pickSlotFromNumericChoice(message, slots)

    if (picked?.slotId) {
      const booked = await tryBookSlot(config, state, picked.slotId)
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
      })
    }

    return {
      handled: true,
      reply: 'Responda com o *número* da opção desejada ou informe outro dia e horário.',
    }
  }

  return { handled: false }
}

export const __test__ = {
  looksLikeOnsmartSchedulingIntent,
  pickSlotFromNumericChoice,
}
