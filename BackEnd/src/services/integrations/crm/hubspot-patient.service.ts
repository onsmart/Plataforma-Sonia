import logger from '../../../lib/logger'
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
  properties: Record<string, unknown>
}

function normalizeDigits(value: unknown): string {
  return String(value || '').replace(/\D/g, '').trim()
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

  return {
    id: String(contact.id || '').trim(),
    firstname: firstname || undefined,
    lastname: lastname || undefined,
    name: name || undefined,
    email: String(contact.email || contact.properties?.email || '').trim() || undefined,
    phone: String(contact.phone || contact.properties?.phone || '').trim() || undefined,
    cpf:
      String(contact.cpf || contact.properties?.cpf || contact.properties?.documento || '').trim() || undefined,
    birthdate:
      String(
        contact.birthdate ||
          contact.properties?.birthdate ||
          contact.properties?.date_of_birth ||
          ''
      ).trim() || undefined,
    properties:
      contact.properties && typeof contact.properties === 'object' ? contact.properties : {},
  }
}

export async function findHubSpotContactByIdentifiers(
  crmIntegrationId: string,
  identifiers: HubSpotPatientLookupIdentifiers
): Promise<HubSpotPatientRecord | null> {
  const normalizedEmail = normalizeEmail(identifiers.email)
  const normalizedPhone = normalizeDigits(identifiers.phone)
  const normalizedCpf = normalizeDigits(identifiers.cpf)
  const requestedProperties = [
    'firstname',
    'lastname',
    'email',
    'phone',
    'cpf',
    'birthdate',
    'date_of_birth',
    'documento',
  ]

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
    const candidates = await getHubSpotContacts(crmIntegrationId, 100, requestedProperties)
    const match = candidates.find((contact: Record<string, any>) => {
      const phone = normalizeDigits(contact.phone || contact.properties?.phone)
      return phone === normalizedPhone
    })
    if (match) {
      return toPatientRecord(match as Record<string, any>)
    }
  }

  return null
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

export async function recordHubSpotClinicalEventPlaceholder(input: {
  crmIntegrationId: string
  patientId?: string | null
  eventType: string
  payload: Record<string, unknown>
}): Promise<{
  success: boolean
  status: 'mocked'
  message: string
}> {
  logger.info('[hubspot-patient] Evento clínico registrado em modo placeholder', input)
  return {
    success: true,
    status: 'mocked',
    message: `Placeholder salvo para ${input.eventType}. Conecte note/ticket/deal real futuramente.`,
  }
}

