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
