const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

export function extractPatientProfileFromMessage(message: string): {
  patient_name?: string
  patient_email?: string
} {
  const text = String(message || '').trim()
  if (!text) return {}

  const emailMatch = text.match(EMAIL_PATTERN)
  const patient_email = emailMatch?.[0]?.trim().toLowerCase() || ''
  let namePart = text
  if (patient_email) {
    namePart = text.replace(patient_email, ' ').replace(/\s+/g, ' ').trim()
  }

  if (/^\d+$/.test(namePart)) {
    return patient_email ? { patient_email } : {}
  }

  const patient_name = namePart.length >= 3 && !namePart.includes('@') ? namePart : ''
  return {
    ...(patient_name ? { patient_name } : {}),
    ...(patient_email ? { patient_email } : {}),
  }
}

export function hasMinimalPatientProfile(data: Record<string, unknown>): boolean {
  const name = String(data.patient_name || data.lead_name || '').trim()
  const email = String(data.patient_email || data.lead_email || '').trim()
  const phone = String(data.patient_phone || data.phone_number || data.from || '').trim()
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const phoneOk = phone.replace(/\D/g, '').length >= 10
  return Boolean(name && emailOk && phoneOk)
}

export function applyPatientHintsFromUserMessage(data: Record<string, unknown>): void {
  const message = String(data.userMessage || data.message || data.originalMessage || '').trim()
  const hints = extractPatientProfileFromMessage(message)

  if (hints.patient_email && !String(data.patient_email || '').trim()) {
    data.patient_email = hints.patient_email
  }
  if (hints.patient_name && !String(data.patient_name || '').trim()) {
    data.patient_name = hints.patient_name
  }

  const phone = String(data.phone_number || data.from || '').trim()
  if (phone && !String(data.patient_phone || '').trim()) {
    data.patient_phone = phone
  }

  if (hasMinimalPatientProfile(data)) {
    if (!String(data.patient_lookup_status || '').trim()) {
      data.patient_lookup_status = 'new'
    }
    delete data.missing_fields
    delete data.required_missing_fields
  }
}
