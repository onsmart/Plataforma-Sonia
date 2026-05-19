import logger from '../../../lib/logger'
import {
  AppointmentAvailabilityQuery,
  AppointmentBookingInput,
  AppointmentCancelInput,
  AppointmentProvider,
  AppointmentRecord,
  AppointmentRescheduleInput,
  AppointmentSlot,
} from '../../appointments/appointment-provider'
import { loadCalendlyIntegrationConfig } from './calendly.repository'
import { CalendlyApiClient, extractCalendlyUuid } from './calendly.client'
import { CalendlyEventTypeMapping, CalendlyIntegrationConfig } from './calendly.types'

function buildSlotId(eventTypeUri: string, startsAt: string): string {
  return Buffer.from(JSON.stringify({ eventTypeUri, startsAt }), 'utf8').toString('base64url')
}

function parseSlotId(slotId: string): { eventTypeUri: string; startsAt: string } | null {
  const normalized = String(slotId || '').trim()
  if (!normalized) return null
  try {
    const parsed = JSON.parse(Buffer.from(normalized, 'base64url').toString('utf8')) as Record<string, unknown>
    const eventTypeUri = String(parsed.eventTypeUri || '').trim()
    const startsAt = String(parsed.startsAt || '').trim()
    if (!eventTypeUri || !startsAt) return null
    return { eventTypeUri, startsAt }
  } catch {
    return null
  }
}

function toRange(preferredDate?: string | null): { startTime: string; endTime: string } {
  if (preferredDate) {
    const start = new Date(`${preferredDate}T00:00:00.000Z`)
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    return { startTime: start.toISOString(), endTime: end.toISOString() }
  }
  const start = new Date(Date.now() + 60 * 60 * 1000)
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
  return { startTime: start.toISOString(), endTime: end.toISOString() }
}

function normalizeText(value?: string | null): string {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function selectBestMapping(
  mappings: CalendlyEventTypeMapping[],
  query: AppointmentAvailabilityQuery
): CalendlyEventTypeMapping | null {
  const specialty = normalizeText(query.specialty)
  const doctor = normalizeText(query.doctor)
  const unit = normalizeText(query.unit)
  const consultationType = normalizeText(query.consultationType)

  const candidates = mappings
    .filter((mapping) => mapping.active !== false)
    .filter((mapping) => normalizeText(mapping.specialty) === specialty)
    .filter((mapping) => !mapping.doctor || normalizeText(mapping.doctor) === doctor)
    .filter((mapping) => !mapping.unit || normalizeText(mapping.unit) === unit)
    .filter((mapping) => !mapping.consultationType || normalizeText(mapping.consultationType) === consultationType)

  if (candidates.length === 0) return null

  const score = (mapping: CalendlyEventTypeMapping) =>
    [mapping.doctor, mapping.unit, mapping.consultationType].filter(Boolean).length

  return [...candidates].sort((a, b) => score(b) - score(a))[0] || null
}

function mapLocation(mapping: CalendlyEventTypeMapping | null, fallbackMode: 'presencial' | 'online') {
  const locationKind = normalizeText(mapping?.locationKind)
  if (locationKind.includes('zoom') || locationKind.includes('google') || locationKind.includes('teams') || locationKind.includes('web')) {
    return {
      mode: 'online' as const,
      location: mapping?.locationLabel || 'Link da consulta online enviado na confirmação',
    }
  }

  return {
    mode: fallbackMode,
    location: mapping?.locationLabel || 'Endereço informado pela clínica',
  }
}

export class RealCalendlyProvider implements AppointmentProvider {
  providerKey = 'calendly'
  private configPromise: Promise<CalendlyIntegrationConfig>

  constructor(private readonly integrationId: string) {
    this.configPromise = loadCalendlyIntegrationConfig(integrationId)
  }

  private async getConfig() {
    return this.configPromise
  }

  private async getClient() {
    const config = await this.getConfig()
    if (!config.isActive) {
      throw new Error('Calendly integration disabled')
    }
    return new CalendlyApiClient(config)
  }

  private async resolveEventTypeUri(query: AppointmentAvailabilityQuery): Promise<CalendlyEventTypeMapping> {
    const config = await this.getConfig()
    const explicit = selectBestMapping(config.eventTypeMappings, query)
    if (explicit) return explicit

    const client = await this.getClient()
    const currentUser = !config.ownerUri || !config.organizationUri ? await client.getCurrentUser() : null
    const eventTypes = await client.listEventTypes({
      organizationUri: currentUser?.current_organization || config.organizationUri,
      ownerUri: currentUser?.uri || config.ownerUri,
      active: true,
      count: 100,
    })

    const normalizeSlug = (s?: string | null) => normalizeText(s).replace(/_/g, ' ')
    const specialty = normalizeSlug(query.specialty)
    const doctor = normalizeText(query.doctor)
    const unit = normalizeText(query.unit)
    const fallback = eventTypes.find((eventType) => {
      const haystack = [
        eventType.name,
        eventType.slug,
        eventType.description_plain,
        eventType.internal_note,
      ]
        .map((item) => normalizeSlug(item))
        .join(' ')
      if (!haystack.includes(specialty)) return false
      if (doctor && !haystack.includes(doctor)) return false
      if (unit && !haystack.includes(unit)) return false
      return true
    })

    if (!fallback) {
      throw new Error('event_type_mapping_not_found')
    }

    return {
      id: `generated-${extractCalendlyUuid(fallback.uri) || fallback.slug || 'event-type'}`,
      specialty: query.specialty,
      doctor: query.doctor || null,
      unit: query.unit || null,
      consultationType: query.consultationType || null,
      eventTypeUri: fallback.uri,
      eventTypeName: fallback.name,
      locationKind: fallback.location?.kind || null,
      locationLabel:
        fallback.location?.location || fallback.location?.additional_info || fallback.location?.phone_number || null,
      timezone: null,
      active: true,
    }
  }

  async getAvailability(query: AppointmentAvailabilityQuery): Promise<AppointmentSlot[]> {
    const client = await this.getClient()
    const mapping = await this.resolveEventTypeUri(query)
    const range = toRange(query.preferredDate)
    const availability = await client.getAvailableTimes({
      eventTypeUri: mapping.eventTypeUri,
      startTime: range.startTime,
      endTime: range.endTime,
    })

    const locationInfo = mapLocation(
      mapping,
      normalizeText(query.consultationType).includes('online') ? 'online' : 'presencial'
    )

    return availability.map((time) => ({
      slotId: buildSlotId(mapping.eventTypeUri, time.start_time),
      startsAt: time.start_time,
      endsAt: time.end_time,
      specialty: query.specialty,
      doctor: query.doctor || mapping.doctor || mapping.eventTypeName,
      consultationType: query.consultationType || mapping.consultationType || 'presencial',
      unit: query.unit || mapping.unit || 'principal',
      period: query.period || '',
      timezone: mapping.timezone || query.timezone || 'America/Sao_Paulo',
      mode: locationInfo.mode,
      location: locationInfo.location,
      provider: this.providerKey,
      eventTypeUri: mapping.eventTypeUri,
      eventTypeName: mapping.eventTypeName,
    } as AppointmentSlot & { eventTypeUri: string; eventTypeName: string }))
  }

  async book(input: AppointmentBookingInput): Promise<AppointmentRecord> {
    const client = await this.getClient()
    const parsedSlot = parseSlotId(input.slotId)
    if (!parsedSlot) {
      throw new Error('slot_unavailable')
    }
    if (!input.patientName || !input.patientEmail) {
      throw new Error('patient_identity_required')
    }

    const query: AppointmentAvailabilityQuery = {
      specialty: input.specialty,
      consultationType: input.consultationType,
      unit: input.unit,
    }
    const mapping = await this.resolveEventTypeUri(query)
    const invitee = await client.createInvitee({
      eventTypeUri: parsedSlot.eventTypeUri,
      startTime: parsedSlot.startsAt,
      name: input.patientName,
      email: input.patientEmail,
      timezone: mapping.timezone || 'America/Sao_Paulo',
      location: mapping.locationKind
        ? {
            kind: mapping.locationKind,
            location: mapping.locationLabel || undefined,
          }
        : null,
      questionsAndAnswers: input.notes
        ? [{ question: 'observacoes_triagem', answer: input.notes }]
        : undefined,
      textRemindersEnabled: false,
    })

    const scheduledEvent = await client.getScheduledEvent(invitee.event || '')
    if (!scheduledEvent?.start_time || !scheduledEvent?.end_time) {
      throw new Error('appointment_failed')
    }

    const locationInfo = mapLocation(
      mapping,
      normalizeText(input.consultationType).includes('online') ? 'online' : 'presencial'
    )

    return {
      appointmentId: scheduledEvent.uri,
      status: 'confirmed',
      slot: {
        slotId: input.slotId,
        startsAt: scheduledEvent.start_time,
        endsAt: scheduledEvent.end_time,
        specialty: input.specialty,
        doctor: mapping.doctor || mapping.eventTypeName,
        consultationType: input.consultationType || mapping.consultationType || 'presencial',
        unit: input.unit || mapping.unit || 'principal',
        period: '',
        timezone: mapping.timezone || 'America/Sao_Paulo',
        mode: locationInfo.mode,
        location: locationInfo.location,
        provider: this.providerKey,
      },
      patientName: input.patientName,
      patientEmail: input.patientEmail,
      patientPhone: input.patientPhone || null,
      notes: input.notes || null,
      cancelUrl: invitee.cancel_url || null,
      rescheduleUrl: invitee.reschedule_url || null,
      inviteeUri: invitee.uri || null,
      scheduledEventUri: scheduledEvent.uri || invitee.event || null,
    } as AppointmentRecord
  }

  async reschedule(input: AppointmentRescheduleInput): Promise<AppointmentRecord> {
    await this.cancel({
      appointmentId: input.appointmentId,
      reason: 'Rescheduled via SONIA flow',
    })
    return this.book(input)
  }

  async cancel(input: AppointmentCancelInput): Promise<AppointmentRecord | null> {
    const client = await this.getClient()
    const current = await client.getScheduledEvent(input.appointmentId)
    if (!current?.uri) {
      return null
    }
    await client.cancelScheduledEvent({
      uriOrId: current.uri,
      reason: input.reason || 'Cancelled via SONIA flow',
    })
    return {
      appointmentId: current.uri,
      status: 'cancelled',
      slot: {
        slotId: buildSlotId(current.event_type || current.uri, current.start_time || new Date().toISOString()),
        startsAt: current.start_time || new Date().toISOString(),
        endsAt: current.end_time || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        specialty: current.name || 'consulta',
        doctor: current.event_memberships?.[0]?.user_name || 'Equipe médica',
        consultationType: 'presencial',
        unit: 'principal',
        period: '',
        timezone: 'America/Sao_Paulo',
        mode: current.location?.join_url ? 'online' : 'presencial',
        location: current.location?.join_url || current.location?.location || 'Clínica',
        provider: this.providerKey,
      },
    }
  }

  async getAppointmentById(appointmentId: string): Promise<AppointmentRecord | null> {
    try {
      const client = await this.getClient()
      const current = await client.getScheduledEvent(appointmentId)
      if (!current?.uri) return null
      return {
        appointmentId: current.uri,
        status: current.cancellation ? 'cancelled' : 'confirmed',
        slot: {
          slotId: buildSlotId(current.event_type || current.uri, current.start_time || new Date().toISOString()),
          startsAt: current.start_time || new Date().toISOString(),
          endsAt: current.end_time || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          specialty: current.name || 'consulta',
          doctor: current.event_memberships?.[0]?.user_name || 'Equipe médica',
          consultationType: current.location?.join_url ? 'online' : 'presencial',
          unit: 'principal',
          period: '',
          timezone: 'America/Sao_Paulo',
          mode: current.location?.join_url ? 'online' : 'presencial',
          location: current.location?.join_url || current.location?.location || 'Clínica',
          provider: this.providerKey,
        },
      }
    } catch (error: any) {
      logger.warn('[calendly.provider] Falha ao recuperar agendamento', {
        integrationId: this.integrationId,
        appointmentId,
        error: error?.message || error,
      })
      return null
    }
  }
}

