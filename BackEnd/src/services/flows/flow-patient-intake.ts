const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
const PHONE_PATTERN = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-\s]?\d{4}/

const SPECIALTY_LABELS: Record<string, string> = {
  clinica_geral: 'Clínica geral',
  cardiologia: 'Cardiologia',
}

const SPECIALTY_ALIASES: Record<string, string> = {
  clinica_geral: 'clinica_geral',
  'clinica geral': 'clinica_geral',
  geral: 'clinica_geral',
  cardiologia: 'cardiologia',
  cardio: 'cardiologia',
}

// Palavras-chave de especialidades não configuradas no Calendly deste ambiente.
// Usadas para detectar intenção e exibir mensagem explícita ao paciente.
const UNSUPPORTED_SPECIALTY_KEYWORDS = [
  'dermatologia', 'dermato',
  'ginecologia', 'gineco',
  'ortopedia', 'ortopedista',
  'pediatria', 'pediatrico', 'pediatria',
  'endocrinologia', 'endocrino',
  'psiquiatria', 'psiquiatra',
  'psicologia', 'psicologo',
  'nutricao', 'nutricionista',
]

const INTAKE_RESUME_REDIRECT_WHEN_PROFILE_COMPLETE = new Set([
  'sf-intake-collect-data',
])

const INTAKE_RESUME_REDIRECT_WHEN_PROFILE_INCOMPLETE = new Set(['sf-intake-triage'])

const SPECIALTY_MENU_MESSAGE = `Qual especialidade médica você deseja?

1. Clínica geral
2. Cardiologia

Responda com o número ou o nome da especialidade.`

const MAIN_MENU_INTENT_BY_NUMBER: Record<string, string> = {
  '1': 'agendar',
  '2': 'especialidades',
  '3': 'documentos',
  '4': 'humano',
  '5': 'cancelar',
}

const CLINIC_MAIN_MENU_MESSAGE = `Olá! Bem-vindo à nossa clínica. Como posso ajudar você hoje?

1. Agendar consulta
2. Conhecer especialidades
3. Enviar documentos ou exames
4. Falar com atendente humano
5. Cancelar consulta

Responda com o número da opção ou descreva em uma frase o que precisa.`

const CLINIC_SPECIALTIES_INFO_MESSAGE = `Estas são as especialidades que atendemos por aqui:

1. Clínica geral — avaliação inicial, check-up e sintomas gerais
2. Cardiologia — coração, pressão arterial e acompanhamento cardíaco

O agendamento automático por WhatsApp está disponível para Clínica geral e Cardiologia.

Para marcar consulta, responda *quero agendar* ou digite *1*.`

const SPECIALTY_UNSUPPORTED_MESSAGE = `No momento, o agendamento automático está disponível apenas para:

1. Clínica geral
2. Cardiologia

Escolha uma das opções acima (responda com o número ou o nome da especialidade).`

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

function firstNameFrom(data: Record<string, unknown>): string {
  const name = String(data.patient_name || '').trim()
  return name.split(/\s+/)[0] || 'tudo bem'
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function consumeRecentRegistrationMessage(data: Record<string, unknown>): string {
  const recent = String(data.__intake_recent_registration_message || '').trim()
  delete data.__intake_recent_registration_message
  delete data.__intake_profile_just_completed
  return recent
}

export function mentionedUnsupportedSpecialty(message: string): boolean {
  const normalized = String(message || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (!normalized) return false
  for (const kw of UNSUPPORTED_SPECIALTY_KEYWORDS) {
    const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const pattern = new RegExp(`(^|\\b)${escapeRegex(kwNorm)}(\\b|$)`)
    if (pattern.test(normalized)) return true
  }
  return false
}

function normalizeIntentText(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function looksLikeSchedulingRequestMessage(
  message: string,
  data: Record<string, unknown> = {}
): boolean {
  const text = String(message || '').trim()
  if (!text) return false

  const normalized = normalizeIntentText(text)
  const hasAgendarWord = /\bagendar\b/.test(normalized) || /\bmarcar\s+consulta\b/.test(normalized)
  const hasDate = /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(text)
  const specialty = extractSpecialtyFromMessage(text)
  const profileHints = extractPatientProfileFromMessage(text)
  const mergedProfile = {
    ...data,
    ...profileHints,
    ...(specialty ? { specialty } : {}),
  }

  if (hasAgendarWord && (specialty || hasMinimalPatientProfile(mergedProfile))) {
    return true
  }

  return Boolean(specialty && hasMinimalPatientProfile(mergedProfile) && (hasDate || hasAgendarWord))
}

const FLOW_CLOSING_MESSAGE_PATTERNS: RegExp[] = [
  /^\s*obrigad[oa]s?\s*[!?.…]*\s*$/i,
  /^\s*(valeu|agradecid[oa]|grat[ao])\s*[!?.…]*\s*$/i,
  /^\s*(thanks?|thank\s+you)\s*[!?.…]*\s*$/i,
  /^\s*(ate\s+mais|ate\s+logo|tchau|flw|falou)\s*[!?.…]*\s*$/i,
  /^\s*(perfeito|otimo|ótimo|show|beleza)\s*[!?.…]*\s*$/i,
]

export function isFlowConversationClosingMessage(message: unknown): boolean {
  const text = String(message ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (!text || text.length > 80) return false
  return FLOW_CLOSING_MESSAGE_PATTERNS.some((pattern) => pattern.test(text))
}

export function resolvePostFlowAcknowledgementReply(data: Record<string, unknown>): string {
  const firstName = String(data.patient_name || '')
    .trim()
    .split(/\s+/)[0]
  const greeting = firstName ? `${firstName}, ` : ''
  return (
    `${greeting}por nada! Fico feliz em ajudar.\n\n` +
    'Se precisar de algo, é só chamar. Para um novo atendimento, envie *oi* ou *menu*.'
  )
}

export function inferIntentFromUserMessage(data: Record<string, unknown>): string {
  const existing = String(data.intent || '').trim()
  if (existing) return existing

  const message = String(data.userMessage || data.message || data.originalMessage || '').trim()
  const normalized = normalizeIntentText(message)
  if (!normalized) return ''

  const numericOnly = normalized.match(/^\s*(\d)\s*$/)
  if (numericOnly) {
    return MAIN_MENU_INTENT_BY_NUMBER[numericOnly[1]] || ''
  }

  if (looksLikeSchedulingRequestMessage(message, data)) {
    return 'agendar'
  }

  const intentPatterns: Array<[RegExp, string]> = [
    [/\b(quero|gostaria|preciso|desejo)\s+(de\s+)?agendar\b/, 'agendar'],
    [/\bagendar\s+(uma\s+)?consulta\b/, 'agendar'],
    [/\bmarcar\s+(uma\s+)?consulta\b/, 'agendar'],
    [/\bespecialidades?\b/, 'especialidades'],
    [/\binformacoes?\s+sobre\s+tratamentos?\b/, 'especialidades'],
    [/\btratamentos?\b/, 'especialidades'],
    [/\bremarcar\b/, 'remarcar'],
    [/\bcancel(ar|amento)\b/, 'cancelar'],
    [/\bretorno\b/, 'retorno'],
    [/\b(documentos?|exames?)\b/, 'documentos'],
    [/\b(atendente|humano|falar\s+com)\b/, 'humano'],
  ]

  for (const [pattern, intent] of intentPatterns) {
    if (pattern.test(normalized)) {
      return intent
    }
  }

  return ''
}

export function extractSpecialtyFromMessage(message: string, allowNumberedMenu = false): string {
  const raw = String(message || '').trim()
  const withoutLeadingOption = raw.replace(/^\s*\d{1,2}\s*[-.)]?\s*/, '').trim()
  const normalized = normalizeIntentText(withoutLeadingOption || raw)

  if (!normalized) return ''

  for (const [alias, specialty] of Object.entries(SPECIALTY_ALIASES)) {
    const aliasNorm = alias.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const aliasPattern = new RegExp(`(^|\\b)${escapeRegex(aliasNorm)}(\\b|$)`)
    if (normalized === aliasNorm || aliasPattern.test(normalized)) {
      return specialty
    }
  }

  // Numbered menu only applies when explicitly in triage context.
  // Calling with allowNumberedMenu=false (default) prevents "1" from being
  // misinterpreted as clinica_geral when the patient is selecting from the
  // main flow menu (e.g. "1. Agendar uma consulta").
  if (allowNumberedMenu) {
    const numbered = normalized.match(/^\s*(\d{1,2})\s*$/)
    if (numbered) {
      const menuMap: Record<string, string> = {
        '1': 'clinica_geral',
        '2': 'cardiologia',
      }
      return menuMap[numbered[1]] || ''
    }
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
      if (extractSpecialtyFromMessage(line)) continue
      if (/\bagendar\b/i.test(line)) continue

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

  if (/^(nao|não)\b/.test(normalized)) return false
  if (/\b(nao|não)\s+(esta|está|ta)\b/.test(normalized)) return false
  if (/\b(incorreto|errado|mudar|alterar)\b/.test(normalized) && !/\b(sim|certo|correto)\b/.test(normalized)) {
    return false
  }

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
    /\besta\s+correto\b/,
    /\best[aá]\s+correto\b/,
    /\bcorreto\s+sim\b/,
    /\bcerto\s+sim\b/,
    /\besta\s+certo\s+sim\b/,
    /\best[aá]\s+certo\s+sim\b/,
  ]

  return affirmativePatterns.some((pattern) => pattern.test(normalized))
}

export function hasMinimalPatientProfile(data: Record<string, unknown>): boolean {
  return getMissingRegistrationFields(data).length === 0
}

export function hasSpecialtyDefined(data: Record<string, unknown>): boolean {
  const specialty = String(data.specialty || '').trim().toLowerCase()
  return Boolean(specialty && specialty !== 'indefinido' && specialty !== 'unknown')
}

export function applyIntakeStructuredFieldsToContext(data: Record<string, unknown>): void {
  applyPatientHintsFromUserMessage(data)

  if (hasMinimalPatientProfile(data)) {
    data.patient_lookup_status = data.patient_lookup_status || 'new'
    data.data_quality = 'complete'
    delete data.missing_fields
    delete data.required_missing_fields
  } else {
    data.patient_lookup_status = 'incomplete'
    data.data_quality = 'partial'
    data.missing_fields = getMissingRegistrationFields(data)
  }
}

/** Cadastro: sempre resposta fixa (nunca LLM). */
export function resolveClinicInitialMenuMessage(_data: Record<string, unknown>): string {
  return CLINIC_MAIN_MENU_MESSAGE
}

export function resolveClinicSpecialtiesInfoMessage(_data: Record<string, unknown>): string {
  return CLINIC_SPECIALTIES_INFO_MESSAGE
}

export function resolveIntakeCollectDeterministicMessage(data: Record<string, unknown>): string {
  applyIntakeStructuredFieldsToContext(data)

  const missing = getMissingRegistrationFields(data)
  const userMessage = String(data.userMessage || data.message || data.originalMessage || '').trim()
  const confirmed = Boolean(data.registration_confirmed) || isAffirmativeConfirmation(userMessage)

  if (hasMinimalPatientProfile(data)) {
    data.registration_confirmed = true
    const confirmationMessage = `Perfeito, ${firstNameFrom(data)}! Cadastro recebido.`
    data.__intake_profile_just_completed = true
    data.__intake_recent_registration_message = confirmationMessage
    return confirmationMessage
  }

  if (confirmed) {
    if (missing.includes('patient_email')) {
      return `Ótimo, ${firstNameFrom(data)}! Para concluir, envie somente seu e-mail de contato (ex.: nome@email.com).`
    }
    if (missing.includes('patient_name')) {
      return 'Para continuar, envie seu nome completo.'
    }
    if (missing.includes('patient_phone')) {
      return 'Para continuar, confirme seu telefone com DDD (ou diga que é o mesmo deste WhatsApp).'
    }
  }

  if (missing.includes('patient_email') && !missing.includes('patient_name')) {
    return `Obrigado, ${firstNameFrom(data)}! Agora envie seu e-mail de contato para concluir o cadastro.`
  }

  if (missing.includes('patient_name') && missing.includes('patient_email')) {
    return (
      'Para agendar sua consulta, envie em uma mensagem:\n\n' +
      '• Nome completo\n' +
      '• E-mail\n' +
      '• Telefone com DDD (se for o mesmo deste WhatsApp, escreva "mesmo número")\n\n' +
      'Não precisa de endereço nem data de nascimento.'
    )
  }

  return (
    'Para completar o cadastro, preciso de:\n\n' +
    '• Nome completo\n' +
    '• E-mail\n' +
    '• Telefone com DDD\n\n' +
    'Envie tudo em uma mensagem, por favor.'
  )
}

/** Triagem: menu de especialidade sem LLM quando cadastro já está completo. */
export function resolveIntakeTriageDeterministicMessage(data: Record<string, unknown>): string | null {
  if (!hasMinimalPatientProfile(data)) return null

  const userMessage = String(data.userMessage || data.message || data.originalMessage || '').trim()
  // Numbered menu ("1" → clinica_geral, "2" → cardiologia) só é interpretado quando o fluxo
  // pausou especificamente aguardando a seleção de especialidade (__triage_awaiting_specialty=true).
  // Sem a flag, "1" de qualquer menu anterior (ex.: "1. Agendar consulta") não seria confundido
  // com uma escolha de especialidade.
  const awaitingSpecialty = Boolean(data.__triage_awaiting_specialty)
  const specialtyHint = extractSpecialtyFromMessage(userMessage, awaitingSpecialty)
  const registrationMessage = consumeRecentRegistrationMessage(data)

  if (specialtyHint) {
    delete data.__triage_awaiting_specialty
    data.specialty = specialtyHint
    data.specialty_confirmed = true
    data.specialty_confidence = 'high'
    const label = SPECIALTY_LABELS[specialtyHint] || specialtyHint
    return `Perfeito! Vamos seguir com ${label}. Em instantes verifico os horários disponíveis.`
  }

  if (hasSpecialtyDefined(data) && data.specialty_confirmed) {
    delete data.__triage_awaiting_specialty
    const key = String(data.specialty || '').trim().toLowerCase()
    const label = SPECIALTY_LABELS[key] || key
    return `Certo! Seguimos com ${label} para buscar horários.`
  }

  // Paciente mencionou especialidade não disponível neste ambiente: exibe mensagem clara.
  if (mentionedUnsupportedSpecialty(userMessage)) {
    return registrationMessage
      ? `${registrationMessage}\n\n${SPECIALTY_UNSUPPORTED_MESSAGE}`
      : SPECIALTY_UNSUPPORTED_MESSAGE
  }

  if (isAffirmativeConfirmation(userMessage)) {
    return registrationMessage ? `${registrationMessage}\n\n${SPECIALTY_MENU_MESSAGE}` : SPECIALTY_MENU_MESSAGE
  }

  return registrationMessage ? `${registrationMessage}\n\n${SPECIALTY_MENU_MESSAGE}` : SPECIALTY_MENU_MESSAGE
}

export function resolveIntakeResumeNodeId(
  resumeNodeId: string,
  data: Record<string, unknown>
): string {
  const current = String(resumeNodeId || '').trim()
  if (!current) return current

  applyPatientHintsFromUserMessage(data)

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
  const inferredIntent = inferIntentFromUserMessage(data)
  if (inferredIntent && !String(data.intent || '').trim()) {
    data.intent = inferredIntent
  }

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

  const normalized = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (/mesmo\s+(numero|telefone|whatsapp)/.test(normalized) && phone) {
    data.patient_phone = normalizePhoneDigits(phone)
  }

  if (specialtyHint && !hasSpecialtyDefined(data)) {
    data.specialty = specialtyHint
    data.specialty_confirmed = true
    data.specialty_confidence = 'high'
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
    data.data_quality = 'complete'
    delete data.missing_fields
    delete data.required_missing_fields
  }

  const intent = String(data.intent || '').trim()
  if (
    intent === 'agendar' ||
    intent === 'remarcar' ||
    looksLikeSchedulingRequestMessage(message, data)
  ) {
    if (!String(data.urgency_status || '').trim() || String(data.urgency_status) === 'unknown') {
      data.urgency_status = 'non_urgent'
    }
  }
}

export function shouldFastTrackToMainIntent(data: Record<string, unknown>): boolean {
  const intent = inferIntentFromUserMessage(data)
  return intent === 'agendar' || intent === 'remarcar' || intent === 'cancelar'
}

export function resolvePausedFlowOutboundFallback(data: Record<string, unknown>): string | null {
  if (!data.__flow_paused_for_user_reply) return null

  const reason = String(data.__flow_pause_reason || '').trim()
  if (reason === 'missing_appointment_slot') return null

  const intent = String(data.intent || inferIntentFromUserMessage(data) || '').trim()
  if (intent === 'agendar') {
    if (!hasMinimalPatientProfile(data)) {
      return resolveIntakeCollectDeterministicMessage(data)
    }
    if (!hasSpecialtyDefined(data)) {
      return resolveIntakeTriageDeterministicMessage(data)
    }
    return 'Perfeito! Recebi seus dados. Vou seguir com o agendamento agora.'
  }

  if (reason.includes('urgency_status')) {
    return 'Recebemos sua mensagem. Nossa equipe foi acionada e retorna em breve.'
  }

  if (reason === 'appointment_book_failed') {
    return (
      'Não consegui confirmar o horário no sistema de agenda neste momento.\n\n' +
      'Nossa equipe foi avisada e pode ajudar. Se preferir, responda com outro número de horário da lista.'
    )
  }

  return 'Recebemos sua mensagem. Pode aguardar um instante?'
}
