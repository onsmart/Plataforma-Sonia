import { randomUUID } from 'crypto'
import logger from '../../lib/logger'
import { supabase } from '../../lib/supabase'
import {
  AppointmentAvailabilityQuery,
  AppointmentBookingInput,
  AppointmentCancelInput,
  AppointmentProvider,
  AppointmentRecord,
  AppointmentRescheduleInput,
  AppointmentSlot,
} from './appointment-provider'

type StoredAppointmentRow = {
  appointment_id: string
  provider_key: string
  status: 'confirmed' | 'cancelled' | 'rescheduled'
  slot_id: string
  starts_at: string
  ends_at: string
  specialty: string
  doctor_name: string
  consultation_type: string
  unit_name: string
  period: string
  timezone: string
  mode: 'presencial' | 'online'
  location: string
  patient_name?: string | null
  patient_email?: string | null
  patient_phone?: string | null
  notes?: string | null
}

const TABLE_NAME = 'tb_flow_mock_appointments'
const memoryAppointments = new Map<string, StoredAppointmentRow>()
const DEFAULT_TIMEZONE = 'America/Sao_Paulo'
const SLOT_TEMPLATE = [
  { hour: 9, minute: 0, period: 'manha' },
  { hour: 10, minute: 30, period: 'manha' },
  { hour: 14, minute: 0, period: 'tarde' },
  { hour: 15, minute: 30, period: 'tarde' },
  { hour: 19, minute: 0, period: 'noite' },
]

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function normalizePeriod(value: unknown): string {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  if (raw.includes('man')) return 'manha'
  if (raw.includes('tar')) return 'tarde'
  if (raw.includes('noi')) return 'noite'
  return raw
}

function normalizeMode(value: unknown): 'presencial' | 'online' {
  const raw = String(value || '').trim().toLowerCase()
  return raw.includes('online') ? 'online' : 'presencial'
}

function normalizeStoredRecord(row: StoredAppointmentRow): AppointmentRecord {
  return {
    appointmentId: row.appointment_id,
    status: row.status,
    patientName: row.patient_name || null,
    patientEmail: row.patient_email || null,
    patientPhone: row.patient_phone || null,
    notes: row.notes || null,
    slot: {
      slotId: row.slot_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      specialty: row.specialty,
      doctor: row.doctor_name,
      consultationType: row.consultation_type,
      unit: row.unit_name,
      period: row.period,
      timezone: row.timezone,
      mode: row.mode,
      location: row.location,
      provider: row.provider_key,
    },
  }
}

function buildSlot(params: {
  dayOffset: number
  specialty: string
  doctor?: string | null
  consultationType?: string | null
  unit?: string | null
  period?: string
  timezone?: string | null
  template: { hour: number; minute: number; period: string }
}): AppointmentSlot {
  const now = new Date()
  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + params.dayOffset,
      params.template.hour + 3,
      params.template.minute
    )
  )
  const end = addMinutes(start, 30)
  const consultationType = String(params.consultationType || 'presencial').trim() || 'presencial'
  const mode = normalizeMode(consultationType)
  const doctor = String(params.doctor || `Dr(a). ${params.specialty}`).trim()
  const unit = String(params.unit || 'Unidade Central').trim()
  const slotId = [
    params.specialty,
    doctor,
    unit,
    consultationType,
    start.toISOString(),
  ]
    .map((value) => value.replace(/\s+/g, '_'))
    .join('::')

  return {
    slotId,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    specialty: params.specialty,
    doctor,
    consultationType,
    unit,
    period: params.period || params.template.period,
    timezone: params.timezone || DEFAULT_TIMEZONE,
    mode,
    location:
      mode === 'online'
        ? `https://mock-calendly.local/room/${encodeURIComponent(slotId)}`
        : `${unit} · Sala ${params.dayOffset + 1}`,
    provider: 'mock_calendly',
  }
}

async function queryTableSupported<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    return await operation()
  } catch (error: any) {
    const message = String(error?.message || error || '')
    if (
      message.toLowerCase().includes('relation') ||
      message.toLowerCase().includes(TABLE_NAME.toLowerCase()) ||
      message.toLowerCase().includes('schema cache')
    ) {
      logger.warn('[mock-calendly] Tabela de persistência indisponível, usando memória', {
        table: TABLE_NAME,
        error: message,
      })
      return null
    }
    throw error
  }
}

async function listStoredAppointments(): Promise<StoredAppointmentRow[]> {
  const dbRows = await queryTableSupported(async () => {
    const { data, error } = await supabase.from(TABLE_NAME).select('*')
    if (error) throw error
    return (data || []) as StoredAppointmentRow[]
  })
  if (dbRows) return dbRows
  return Array.from(memoryAppointments.values())
}

async function upsertStoredAppointment(row: StoredAppointmentRow): Promise<void> {
  const dbResult = await queryTableSupported(async () => {
    const { error } = await supabase.from(TABLE_NAME).upsert(row, {
      onConflict: 'appointment_id',
    })
    if (error) throw error
    return true
  })
  if (dbResult) return
  memoryAppointments.set(row.appointment_id, row)
}

async function getStoredAppointment(appointmentId: string): Promise<StoredAppointmentRow | null> {
  const dbRow = await queryTableSupported(async () => {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('appointment_id', appointmentId)
      .maybeSingle()
    if (error) throw error
    return (data as StoredAppointmentRow | null) || null
  })
  if (dbRow !== null) return dbRow
  return memoryAppointments.get(appointmentId) || null
}

export class MockCalendlyProvider implements AppointmentProvider {
  providerKey = 'mock_calendly'

  async getAvailability(query: AppointmentAvailabilityQuery): Promise<AppointmentSlot[]> {
    const normalizedPeriod = normalizePeriod(query.period)
    const stored = await listStoredAppointments()
    const occupied = new Set(
      stored.filter((row) => row.status !== 'cancelled').map((row) => row.slot_id)
    )
    const slots: AppointmentSlot[] = []

    for (let dayOffset = 1; dayOffset <= 7; dayOffset += 1) {
      for (const template of SLOT_TEMPLATE) {
        if (normalizedPeriod && template.period !== normalizedPeriod) continue
        const slot = buildSlot({
          dayOffset,
          specialty: query.specialty,
          doctor: query.doctor,
          consultationType: query.consultationType,
          unit: query.unit,
          period: template.period,
          timezone: query.timezone,
          template,
        })
        if (!occupied.has(slot.slotId)) {
          slots.push(slot)
        }
      }
    }

    if (query.preferredDate) {
      const filtered = slots.filter((slot) => slot.startsAt.startsWith(String(query.preferredDate).slice(0, 10)))
      if (filtered.length > 0) {
        return filtered.slice(0, 6)
      }
    }

    return slots.slice(0, 6)
  }

  async book(input: AppointmentBookingInput): Promise<AppointmentRecord> {
    const availableSlots = await this.getAvailability({
      specialty: input.specialty,
      consultationType: input.consultationType,
      unit: input.unit,
    })
    const slot = availableSlots.find((candidate) => candidate.slotId === input.slotId)
    if (!slot) {
      throw new Error('slot_unavailable')
    }
    const appointmentId = randomUUID()
    const row: StoredAppointmentRow = {
      appointment_id: appointmentId,
      provider_key: this.providerKey,
      status: 'confirmed',
      slot_id: slot.slotId,
      starts_at: slot.startsAt,
      ends_at: slot.endsAt,
      specialty: slot.specialty,
      doctor_name: slot.doctor,
      consultation_type: slot.consultationType,
      unit_name: slot.unit,
      period: slot.period,
      timezone: slot.timezone,
      mode: slot.mode,
      location: slot.location,
      patient_name: input.patientName || null,
      patient_email: input.patientEmail || null,
      patient_phone: input.patientPhone || null,
      notes: input.notes || null,
    }
    await upsertStoredAppointment(row)
    return normalizeStoredRecord(row)
  }

  async reschedule(input: AppointmentRescheduleInput): Promise<AppointmentRecord> {
    const existing = await this.getAppointmentById(input.appointmentId)
    if (!existing) {
      throw new Error('appointment_not_found')
    }
    await this.cancel({ appointmentId: input.appointmentId, reason: 'rescheduled' })
    const booked = await this.book(input)
    const rescheduledRow = await getStoredAppointment(booked.appointmentId)
    if (rescheduledRow) {
      rescheduledRow.status = 'rescheduled'
      await upsertStoredAppointment(rescheduledRow)
      return normalizeStoredRecord(rescheduledRow)
    }
    return booked
  }

  async cancel(input: AppointmentCancelInput): Promise<AppointmentRecord | null> {
    const row = await getStoredAppointment(input.appointmentId)
    if (!row) return null
    row.status = 'cancelled'
    row.notes = [row.notes || '', input.reason || ''].filter(Boolean).join(' | ') || null
    await upsertStoredAppointment(row)
    return normalizeStoredRecord(row)
  }

  async getAppointmentById(appointmentId: string): Promise<AppointmentRecord | null> {
    const row = await getStoredAppointment(appointmentId)
    return row ? normalizeStoredRecord(row) : null
  }
}

