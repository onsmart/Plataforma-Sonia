import logger from '../../../lib/logger'
import { resolveCalendlyAvailabilityRange } from '../../agents/agent-scheduling-datetime'
import {
  AppointmentAvailabilityQuery,
  AppointmentBookingInput,
  AppointmentCancelInput,
  AppointmentProvider,
  AppointmentRecord,
  AppointmentRescheduleInput,
  AppointmentSlot,
} from '../../appointments/appointment-provider'
import { CalComApiClient } from './calcom.client'
import { loadCalComIntegrationConfig } from './calcom.repository'
import {
  CalComEventTypeMapping,
  CalComEventTypeResource,
  CalComIntegrationConfig,
  CalComLocation,
} from './calcom.types'

function buildSlotId(eventTypeId: number, startTime: string): string {
  return Buffer.from(JSON.stringify({ eventTypeId, startTime }), 'utf8').toString('base64url')
}

function parseSlotId(slotId: string): { eventTypeId: number; startTime: string } | null {
  const normalized = String(slotId || '').trim()
  if (!normalized) return null
  try {
    const parsed = JSON.parse(Buffer.from(normalized, 'base64url').toString('utf8')) as Record<string, unknown>
    const eventTypeId = Number(parsed.eventTypeId)
    const startTime = String(parsed.startTime || '').trim()
    if (!Number.isFinite(eventTypeId) || !startTime) return null
    return { eventTypeId, startTime }
  } catch {
    return null
  }
}

function toRange(preferredDate?: string | null): { startTime: string; endTime: string } {
  const resolved = resolveCalendlyAvailabilityRange(preferredDate)
  if (resolved.dateInPast) throw new Error('preferred_date_in_past')
  return { startTime: resolved.startTime, endTime: resolved.endTime }
}

function normalizeText(value?: string | null): string {
  return String(value || '').trim().toLowerCase()
}

function selectBestMapping(
  mappings: CalComEventTypeMapping[],
  query: AppointmentAvailabilityQuery
): CalComEventTypeMapping | null {
  const specialty = normalizeText(query.specialty)
  const doctor = normalizeText(query.doctor)
  const unit = normalizeText(query.unit)
  const consultationType = normalizeText(query.consultationType)

  const candidates = mappings
    .filter((m) => m.active !== false)
    .filter((m) => normalizeText(m.specialty) === specialty)
    .filter((m) => !m.doctor || normalizeText(m.doctor) === doctor)
    .filter((m) => !m.unit || normalizeText(m.unit) === unit)
    .filter((m) => !m.consultationType || normalizeText(m.consultationType) === consultationType)

  if (!candidates.length) return null
  const score = (m: CalComEventTypeMapping) =>
    [m.doctor, m.unit, m.consultationType].filter(Boolean).length
  return [...candidates].sort((a, b) => score(b) - score(a))[0] || null
}

function pickPrimaryLocation(eventType: CalComEventTypeResource | null | undefined): {
  locationKind: string | null
  locationLabel: string | null
} {
  const locations: CalComLocation[] = Array.isArray(eventType?.locations)
    ? eventType!.locations!.filter((l) => l?.type)
    : []

  const inPerson = locations.find((l) => {
    const t = normalizeText(l.type)
    return t === 'inperson' || t === 'in_person' || t === 'address'
  })
  const primary = inPerson || locations[0] || null
  if (!primary) return { locationKind: null, locationLabel: null }

  return {
    locationKind: primary.type || null,
    locationLabel: primary.address || primary.link || primary.hostPhoneNumber || null,
  }
}

function mapLocationMode(
  mapping: CalComEventTypeMapping | null,
  fallback: 'presencial' | 'online'
): { mode: 'presencial' | 'online'; location: string } {
  const kind = normalizeText(mapping?.locationKind)
  if (
    kind.includes('online') ||
    kind.includes('zoom') ||
    kind.includes('google') ||
    kind.includes('teams') ||
    kind.includes('integration')
  ) {
    return {
      mode: 'online',
      location: mapping?.locationLabel || 'Link da reunião online enviado na confirmação',
    }
  }
  return {
    mode: fallback,
    location: mapping?.locationLabel || 'Endereço informado na integração',
  }
}

function buildGeneratedMapping(
  eventType: CalComEventTypeResource,
  query: AppointmentAvailabilityQuery
): CalComEventTypeMapping {
  const { locationKind, locationLabel } = pickPrimaryLocation(eventType)
  return {
    id: `generated-${eventType.id}`,
    specialty: query.specialty,
    eventTypeId: eventType.id,
    eventTypeName: eventType.title,
    eventTypeSlug: eventType.slug || null,
    doctor: query.doctor || null,
    unit: query.unit || null,
    consultationType: query.consultationType || null,
    locationKind,
    locationLabel,
    timezone: null,
    active: true,
  }
}

export class RealCalComProvider implements AppointmentProvider {
  providerKey = 'calcom'
  private configPromise: Promise<CalComIntegrationConfig>

  constructor(private readonly integrationId: string) {
    this.configPromise = loadCalComIntegrationConfig(integrationId)
  }

  private async getConfig(): Promise<CalComIntegrationConfig> {
    return this.configPromise
  }

  private async getClient(): Promise<CalComApiClient> {
    const config = await this.getConfig()
    if (!config.isActive) throw new Error('Cal.com integration disabled')
    return new CalComApiClient(config)
  }

  private async resolveMapping(
    query: AppointmentAvailabilityQuery
  ): Promise<CalComEventTypeMapping> {
    const config = await this.getConfig()
    const explicit = selectBestMapping(config.eventTypeMappings, query)
    if (explicit) return explicit

    const client = await this.getClient()
    const eventTypes = await client.listEventTypes()
    const active = eventTypes.filter((et) => et.hidden !== true)
    const specialty = normalizeText(query.specialty)

    const byName = active.find((et) => {
      const hay = normalizeText(`${et.title} ${et.slug}`)
      return hay.includes(specialty.replace(/_/g, ' ')) || hay.includes(specialty)
    })

    if (byName) {
      logger.info('[calcom.provider] Usando event type por nome como fallback', {
        specialty: query.specialty,
        eventTypeName: byName.title,
      })
      return buildGeneratedMapping(byName, query)
    }

    if (active.length === 1) {
      return buildGeneratedMapping(active[0], query)
    }

    if (config.eventTypeMappings.length === 0 && active.length > 0) {
      logger.warn('[calcom.provider] Sem mapeamento; usando primeiro event type', {
        specialty: query.specialty,
        integrationId: this.integrationId,
      })
      return buildGeneratedMapping(active[0], query)
    }

    throw new Error('event_type_mapping_not_found')
  }

  async getAvailability(query: AppointmentAvailabilityQuery): Promise<AppointmentSlot[]> {
    const client = await this.getClient()
    const mapping = await this.resolveMapping(query)
    const range = toRange(query.preferredDate)
    const config = await this.getConfig()

    const slots = await client.getAvailableSlots({
      eventTypeId: mapping.eventTypeId,
      startTime: range.startTime,
      endTime: range.endTime,
      timezone: mapping.timezone || config.defaultTimezone || query.timezone,
    })

    const locationInfo = mapLocationMode(
      mapping,
      normalizeText(query.consultationType).includes('online') ? 'online' : 'presencial'
    )

    return slots.map((slot) => ({
      slotId: buildSlotId(mapping.eventTypeId, slot.time),
      startsAt: slot.time,
      endsAt: new Date(
        new Date(slot.time).getTime() + 30 * 60 * 1000
      ).toISOString(),
      specialty: query.specialty,
      doctor: query.doctor || mapping.doctor || mapping.eventTypeName,
      consultationType: query.consultationType || mapping.consultationType || 'presencial',
      unit: query.unit || mapping.unit || 'principal',
      period: query.period || '',
      timezone: mapping.timezone || config.defaultTimezone || query.timezone || 'America/Sao_Paulo',
      mode: locationInfo.mode,
      location: locationInfo.location,
      provider: this.providerKey,
      eventTypeId: mapping.eventTypeId,
      eventTypeName: mapping.eventTypeName,
    }))
  }

  async book(input: AppointmentBookingInput): Promise<AppointmentRecord> {
    const client = await this.getClient()
    const config = await this.getConfig()
    const parsed = parseSlotId(input.slotId)
    if (!parsed) throw new Error('slot_unavailable')

    const slotStartMs = Date.parse(parsed.startTime)
    if (!Number.isFinite(slotStartMs) || slotStartMs <= Date.now() + 90_000) {
      throw new Error('slot_start_time_in_past')
    }

    const patientName = String(input.patientName || '').trim()
    const patientEmail = String(input.patientEmail || '').trim()
    if (!patientName || !patientEmail) throw new Error('patient_identity_required')

    const query: AppointmentAvailabilityQuery = {
      specialty: input.specialty,
      consultationType: input.consultationType,
      unit: input.unit,
    }
    const mapping = await this.resolveMapping(query)

    const booking = await client.createBooking({
      eventTypeId: parsed.eventTypeId,
      startTime: parsed.startTime,
      name: patientName,
      email: patientEmail,
      timezone: mapping.timezone || config.defaultTimezone || 'America/Sao_Paulo',
      phoneNumber: input.patientPhone || null,
      notes: input.notes || null,
      metadata: { source: 'sonia', specialty: input.specialty },
    })

    const locationInfo = mapLocationMode(
      mapping,
      normalizeText(input.consultationType).includes('online') ? 'online' : 'presencial'
    )

    return {
      appointmentId: booking.uid,
      status: 'confirmed',
      slot: {
        slotId: input.slotId,
        startsAt: booking.start,
        endsAt: booking.end,
        specialty: input.specialty,
        doctor: mapping.doctor || mapping.eventTypeName,
        consultationType: input.consultationType || mapping.consultationType || 'presencial',
        unit: input.unit || mapping.unit || 'principal',
        period: '',
        timezone: mapping.timezone || config.defaultTimezone || 'America/Sao_Paulo',
        mode: locationInfo.mode,
        location: locationInfo.location,
        provider: this.providerKey,
      },
      patientName,
      patientEmail,
      patientPhone: input.patientPhone || null,
      notes: input.notes || null,
      cancelUrl: booking.cancelUrl || null,
      rescheduleUrl: booking.rescheduleUrl || null,
    }
  }

  async reschedule(input: AppointmentRescheduleInput): Promise<AppointmentRecord> {
    const client = await this.getClient()
    const config = await this.getConfig()
    const parsed = parseSlotId(input.slotId)
    if (!parsed) throw new Error('slot_unavailable')

    const booking = await client.rescheduleBooking(input.appointmentId, parsed.startTime)

    const query: AppointmentAvailabilityQuery = {
      specialty: input.specialty,
      consultationType: input.consultationType,
      unit: input.unit,
    }
    const mapping = await this.resolveMapping(query)
    const locationInfo = mapLocationMode(mapping, 'presencial')

    return {
      appointmentId: booking.uid,
      status: 'rescheduled',
      slot: {
        slotId: input.slotId,
        startsAt: booking.start,
        endsAt: booking.end,
        specialty: input.specialty,
        doctor: mapping.doctor || mapping.eventTypeName,
        consultationType: input.consultationType || mapping.consultationType || 'presencial',
        unit: input.unit || mapping.unit || 'principal',
        period: '',
        timezone: mapping.timezone || config.defaultTimezone || 'America/Sao_Paulo',
        mode: locationInfo.mode,
        location: locationInfo.location,
        provider: this.providerKey,
      },
      patientName: input.patientName || null,
      patientEmail: input.patientEmail || null,
      patientPhone: input.patientPhone || null,
      notes: input.notes || null,
    }
  }

  async cancel(input: AppointmentCancelInput): Promise<AppointmentRecord | null> {
    const client = await this.getClient()
    const config = await this.getConfig()
    const booking = await client.getBooking(input.appointmentId)
    if (!booking?.uid) return null

    await client.cancelBooking(booking.uid, input.reason)

    return {
      appointmentId: booking.uid,
      status: 'cancelled',
      slot: {
        slotId: buildSlotId(booking.eventTypeId || 0, booking.start),
        startsAt: booking.start,
        endsAt: booking.end,
        specialty: booking.title || 'consulta',
        doctor: booking.attendees?.[0]?.name || 'Equipe médica',
        consultationType: 'presencial',
        unit: 'principal',
        period: '',
        timezone: config.defaultTimezone || 'America/Sao_Paulo',
        mode: 'presencial',
        location: 'Clínica',
        provider: this.providerKey,
      },
    }
  }

  async getAppointmentById(appointmentId: string): Promise<AppointmentRecord | null> {
    try {
      const client = await this.getClient()
      const config = await this.getConfig()
      const booking = await client.getBooking(appointmentId)
      if (!booking?.uid) return null
      return {
        appointmentId: booking.uid,
        status: booking.status === 'cancelled' ? 'cancelled' : 'confirmed',
        slot: {
          slotId: buildSlotId(booking.eventTypeId || 0, booking.start),
          startsAt: booking.start,
          endsAt: booking.end,
          specialty: booking.title || 'consulta',
          doctor: booking.attendees?.[0]?.name || 'Equipe médica',
          consultationType: 'presencial',
          unit: 'principal',
          period: '',
          timezone: config.defaultTimezone || 'America/Sao_Paulo',
          mode: 'presencial',
          location: 'Clínica',
          provider: this.providerKey,
        },
      }
    } catch (error: any) {
      logger.warn('[calcom.provider] Falha ao recuperar agendamento', {
        integrationId: this.integrationId,
        appointmentId,
        error: error?.message || error,
      })
      return null
    }
  }
}
