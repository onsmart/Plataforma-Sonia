import logger from '../../lib/logger'

/** Enderecos de demonstracao que nao devem receber e-mail real (evita bounce no remetente). */
const BLOCKED_NOTIFY_EMAILS = new Set(
  ['recepcao@clinica.com.br', 'contato@clinica.com.br', 'noreply@clinica.com.br'].map((v) =>
    v.toLowerCase()
  )
)

const BLOCKED_NOTIFY_DOMAINS = new Set(['clinica.com.br', 'example.com', 'test.com'])

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return defaultValue
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true
  if (['0', 'false', 'no', 'off'].includes(raw)) return false
  return defaultValue
}

export function isFlowHandoffEmailGloballyEnabled(): boolean {
  return normalizeBooleanEnv(process.env.FLOW_HANDOFF_EMAIL_ENABLED, false)
}

const HANDOFF_EMAIL_SUBJECT_PATTERN =
  /\[fluxo\s+cl[ií]nica\]\s*atendimento\s+humano\s+necess[aá]rio/i

export type OutboundHandoffEmailGuard =
  | { allowed: true }
  | { allowed: false; reason: string }

/** Bloqueio central — vale para qualquer caminho que chame mail-send (handoff antigo no grafo, deploy desatualizado). */
export function getOutboundHandoffEmailGuard(input: {
  to?: string | null
  subject?: string | null
}): OutboundHandoffEmailGuard {
  const subject = String(input.subject || '').trim()
  if (!subject || !HANDOFF_EMAIL_SUBJECT_PATTERN.test(subject)) {
    return { allowed: true }
  }

  if (!isFlowHandoffEmailGloballyEnabled()) {
    return { allowed: false, reason: 'FLOW_HANDOFF_EMAIL_ENABLED=false' }
  }

  const to = String(input.to || '').trim().toLowerCase()
  if (!to || isBlockedNotifyEmail(to)) {
    return { allowed: false, reason: 'recipient_blocked_or_invalid' }
  }

  return { allowed: true }
}

function parseBlockedMailSenderEmails(): Set<string> {
  const raw = String(process.env.FLOW_EMAIL_BLOCKED_SENDERS || '').trim()
  const values = raw
    ? raw.split(/[,;\s]+/).map((item) => item.trim().toLowerCase()).filter(Boolean)
    : []
  return new Set(values)
}

/** Remetentes (conta SMTP cadastrada) que nao podem enviar pela plataforma — ex.: Gmail pessoal. */
export function isBlockedMailSenderEmail(email: string | null | undefined): boolean {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return false
  return parseBlockedMailSenderEmails().has(normalized)
}

export function getBlockedMailSenderEmails(): string[] {
  return [...parseBlockedMailSenderEmails()]
}

export function logFlowHandoffEmailStartupStatus(): void {
  const enabled = isFlowHandoffEmailGloballyEnabled()
  const blockedSenders = getBlockedMailSenderEmails()
  logger.info('[flow-team-notify] Handoff por e-mail', {
    FLOW_HANDOFF_EMAIL_ENABLED: enabled,
    FLOW_EMAIL_BLOCKED_SENDERS: blockedSenders.length ? blockedSenders : undefined,
    teamNotifyConfigured: Boolean(
      resolveFlowTeamNotifyEmail(process.env.TEAM_NOTIFY_EMAIL) ||
        resolveFlowTeamNotifyEmail(process.env.FLOW_TEAM_NOTIFY_EMAIL)
    ),
  })
  if (!enabled) {
    logger.info(
      '[flow-team-notify] E-mails "[Fluxo Clínica] Atendimento humano..." serao suprimidos na camada de envio'
    )
  }
  if (blockedSenders.length) {
    logger.info('[flow-team-notify] Envios SMTP bloqueados para remetentes listados em FLOW_EMAIL_BLOCKED_SENDERS')
  }
}

function isBlockedNotifyEmail(email: string): boolean {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return true
  if (BLOCKED_NOTIFY_EMAILS.has(normalized)) return true

  const domain = normalized.split('@')[1] || ''
  if (BLOCKED_NOTIFY_DOMAINS.has(domain)) return true

  return false
}

export function isValidNotifyEmailFormat(email: string): boolean {
  const normalized = String(email || '').trim()
  if (!normalized || normalized.length > 254) return false
  return EMAIL_PATTERN.test(normalized)
}

/**
 * Resolve e-mail da equipe para handoff/alertas internos.
 * Retorna null quando desabilitado, vazio, bloqueado (demo) ou invalido — nesse caso nao envia e-mail.
 */
export function resolveFlowTeamNotifyEmail(explicit?: string | null): string | null {
  if (!isFlowHandoffEmailGloballyEnabled()) {
    return null
  }

  const candidate = String(
    explicit || process.env.TEAM_NOTIFY_EMAIL || process.env.FLOW_TEAM_NOTIFY_EMAIL || ''
  ).trim()

  if (!candidate) {
    return null
  }

  if (!isValidNotifyEmailFormat(candidate)) {
    logger.warn('[flow-team-notify] E-mail de notificacao ignorado (formato invalido)', {
      candidatePreview: candidate.slice(0, 48),
    })
    return null
  }

  if (isBlockedNotifyEmail(candidate)) {
    logger.warn('[flow-team-notify] E-mail de notificacao ignorado (endereco de demo bloqueado)', {
      candidatePreview: candidate.slice(0, 48),
    })
    return null
  }

  return candidate.toLowerCase()
}

export function resolveFlowTeamNotifyWhatsApp(explicit?: string | null): string | null {
  const digits = String(
    explicit || process.env.TEAM_NOTIFY_WHATSAPP || process.env.FLOW_TEAM_NOTIFY_WHATSAPP || ''
  )
    .replace(/\D/g, '')

  if (digits.length < 10 || digits.length > 13) {
    return null
  }

  return digits
}

/** Campos opcionais para nos human_handoff no grafo (omitidos quando nao configurados). */
export function buildHandoffNotifyNodeFields(input: {
  teamNotifyEmail?: string | null
  teamNotifyWhatsApp?: string | null
}): Record<string, string> {
  const notifyEmail = resolveFlowTeamNotifyEmail(input.teamNotifyEmail)
  const notifyWhatsApp = resolveFlowTeamNotifyWhatsApp(input.teamNotifyWhatsApp)
  const fields: Record<string, string> = {}

  if (notifyEmail) {
    fields.notifyEmail = notifyEmail
  }
  if (notifyWhatsApp) {
    fields.notifyWhatsApp = notifyWhatsApp
  }

  return fields
}

export function resolveProvisionTeamNotifyOptions(options?: {
  teamNotifyEmail?: string | null
  teamNotifyWhatsApp?: string | null
}): { teamNotifyEmail: string; teamNotifyWhatsApp: string } {
  return {
    teamNotifyEmail: resolveFlowTeamNotifyEmail(options?.teamNotifyEmail) || '',
    teamNotifyWhatsApp: resolveFlowTeamNotifyWhatsApp(options?.teamNotifyWhatsApp) || '',
  }
}
