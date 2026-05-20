import logger from '../../lib/logger'
import { resolveAppointmentProvider } from '../appointments'
import { RealCalendlyProvider } from '../integrations/calendly/calendly.provider'
import { AppointmentSlot } from '../appointments/appointment-provider'
import { FlowNode } from './flow.types'
import { buildFlowIntegrationResult, FlowIntegrationResult } from './flow-node-result'

function toIsoOffset(baseIso: string, hoursOffset: number): string {
  const date = new Date(baseIso)
  return new Date(date.getTime() + hoursOffset * 60 * 60 * 1000).toISOString()
}

function readString(data: Record<string, any>, key: string | undefined, fallbackKeys: string[] = []): string {
  const candidates = [key || '', ...fallbackKeys].filter(Boolean)
  for (const candidate of candidates) {
    const value = String(data[candidate] || '').trim()
    if (value) return value
  }
  return ''
}

function normalizeSlots(raw: unknown): AppointmentSlot[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((slot) => slot && typeof slot === 'object') as AppointmentSlot[]
}

async function resolveAppointmentId(
  provider: ReturnType<typeof resolveAppointmentProvider>,
  contextData: Record<string, any>,
  specialty: string
): Promise<string> {
  const existing = readString(contextData, 'appointment_id')
  if (existing) return existing

  const patientEmail = readString(contextData, 'patient_email', ['lead_email', 'email'])
  if (patientEmail && provider instanceof RealCalendlyProvider) {
    const resolved = await provider.findActiveAppointmentIdByInviteeEmail(patientEmail, specialty)
    if (resolved) {
      contextData.appointment_id = resolved
      return resolved
    }
  }
  return ''
}

export async function executeAppointmentNode(params: {
  node: FlowNode
  contextData: Record<string, any>
}): Promise<FlowIntegrationResult> {
  const nodeData = params.node.data || {}
  const operation = nodeData.appointmentOperation || 'availability'
  const specialty = readString(params.contextData, nodeData.specialtyField, ['specialty'])
  const doctor = readString(params.contextData, nodeData.doctorField, [
    'doctor_name',
    'doctor',
    'appointment_owner',
    'assignee_name',
  ])
  const consultationType = readString(params.contextData, nodeData.consultationTypeField, [
    'consultation_type',
    'appointment_consultation_type',
    'appointment_kind',
    'session_type',
  ])
  const unit = readString(params.contextData, nodeData.unitField, [
    'clinic_unit',
    'unit_name',
    'appointment_location',
    'location_name',
  ])
  const period = readString(params.contextData, nodeData.periodField, [
    'preferred_period',
    'appointment_time_preference',
    'availability_window',
  ])
  const preferredDate = readString(params.contextData, nodeData.preferredDateField, [
    'preferred_date',
    'appointment_date',
    'requested_date',
  ])
  const patientName = readString(params.contextData, 'patient_name', ['lead_name', 'name'])
  const patientEmail = readString(params.contextData, 'patient_email', ['lead_email', 'email'])
  const patientPhone = readString(params.contextData, 'patient_phone', ['lead_phone', 'phone'])

  if (!specialty && operation === 'availability') {
    return buildFlowIntegrationResult('appointment', {
      success: false,
      status: 'incomplete',
      error_code: 'specialty_required',
      user_safe_message: 'Ainda falta definir a especialidade para buscar horários.',
      retryable: false,
      integration_status: 'partial',
      appointment_action: operation,
      appointment_status: 'incomplete',
    })
  }

  try {
    const provider = resolveAppointmentProvider(nodeData.appointmentProvider || 'calendly', {
      integrationId: nodeData.appointmentIntegrationId || null,
    })

    if (operation === 'availability') {
      const slots = await provider.getAvailability({
        specialty,
        doctor,
        consultationType,
        unit,
        period,
        preferredDate,
        patientName,
      })
      return buildFlowIntegrationResult('appointment', {
        success: true,
        status: slots.length > 0 ? 'available' : 'unavailable',
        user_safe_message:
          slots.length > 0
            ? 'Encontramos horários disponíveis para a consulta.'
            : 'Não encontramos horários nesse momento.',
        retryable: false,
        integration_status: 'success',
        appointment_action: operation,
        appointment_status: slots.length > 0 ? 'available' : 'unavailable',
        appointment_slots: slots,
        appointment_waitlist: slots.length === 0,
        provider: provider.providerKey,
      })
    }

    if (operation === 'book') {
      const availableSlots = normalizeSlots(params.contextData.appointment_slots)
      const selectedSlotId = readString(params.contextData, 'appointment_selected_slot_id', [
        'appointment_slot_id',
        'preferred_slot_id',
      ])
      const allowAutoSelectFirstSlot = nodeData.autoSelectFirstSlot === true
      const slotId = selectedSlotId || (allowAutoSelectFirstSlot ? availableSlots[0]?.slotId || '' : '')
      if (!specialty || !slotId) {
        return buildFlowIntegrationResult('appointment', {
          success: false,
          status: 'incomplete',
          error_code: 'slot_required',
          user_safe_message: 'Ainda falta confirmar o horário desejado.',
          retryable: false,
          integration_status: 'partial',
          appointment_action: operation,
          appointment_status: 'incomplete',
        })
      }
      const booked = await provider.book({
        specialty,
        slotId,
        patientName,
        patientEmail,
        patientPhone,
        consultationType,
        unit,
        notes: String(params.contextData.triage_notes || '').trim() || null,
      })
      return buildFlowIntegrationResult('appointment', {
        success: true,
        status: 'confirmed',
        user_safe_message: 'Consulta agendada com sucesso.',
        retryable: false,
        integration_status: 'success',
        appointment_action: operation,
        appointment_status: 'confirmed',
        appointment_id: booked.appointmentId,
        appointment_slot: booked.slot,
        appointment_slots: [booked.slot],
        appointment_reminder_24h_at: toIsoOffset(booked.slot.startsAt, -24),
        appointment_reminder_2h_at: toIsoOffset(booked.slot.startsAt, -2),
        appointment_followup_at: toIsoOffset(booked.slot.startsAt, 4),
        provider: provider.providerKey,
      })
    }

    if (operation === 'reschedule') {
      const appointmentId = await resolveAppointmentId(provider, params.contextData, specialty)
      const availableSlots = normalizeSlots(params.contextData.appointment_slots)
      const selectedSlotId = readString(params.contextData, 'appointment_selected_slot_id', [
        'appointment_slot_id',
        'preferred_slot_id',
      ])
      const allowAutoSelectFirstSlot = nodeData.autoSelectFirstSlot === true
      const slotId = selectedSlotId || (allowAutoSelectFirstSlot ? availableSlots[0]?.slotId || '' : '')
      if (!appointmentId || !slotId || !specialty) {
        return buildFlowIntegrationResult('appointment', {
          success: false,
          status: 'incomplete',
          error_code: 'appointment_or_slot_required',
          user_safe_message: 'Ainda faltam dados para remarcar a consulta.',
          retryable: false,
          integration_status: 'partial',
          appointment_action: operation,
          appointment_status: 'incomplete',
        })
      }
      const updated = await provider.reschedule({
        appointmentId,
        specialty,
        slotId,
        patientName,
        patientEmail,
        patientPhone,
        consultationType,
        unit,
        notes: 'Rescheduled by flow',
      })
      return buildFlowIntegrationResult('appointment', {
        success: true,
        status: 'rescheduled',
        user_safe_message: 'Consulta remarcada com sucesso.',
        retryable: false,
        integration_status: 'success',
        appointment_action: operation,
        appointment_status: 'rescheduled',
        appointment_id: updated.appointmentId,
        appointment_slot: updated.slot,
        appointment_slots: [updated.slot],
        appointment_reminder_24h_at: toIsoOffset(updated.slot.startsAt, -24),
        appointment_reminder_2h_at: toIsoOffset(updated.slot.startsAt, -2),
        appointment_followup_at: toIsoOffset(updated.slot.startsAt, 4),
        provider: provider.providerKey,
      })
    }

    const appointmentId = await resolveAppointmentId(provider, params.contextData, specialty)
    if (!appointmentId) {
      return buildFlowIntegrationResult('appointment', {
        success: false,
        status: 'incomplete',
        error_code: 'appointment_id_required',
        user_safe_message:
          'Não encontramos uma consulta ativa para cancelar. Envie o e-mail usado no agendamento (ex.: marcelo123@gmail.com).',
        retryable: false,
        integration_status: 'partial',
        appointment_action: operation,
        appointment_status: 'incomplete',
      })
    }
    const cancelled = await provider.cancel({
      appointmentId,
      reason: String(params.contextData.cancellation_reason || '').trim() || null,
    })
    if (!cancelled) {
      return buildFlowIntegrationResult('appointment', {
        success: false,
        status: 'not_found',
        error_code: 'appointment_not_found',
        user_safe_message: 'A consulta informada não foi localizada.',
        retryable: false,
        integration_status: 'failed',
        appointment_action: operation,
        appointment_status: 'not_found',
      })
    }
    return buildFlowIntegrationResult('appointment', {
      success: true,
      status: 'cancelled',
      user_safe_message: 'Consulta cancelada com sucesso.',
      retryable: false,
      integration_status: 'success',
      appointment_action: operation,
      appointment_status: 'cancelled',
      appointment_id: cancelled.appointmentId,
      appointment_slot: cancelled.slot,
      appointment_slots: [cancelled.slot],
      provider: provider.providerKey,
    })
  } catch (error: any) {
    logger.error('[flow-node-appointment] Falha na operação de agenda', {
      operation,
      error: error?.message || error,
    })
    const rawError = String(error?.message || '')
    let errorCode = 'appointment_failed'
    let userSafeMessage = 'Não foi possível concluir a operação de agenda agora.'
    if (rawError.includes('calendar_integration_required')) {
      errorCode = 'calendar_integration_required'
      userSafeMessage = 'Ainda falta configurar a integração de agenda.'
    } else if (rawError.includes('event_type_mapping_not_found')) {
      errorCode = 'event_type_mapping_not_found'
      userSafeMessage = 'A integração do Calendly ainda não foi mapeada para essa especialidade.'
    } else if (rawError.includes('unsupported_appointment_provider')) {
      errorCode = 'unsupported_appointment_provider'
    } else if (rawError.includes('slot_unavailable')) {
      errorCode = 'slot_unavailable'
      userSafeMessage = 'O horário escolhido não está mais disponível.'
    } else if (rawError.includes('appointment_not_found')) {
      errorCode = 'appointment_not_found'
      userSafeMessage = 'Não encontramos a consulta informada.'
    }
    return buildFlowIntegrationResult('appointment', {
      success: false,
      status: 'failed',
      error_code: errorCode,
      user_safe_message: userSafeMessage,
      retryable: true,
      integration_status: 'failed',
      appointment_action: operation,
      appointment_status: 'failed',
      provider: 'calendly',
      error_message: error?.message || 'Erro desconhecido',
    })
  }
}
