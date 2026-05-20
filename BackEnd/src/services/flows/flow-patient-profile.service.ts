import logger from '../../lib/logger'
import {
  applyHubSpotPatientToFlowContext,
  findHubSpotContactByIdentifiers,
  findHubSpotScheduledPatient,
} from '../integrations/crm/hubspot-patient.service'
import {
  findActiveHubSpotIntegrationIdForCompany,
  resolveCRMIntegrationIdForFlow,
} from '../integrations/crm/crm-integration.repository'
import {
  applyPatientHintsFromUserMessage,
  extractPatientProfileFromMessage,
  normalizePhoneDigits,
} from './flow-patient-intake'

export type PatientAppointmentBookmark = {
  patient_name?: string
  patient_email?: string
  patient_phone?: string
  patient_cpf?: string
  appointment_id?: string
  specialty?: string
  appointment_status?: string
}

const BOOKMARK_KEYS: Array<keyof PatientAppointmentBookmark> = [
  'patient_name',
  'patient_email',
  'patient_phone',
  'patient_cpf',
  'appointment_id',
  'specialty',
  'appointment_status',
]

export function extractPatientAppointmentBookmark(
  data: Record<string, unknown>
): PatientAppointmentBookmark {
  const bookmark: PatientAppointmentBookmark = {}
  for (const key of BOOKMARK_KEYS) {
    const value = String(data[key] || '').trim()
    if (value) {
      bookmark[key] = value
    }
  }
  return bookmark
}

export function mergePatientAppointmentBookmark(
  target: Record<string, unknown>,
  bookmark: PatientAppointmentBookmark | null | undefined
): void {
  if (!bookmark) return
  for (const key of BOOKMARK_KEYS) {
    const incoming = String(bookmark[key] || '').trim()
    if (!incoming) continue
    if (!String(target[key] || '').trim()) {
      target[key] = incoming
    }
  }
}

export function readWhatsAppPhoneFromContext(data: Record<string, unknown>): string {
  const fromJid = String(data.from || '')
    .trim()
    .replace(/@.*/g, '')
  const raw = String(data.patient_phone || data.phone_number || fromJid || '').trim()
  return raw ? normalizePhoneDigits(raw) : ''
}

export async function resolveCrmIntegrationIdForPatientLookup(
  contextData: Record<string, unknown>,
  explicitId?: string | null
): Promise<string> {
  const configured = String(
    explicitId || contextData.crm_integration_id || contextData.crmIntegrationId || ''
  ).trim()
  const companyId = String(contextData.companies_id || contextData.companiesId || '').trim()

  return resolveCRMIntegrationIdForFlow(configured, companyId || null)
}

export async function prefetchPatientProfileForAppointmentActions(
  contextData: Record<string, any>
): Promise<void> {
  const phone = readWhatsAppPhoneFromContext(contextData)
  if (phone) {
    contextData.patient_phone = phone
    contextData.phone_number = contextData.phone_number || phone
  }

  const intent = String(contextData.intent || '').trim()
  const crmIntegrationId = await resolveCrmIntegrationIdForPatientLookup(contextData)

  if (intent === 'cancelar' && crmIntegrationId) {
    const scheduled = await findHubSpotScheduledPatient(crmIntegrationId, {
      phone: readWhatsAppPhoneFromContext(contextData),
      email: String(contextData.patient_email || '').trim(),
      cpf: String(contextData.patient_cpf || '').trim(),
    })
    contextData.crm_scheduled_lookup_status = scheduled.status
    if (scheduled.status === 'scheduled_found' || scheduled.status === 'not_scheduled') {
      applyHubSpotPatientToFlowContext(contextData, scheduled.contact)
    }
  }

  await hydratePatientProfileForAppointmentLookup(contextData, {
    crmIntegrationId,
    companyId: String(contextData.companies_id || contextData.companiesId || '').trim() || null,
    lookupCrm: intent !== 'cancelar',
  })
}

export async function hydratePatientProfileForAppointmentLookup(
  contextData: Record<string, any>,
  options?: {
    crmIntegrationId?: string | null
    companyId?: string | null
    lookupCrm?: boolean
  }
): Promise<void> {
  applyPatientHintsFromUserMessage(contextData)

  const phone = readWhatsAppPhoneFromContext(contextData)
  if (phone) {
    contextData.patient_phone = phone
  }

  const message = String(
    contextData.userMessage || contextData.message || contextData.originalMessage || ''
  ).trim()
  const hints = extractPatientProfileFromMessage(message)
  if (hints.patient_email && !String(contextData.patient_email || '').trim()) {
    contextData.patient_email = hints.patient_email
  }
  if (hints.patient_name && !String(contextData.patient_name || '').trim()) {
    contextData.patient_name = hints.patient_name
  }
  if (hints.patient_phone && !String(contextData.patient_phone || '').trim()) {
    contextData.patient_phone = hints.patient_phone
  }

  const shouldLookupCrm = options?.lookupCrm !== false
  if (!shouldLookupCrm) return

  const companyId =
    String(options?.companyId || contextData.companies_id || contextData.companiesId || '').trim() ||
    null

  let crmIntegrationId = await resolveCRMIntegrationIdForFlow(
    String(
      options?.crmIntegrationId ||
        contextData.crm_integration_id ||
        contextData.crmIntegrationId ||
        ''
    ).trim(),
    companyId
  )
  if (!crmIntegrationId && companyId) {
    crmIntegrationId = (await findActiveHubSpotIntegrationIdForCompany(companyId)) || ''
  }
  if (!crmIntegrationId) return

  contextData.crm_integration_id = crmIntegrationId

  const lookupPhone = readWhatsAppPhoneFromContext(contextData)
  const lookupEmail = String(contextData.patient_email || '').trim()
  const lookupCpf = String(contextData.patient_cpf || '').trim()
  if (!lookupPhone && !lookupEmail && !lookupCpf) return

  try {
    const existing = await findHubSpotContactByIdentifiers(crmIntegrationId, {
      phone: lookupPhone || null,
      email: lookupEmail || null,
      cpf: lookupCpf || null,
    })
    if (!existing) return

    if (existing.email && !String(contextData.patient_email || '').trim()) {
      contextData.patient_email = existing.email
    }
    if (existing.name && !String(contextData.patient_name || '').trim()) {
      contextData.patient_name = existing.name
    }
    if (existing.phone && !String(contextData.patient_phone || '').trim()) {
      contextData.patient_phone = normalizePhoneDigits(existing.phone)
    }
    if (existing.cpf && !String(contextData.patient_cpf || '').trim()) {
      contextData.patient_cpf = existing.cpf
    }
    contextData.patient_lookup_status = 'existing'
    contextData.patient_id = existing.id

    logger.info('[flow-patient-profile] Perfil do paciente hidratado via CRM', {
      hasEmail: !!String(contextData.patient_email || '').trim(),
      hasPhone: !!String(contextData.patient_phone || '').trim(),
    })
  } catch (error: any) {
    logger.warn('[flow-patient-profile] Falha ao hidratar paciente no CRM', {
      error: error?.message || error,
    })
  }
}
