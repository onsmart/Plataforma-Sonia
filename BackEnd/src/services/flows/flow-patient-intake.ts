const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
const PHONE_PATTERN = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-\s]?\d{4}/

const SPECIALTY_ALIASES: Record<string, string> = {
  clinica_geral: 'clinica_geral',
  'clinica geral': 'clinica_geral',
  geral: 'clinica_geral',
  cardiologia: 'cardiologia',
  cardio: 'cardiologia',
  dermatologia: 'dermatologia',
  dermato: 'dermatologia',
  ginecologia: 'ginecologia',
  gineco: 'ginecologia',
  ortopedia: 'ortopedia',
  ortopedista: 'ortopedia',
  pediatria: 'pediatria',
  pediatrico: 'pediatria',
  endocrinologia: 'endocrinologia',
  endocrino: 'endocrinologia',
  psiquiatria: 'psiquiatria',
  psiquiatra: 'psiquiatria',
  psicologia: 'psicologia',
  psicologo: 'psicologia',
  nutricao: 'nutricao',
  nutricionista: 'nutricao',
  outra: 'outra',
}

const INTAKE_RESUME_REDIRECT_WHEN_PROFILE_COMPLETE = new Set([
  'sf-intake-triage',
  'sf-intake-collect-data',
  'sf-intake-urgency',
])

const INTAKE_RESUME_REDIRECT_WHEN_PROFILE_INCOMPLETE = new Set(['sf-intake-triage'])

function normalizePhoneDigits(value: string): string {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 13) return ''
  return digits
}

function looksLikeDateLine(line: string): boolean {
  return /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(line.trim())
}

function looksLikePhoneLine(line: string): boolean {
  const digits = line.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 13
}

function pickNameLine(line: string): string {
  const cleaned = line.replace(EMAIL_PATTERN, '').replace(/\s+/g, ' ').trim()
  if (cleaned.length < 3) return ''
  if (cleaned.includes('@')) return ''
  if (looksLikePhoneLine(cleaned)) return ''
  if (looksLikeDateLine(cleaned)) return ''
  if (/^\d+$/.test(cleaned)) return ''
  return cleaned
}

export function extractSpecialtyFromMessage(message: string): string {
  const normalized = String(message || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (!normalized) return ''

  for (const [alias, specialty] of Object.entries(SPECIALTY_ALIASES)) {
    const aliasNorm = alias.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (normalized === aliasNorm || normalized.includes(aliasNorm)) {
      return specialty
    }
  }

  const numbered = normalized.match(/^\s*(\d{1,2})\s*$/)
  if (numbered) {
    const menuMap: Record<string, string> = {
      '1': 'clinica_geral',
      '2': 'cardiologia',
      '3': 'dermatologia',
      '4': 'ginecologia',
      '5': 'ortopedia',
      '6': 'pediatria',
      '7': 'endocrinologia',
      '8': 'psiquiatria',
      '9': 'psicologia',
      '10': 'nutricao',
    }
    return menuMap[numbered[1]] || ''
  }

  return ''
}

export function extractPatientProfileFromMessage(message: string): {
  patient_name?: string
  patient_email?: string
  patient_phone?: string
} {
  const text = String(message || '').trim()
  if (!text) return {}

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length >= 2) {
    let patient_email = ''
    let patient_phone = ''
    let patient_name = ''

    for (const line of lines) {
      const emailMatch = line.match(EMAIL_PATTERN)
      if (emailMatch && !patient_email) {
        patient_email = emailMatch[0].trim().toLowerCase()
        continue
      }
      if (looksLikePhoneLine(line) && !patient_phone) {
        patient_phone = normalizePhoneDigits(line)
        continue
      }
      if (looksLikeDateLine(line)) continue
      const nameCandidate = pickNameLine(line)
      if (nameCandidate && !patient_name) {
        patient_name = nameCandidate
      }
    }

    if (!patient_name && lines[0]) {
      const fallbackName = pickNameLine(lines[0])
      if (fallbackName) patient_name = fallbackName
    }

    return {
      ...(patient_name ? { patient_name } : {}),
      ...(patient_email ? { patient_email } : {}),
      ...(patient_phone ? { patient_phone } : {}),
    }
  }

  const emailMatch = text.match(EMAIL_PATTERN)
  const patient_email = emailMatch?.[0]?.trim().toLowerCase() || ''
  let namePart = text
  if (patient_email) {
    namePart = text.replace(patient_email, ' ').replace(/\s+/g, ' ').trim()
  }

  const phoneMatch = text.match(PHONE_PATTERN)
  const patient_phone = phoneMatch ? normalizePhoneDigits(phoneMatch[0]) : ''

  if (patient_phone) {
    namePart = namePart.replace(phoneMatch?.[0] || '', ' ').replace(/\s+/g, ' ').trim()
  }

  if (/^\d+$/.test(namePart)) {
    return {
      ...(patient_email ? { patient_email } : {}),
      ...(patient_phone ? { patient_phone } : {}),
    }
  }

  const patient_name = pickNameLine(namePart)
  return {
    ...(patient_name ? { patient_name } : {}),
    ...(patient_email ? { patient_email } : {}),
    ...(patient_phone ? { patient_phone } : {}),
  }
}

export function getMissingRegistrationFields(data: Record<string, unknown>): string[] {
  const missing: string[] = []
  const name = String(data.patient_name || data.lead_name || '').trim()
  const email = String(data.patient_email || data.lead_email || '').trim()
  const phone = String(data.patient_phone || data.phone_number || data.from || '').trim()
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const phoneOk = phone.replace(/\D/g, '').length >= 10

  if (name.length < 2) missing.push('patient_name')
  if (!emailOk) missing.push('patient_email')
  if (!phoneOk) missing.push('patient_phone')

  return missing
}

export function isAffirmativeConfirmation(message: string): boolean {
  const normalized = String(message || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (!normalized || normalized.length > 120) return false
  if (EMAIL_PATTERN.test(normalized)) return false
  if (extractSpecialtyFromMessage(normalized)) return false

  const affirmativePatterns = [
    /^sim\b/,
    /^ok\b/,
    /^certo\b/,
    /^correto\b/,
    /^confirmo\b/,
    /^isso\b/,
    /^exato\b/,
    /^perfeito\b/,
    /^pode ser\b/,
    /^tudo certo\b/,
    /^esta certo\b/,
    /^est[aá] certo\b/,
    /^esta tudo certo\b/,
    /^est[aá] tudo certo\b/,
    /^tudo bem\b/,
    /^sem alterac/,
    /^nada a alterar\b/,
    /^nao precisa alterar\b/,
    /^pode seguir\b/,
  ]

  return affirmativePatterns.some((pattern) => pattern.test(normalized))
}

export function hasMinimalPatientProfile(data: Record<string, unknown>): boolean {
  const name = String(data.patient_name || data.lead_name || '').trim()
  const email = String(data.patient_email || data.lead_email || '').trim()
  const phone = String(data.patient_phone || data.phone_number || data.from || '').trim()
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const phoneOk = phone.replace(/\D/g, '').length >= 10
  return Boolean(name && emailOk && phoneOk)
}

export function hasSpecialtyDefined(data: Record<string, unknown>): boolean {
  const specialty = String(data.specialty || '').trim().toLowerCase()
  return Boolean(specialty && specialty !== 'indefinido' && specialty !== 'unknown')
}

export function resolveIntakeResumeNodeId(
  resumeNodeId: string,
  data: Record<string, unknown>
): string {
  const current = String(resumeNodeId || '').trim()
  if (!current) return current

  if (hasMinimalPatientProfile(data) && INTAKE_RESUME_REDIRECT_WHEN_PROFILE_COMPLETE.has(current)) {
    return 'sf-intake-crm-upsert'
  }

  if (!hasMinimalPatientProfile(data) && INTAKE_RESUME_REDIRECT_WHEN_PROFILE_INCOMPLETE.has(current)) {
    return 'sf-intake-collect-data'
  }

  if (hasMinimalPatientProfile(data) && current === 'sf-intake-collect-data') {
    return 'sf-intake-crm-upsert'
  }

  return current
}

export function applyPatientHintsFromUserMessage(data: Record<string, unknown>): void {
  const message = String(data.userMessage || data.message || data.originalMessage || '').trim()
  const hints = extractPatientProfileFromMessage(message)
  const specialtyHint = extractSpecialtyFromMessage(message)

  if (hints.patient_email && !String(data.patient_email || '').trim()) {
    data.patient_email = hints.patient_email
  }
  if (hints.patient_name && !String(data.patient_name || '').trim()) {
    data.patient_name = hints.patient_name
  }
  if (hints.patient_phone && !String(data.patient_phone || '').trim()) {
    data.patient_phone = hints.patient_phone
  }

  const phone = String(data.phone_number || data.from || '').trim()
  if (phone && !String(data.patient_phone || '').trim()) {
    data.patient_phone = phone
  }

  if (specialtyHint && !hasSpecialtyDefined(data)) {
    data.specialty = specialtyHint
  }

  if (isAffirmativeConfirmation(message)) {
    data.registration_confirmed = true
    const missing = getMissingRegistrationFields(data)
    if (missing.length > 0) {
      data.missing_fields = missing
    }
  }

  if (hasMinimalPatientProfile(data)) {
    if (!String(data.patient_lookup_status || '').trim()) {
      data.patient_lookup_status = 'new'
    }
    delete data.missing_fields
    delete data.required_missing_fields
  }
}
