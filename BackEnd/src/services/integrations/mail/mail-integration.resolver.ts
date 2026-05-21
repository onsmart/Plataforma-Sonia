import { isBlockedMailSenderEmail } from '../../flows/flow-team-notify.config'
import { loadMailIntegrationConfig } from './mail-integration.repository'
import {
  getAuthenticatedPlatformUser,
  listEmailIntegrationConfigsForUser,
} from './mail-integration.manager'
import { MailIntegrationConfig } from './mail.types'

type ResolveCapability = 'read' | 'send'

type ResolveMailIntegrationInput = {
  userEmail: string
  companyId?: string | null
  preferredIntegrationId?: string | null
}

function isRejectedStatus(status?: string | null): boolean {
  const normalized = String(status || '').trim().toLowerCase()
  return ['disabled', 'auth_failed', 'test_failed', 'expired'].includes(normalized)
}

function hasAuthMaterial(config: MailIntegrationConfig): boolean {
  if (config.providerFamily === 'microsoft365') {
    return !!(config.accessToken || config.refreshToken)
  }

  return !!(config.password && (config.username || config.emailAddress))
}

function ownsConfig(config: MailIntegrationConfig, userId: string, companyId?: string | null): boolean {
  if (companyId && config.companyId) {
    return config.companyId === companyId
  }

  const rawUserId = String(config.rawIntegration?.user_id || '').trim()
  return !rawUserId || rawUserId === userId
}

function supportsCapability(config: MailIntegrationConfig, capability: ResolveCapability): boolean {
  if (capability === 'send') return !!config.canSend
  return !!config.canRead
}

function integrationSenderIsBlocked(config: MailIntegrationConfig): boolean {
  return (
    isBlockedMailSenderEmail(config.emailAddress) || isBlockedMailSenderEmail(config.username)
  )
}

function isUsable(config: MailIntegrationConfig, capability: ResolveCapability): boolean {
  return (
    config.isActive !== false &&
    !isRejectedStatus(config.status) &&
    !integrationSenderIsBlocked(config) &&
    supportsCapability(config, capability) &&
    hasAuthMaterial(config)
  )
}

function rankConfigs(configs: MailIntegrationConfig[]): MailIntegrationConfig[] {
  return [...configs].sort((a, b) => {
    const aDefault = a.isDefault ? 1 : 0
    const bDefault = b.isDefault ? 1 : 0
    if (aDefault !== bDefault) return bDefault - aDefault

    const aConnected = a.status === 'connected' ? 1 : 0
    const bConnected = b.status === 'connected' ? 1 : 0
    if (aConnected !== bConnected) return bConnected - aConnected

    const aConfigured = a.status === 'configured' ? 1 : 0
    const bConfigured = b.status === 'configured' ? 1 : 0
    return bConfigured - aConfigured
  })
}

async function resolveMailIntegration(
  input: ResolveMailIntegrationInput,
  capability: ResolveCapability
): Promise<MailIntegrationConfig> {
  const userEmail = String(input.userEmail || '').trim()
  if (!userEmail) {
    throw new Error('Usuario autenticado nao informado para resolver integracao de email.')
  }

  const platformUser = await getAuthenticatedPlatformUser(userEmail)
  const companyId = input.companyId ?? platformUser.companies_id
  const preferredIntegrationId = String(input.preferredIntegrationId || '').trim()

  if (preferredIntegrationId) {
    try {
      const preferred = await loadMailIntegrationConfig(preferredIntegrationId)
      if (ownsConfig(preferred, platformUser.id, companyId) && isUsable(preferred, capability)) {
        return preferred
      }
    } catch {
      // Preferred id can still be a legacy WhatsApp/CRM integration. Fallback to the default email integration.
    }
  }

  const { configs } = await listEmailIntegrationConfigsForUser(userEmail)
  const selected = rankConfigs(configs).find((config) => isUsable(config, capability))

  if (!selected) {
    throw new Error(
      capability === 'send'
        ? 'Nenhuma integracao de email ativa e autenticada suporta envio.'
        : 'Nenhuma integracao de email ativa e autenticada suporta leitura.'
    )
  }

  return selected
}

export async function resolveMailIntegrationForSend(
  input: ResolveMailIntegrationInput
): Promise<MailIntegrationConfig> {
  return resolveMailIntegration(input, 'send')
}

export async function resolveMailIntegrationForRead(
  input: ResolveMailIntegrationInput
): Promise<MailIntegrationConfig> {
  return resolveMailIntegration(input, 'read')
}
