import logger from '../../../lib/logger'
import {
  HUBSPOT_SONIA_APPOINTMENT_AT_PROPERTY,
  HUBSPOT_SONIA_APPOINTMENT_SPECIALTY_PROPERTY,
  HUBSPOT_SONIA_APPOINTMENT_STATUS_PROPERTY,
  HUBSPOT_SONIA_CALENDLY_EVENT_PROPERTY,
  HUBSPOT_SONIA_PATIENT_PROPERTIES,
  isScheduledAppointmentStatus,
  normalizeSoniaAppointmentStatus,
  SONIA_APPOINTMENT_STATUS_CANCELLED,
  SONIA_APPOINTMENT_STATUS_NONE,
  SONIA_APPOINTMENT_STATUS_SCHEDULED,
} from './hubspot-clinic.constants'
import {
  createHubSpotContact,
  getHubSpotContacts,
  searchHubSpotContacts,
  updateHubSpotContact,
} from './hubspot.service'

export interface HubSpotPatientLookupIdentifiers {
  phone?: string | null
  email?: string | null
  cpf?: string | null
}

export interface HubSpotPatientRecord {
  id: string
  firstname?: string
  lastname?: string
  name?: string
  email?: string
  phone?: string
  cpf?: string
  birthdate?: string
  appointmentStatus?: string
  appointmentAt?: string
  calendlyEventId?: string
  appointmentSpecialty?: string
  properties: Record<string, unknown>
}

function normalizeDigits(value: unknown): string {
  return String(value || '').replace(/\D/g, '').trim()
}

export function phonesMatch(left: unknown, right: unknown): boolean {
  const a = normalizeDigits(left)
  const b = normalizeDigits(right)
  if (!a || !b) return false
  if (a === b) return true
  const minLen = Math.min(a.length, b.length, 11)
  if (minLen < 10) return false
  return a.slice(-minLen) === b.slice(-minLen)
}

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

function toPatientRecord(contact: Record<string, any>): HubSpotPatientRecord {
  const firstname = String(contact.firstname || contact.properties?.firstname || '').trim()
  const lastname = String(contact.lastname || contact.properties?.lastname || '').trim()
  const name =
    String(contact.name || '').trim() ||
    [firstname, lastname].filter(Boolean).join(' ').trim()

  const properties =
    contact.properties && typeof contact.properties === 'object'
      ? (contact.properties as Record<string, unknown>)
      : {}

  return {
    id: String(contact.id || '').trim(),
    firstname: firstname || undefined,
    lastname: lastname || undefined,
    name: name || undefined,
    email: String(contact.email || properties.email || '').trim() || undefined,
    phone: String(contact.phone || properties.phone || '').trim() || undefined,
    cpf: String(contact.cpf || properties.cpf || properties.documento || '').trim() || undefined,
    birthdate:
      String(contact.birthdate || properties.birthdate || properties.date_of_birth || '').trim() ||
      undefined,
    appointmentStatus: String(properties[HUBSPOT_SONIA_APPOINTMENT_STATUS_PROPERTY] || '').trim() || undefined,
    appointmentAt: String(properties[HUBSPOT_SONIA_APPOINTMENT_AT_PROPERTY] || '').trim() || undefined,
    calendlyEventId: String(properties[HUBSPOT_SONIA_CALENDLY_EVENT_PROPERTY] || '').trim() || undefined,
    appointmentSpecialty:
      String(properties[HUBSPOT_SONIA_APPOINTMENT_SPECIALTY_PROPERTY] || '').trim() || undefined,
    properties,
  }
}

function readAppointmentStatusFromRecord(record: HubSpotPatientRecord): string {
  return (
    record.appointmentStatus ||
    String(record.properties[HUBSPOT_SONIA_APPOINTMENT_STATUS_PROPERTY] || '').trim()
  )
}

export async function findHubSpotContactByIdentifiers(
  crmIntegrationId: string,
  identifiers: HubSpotPatientLookupIdentifiers
): Promise<HubSpotPatientRecord | null> {
  const normalizedEmail = normalizeEmail(identifiers.email)
  const normalizedPhone = normalizeDigits(identifiers.phone)
  const normalizedCpf = normalizeDigits(identifiers.cpf)
  const requestedProperties = [...HUBSPOT_SONIA_PATIENT_PROPERTIES]

  if (normalizedEmail) {
    const byEmail = await searchHubSpotContacts(
      crmIntegrationId,
      1,
      undefined,
      requestedProperties,
      [{ field: 'email', operator: 'equals', value: normalizedEmail }]
    )
    if (byEmail[0]) {
      return toPatientRecord(byEmail[0] as Record<string, any>)
    }
  }

  if (normalizedCpf) {
    const byCpf = await searchHubSpotContacts(
      crmIntegrationId,
      5,
      undefined,
      requestedProperties,
      [{ field: 'cpf', operator: 'equals', value: normalizedCpf }]
    )
    if (byCpf[0]) {
      return toPatientRecord(byCpf[0] as Record<string, any>)
    }
  }

  if (normalizedPhone) {
    const phoneTail = normalizedPhone.slice(-8)
    if (phoneTail.length >= 8) {
      const byPhoneSearch = await searchHubSpotContacts(
        crmIntegrationId,
        10,
        undefined,
        requestedProperties,
        [{ field: 'phone', operator: 'contains', value: phoneTail }]
      )
      const searchMatch = byPhoneSearch.find((contact: Record<string, any>) =>
        phonesMatch(contact.phone || contact.properties?.phone, normalizedPhone)
      )
      if (searchMatch) {
        return toPatientRecord(searchMatch as Record<string, any>)
      }
    }

    const candidates = await getHubSpotContacts(crmIntegrationId, 100, requestedProperties)
    const match = candidates.find((contact: Record<string, any>) =>
      phonesMatch(contact.phone || contact.properties?.phone, normalizedPhone)
    )
    if (match) {
      return toPatientRecord(match as Record<string, any>)
    }
  }

  return null
}

export type HubSpotScheduledPatientLookupResult =
  | { status: 'scheduled_found'; contact: HubSpotPatientRecord }
  | { status: 'not_scheduled'; contact: HubSpotPatientRecord }
  | { status: 'not_found' }
  | { status: 'incomplete' }

export async function findHubSpotScheduledPatient(
  crmIntegrationId: string,
  identifiers: HubSpotPatientLookupIdentifiers
): Promise<HubSpotScheduledPatientLookupResult> {
  const hasIdentifier =
    !!String(identifiers.email || '').trim() ||
    !!String(identifiers.phone || '').trim() ||
    !!String(identifiers.cpf || '').trim()

  if (!hasIdentifier) {
    return { status: 'incomplete' }
  }

  const contact = await findHubSpotContactByIdentifiers(crmIntegrationId, identifiers)
  if (!contact) {
    return { status: 'not_found' }
  }

  const appointmentStatus = readAppointmentStatusFromRecord(contact)
  if (!isScheduledAppointmentStatus(appointmentStatus)) {
    logger.info('[hubspot-patient] Contato encontrado sem consulta agendada no CRM', {
      contactId: contact.id,
      appointmentStatus: appointmentStatus || null,
    })
    return { status: 'not_scheduled', contact }
  }

  return { status: 'scheduled_found', contact }
}

export async function syncHubSpotAppointmentStatus(
  crmIntegrationId: string,
  contactId: string,
  input: {
    status: 'agendado' | 'cancelado' | 'sem_consulta'
    appointmentId?: string | null
    scheduledAt?: string | null
    specialty?: string | null
    patientEmail?: string | null
    patientPhone?: string | null
    patientName?: string | null
  }
): Promise<HubSpotPatientRecord | null> {
  const normalizedContactId = String(contactId || '').trim()
  if (!crmIntegrationId || !normalizedContactId) {
    return null
  }

  const statusValue =
    input.status === 'agendado'
      ? SONIA_APPOINTMENT_STATUS_SCHEDULED
      : input.status === 'cancelado'
        ? SONIA_APPOINTMENT_STATUS_CANCELLED
        : SONIA_APPOINTMENT_STATUS_NONE

  try {
    const updated = await updateHubSpotPatientContact(crmIntegrationId, normalizedContactId, {
      fullName: input.patientName || null,
      email: input.patientEmail || null,
      phone: input.patientPhone || null,
      extraProperties: {
        [HUBSPOT_SONIA_APPOINTMENT_STATUS_PROPERTY]: statusValue,
        ...(input.scheduledAt
          ? { [HUBSPOT_SONIA_APPOINTMENT_AT_PROPERTY]: String(input.scheduledAt).trim() }
          : {}),
        ...(input.appointmentId
          ? { [HUBSPOT_SONIA_CALENDLY_EVENT_PROPERTY]: String(input.appointmentId).trim() }
          : {}),
        ...(input.specialty
          ? { [HUBSPOT_SONIA_APPOINTMENT_SPECIALTY_PROPERTY]: String(input.specialty).trim() }
          : {}),
      },
    })
    logger.info('[hubspot-patient] Status de consulta sincronizado no HubSpot', {
      contactId: normalizedContactId,
      status: statusValue,
      hasAppointmentId: !!input.appointmentId,
    })
    return updated
  } catch (error: any) {
    logger.warn('[hubspot-patient] Falha ao sincronizar status de consulta (propriedades custom podem nao existir no portal)', {
      contactId: normalizedContactId,
      status: statusValue,
      error: error?.message || error,
    })
    return null
  }
}

export function applyHubSpotPatientToFlowContext(
  contextData: Record<string, any>,
  contact: HubSpotPatientRecord
): void {
  if (contact.id) contextData.patient_id = contact.id
  if (contact.name) contextData.patient_name = contact.name
  if (contact.email) contextData.patient_email = contact.email
  if (contact.phone) contextData.patient_phone = contact.phone
  if (contact.cpf) contextData.patient_cpf = contact.cpf
  if (contact.birthdate) contextData.patient_dob = contact.birthdate
  if (contact.calendlyEventId) contextData.appointment_id = contact.calendlyEventId
  if (contact.appointmentSpecialty) contextData.specialty = contact.appointmentSpecialty
  contextData.crm_appointment_status = normalizeSoniaAppointmentStatus(
    readAppointmentStatusFromRecord(contact)
  )
}

export async function createHubSpotPatientContact(
  crmIntegrationId: string,
  data: {
    fullName?: string | null
    email?: string | null
    phone?: string | null
    cpf?: string | null
    birthdate?: string | null
    originTag?: string | null
  }
): Promise<HubSpotPatientRecord> {
  const fullName = String(data.fullName || '').trim()
  const [firstname, ...rest] = fullName.split(/\s+/).filter(Boolean)
  const lastname = rest.join(' ').trim()

  const rawPayload: Record<string, string> = {
    ...(firstname ? { firstname } : {}),
    ...(lastname ? { lastname } : {}),
    ...(data.email ? { email: String(data.email).trim() } : {}),
    ...(data.phone ? { phone: String(data.phone).trim() } : {}),
    ...(data.cpf ? { cpf: normalizeDigits(data.cpf) } : {}),
    ...(data.birthdate ? { birthdate: String(data.birthdate).trim() } : {}),
    ...(data.originTag ? { lead_source: String(data.originTag).trim() } : {}),
  }

  try {
    const created = await createHubSpotContact(crmIntegrationId, rawPayload)
    return toPatientRecord(created as Record<string, any>)
  } catch (error: any) {
    logger.warn('[hubspot-patient] Falha ao criar contato com payload completo, tentando subset seguro', {
      error: error?.message || error,
    })
    const safePayload: Record<string, string> = {
      ...(firstname ? { firstname } : {}),
      ...(lastname ? { lastname } : {}),
      ...(data.email ? { email: String(data.email).trim() } : {}),
      ...(data.phone ? { phone: String(data.phone).trim() } : {}),
    }
    const created = await createHubSpotContact(crmIntegrationId, safePayload)
    return toPatientRecord(created as Record<string, any>)
  }
}

export async function updateHubSpotPatientContact(
  crmIntegrationId: string,
  contactId: string,
  data: {
    fullName?: string | null
    email?: string | null
    phone?: string | null
    cpf?: string | null
    birthdate?: string | null
    originTag?: string | null
    extraProperties?: Record<string, unknown>
  }
): Promise<HubSpotPatientRecord> {
  const fullName = String(data.fullName || '').trim()
  const [firstname, ...rest] = fullName.split(/\s+/).filter(Boolean)
  const lastname = rest.join(' ').trim()
  const payload: Record<string, string> = {
    ...(firstname ? { firstname } : {}),
    ...(lastname ? { lastname } : {}),
    ...(data.email ? { email: String(data.email).trim() } : {}),
    ...(data.phone ? { phone: String(data.phone).trim() } : {}),
    ...(data.cpf ? { cpf: normalizeDigits(data.cpf) } : {}),
    ...(data.birthdate ? { birthdate: String(data.birthdate).trim() } : {}),
  }

  Object.entries(data.extraProperties || {}).forEach(([key, value]) => {
    if (value == null || value === '') return
    payload[key] = String(value)
  })

  try {
    const updated = await updateHubSpotContact(crmIntegrationId, contactId, payload)
    return toPatientRecord(updated as Record<string, any>)
  } catch (error: any) {
    logger.warn('[hubspot-patient] Falha ao atualizar contato com payload completo, tentando subset seguro', {
      error: error?.message || error,
      contactId,
    })
    const safePayload: Record<string, string> = {
      ...(firstname ? { firstname } : {}),
      ...(lastname ? { lastname } : {}),
      ...(data.email ? { email: String(data.email).trim() } : {}),
      ...(data.phone ? { phone: String(data.phone).trim() } : {}),
    }
    const updated = await updateHubSpotContact(crmIntegrationId, contactId, safePayload)
    return toPatientRecord(updated as Record<string, any>)
  }
}

export async function recordHubSpotClinicalEvent(input: {
  crmIntegrationId: string
  patientId?: string | null
  eventType: string
  payload: Record<string, unknown>
}): Promise<{
  success: boolean
  status: 'synced' | 'skipped' | 'failed'
  message: string
}> {
  const contactId = String(input.patientId || '').trim()
  if (!input.crmIntegrationId || !contactId) {
    return {
      success: false,
      status: 'skipped',
      message: 'CRM ou paciente ausente para registrar evento.',
    }
  }

  const eventType = String(input.eventType || '').trim().toLowerCase()
  const appointmentId = String(input.payload.appointment_id || input.payload.appointmentId || '').trim()
  const scheduledAt = String(
    input.payload.scheduled_at || input.payload.startsAt || input.payload.appointment_at || ''
  ).trim()
  const specialty = String(input.payload.specialty || '').trim()
  const patientEmail = String(input.payload.patient_email || input.payload.email || '').trim()
  const patientPhone = String(input.payload.patient_phone || input.payload.phone || '').trim()
  const patientName = String(input.payload.patient_name || input.payload.name || '').trim()

  let crmStatus: 'agendado' | 'cancelado' | 'sem_consulta' = 'sem_consulta'
  if (eventType.includes('book') || eventType.includes('agend') || eventType.includes('confirm')) {
    crmStatus = 'agendado'
  } else if (eventType.includes('cancel')) {
    crmStatus = 'cancelado'
  } else {
    return {
      success: true,
      status: 'skipped',
      message: `Evento ${eventType} ignorado para tag de consulta.`,
    }
  }

  const updated = await syncHubSpotAppointmentStatus(input.crmIntegrationId, contactId, {
    status: crmStatus,
    appointmentId: appointmentId || null,
    scheduledAt: scheduledAt || null,
    specialty: specialty || null,
    patientEmail: patientEmail || null,
    patientPhone: patientPhone || null,
    patientName: patientName || null,
  })

  if (!updated) {
    return {
      success: false,
      status: 'failed',
      message:
        'Nao foi possivel atualizar a tag de consulta no HubSpot. Verifique se as propriedades sonia_status_agendamento existem no portal.',
    }
  }

  return {
    success: true,
    status: 'synced',
    message: `Status ${crmStatus} sincronizado no HubSpot.`,
  }
}

/** @deprecated Use recordHubSpotClinicalEvent */
export async function recordHubSpotClinicalEventPlaceholder(input: {
  crmIntegrationId: string
  patientId?: string | null
  eventType: string
  payload: Record<string, unknown>
}): Promise<{
  success: boolean
  status: 'mocked' | 'synced' | 'skipped' | 'failed'
  message: string
}> {
  const result = await recordHubSpotClinicalEvent(input)
  return {
    success: result.success,
    status: result.status === 'synced' ? 'synced' : result.status === 'failed' ? 'failed' : 'mocked',
    message: result.message,
  }
}

