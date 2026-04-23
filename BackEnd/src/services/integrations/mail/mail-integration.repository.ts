import { supabase } from '../../../lib/supabase'
import logger from '../../../lib/logger'
import {
  MailAuthType,
  MailIntegrationConfig,
  MailProviderFamily,
  MailReadMethod,
  MailSendMethod,
} from './mail.types'

type IntegrationRow = {
  id: string
  provider?: string | null
  email?: string | null
  smtp_host?: string | null
  smtp_port?: number | null
  app_key?: string | null
  access_token?: string | null
  refresh_token?: string | null
  expires_at?: string | null
  user_id?: string | null
  companies_id?: string | null
}

type EmailSettingsRow = {
  integration_id: string
  provider_family?: string | null
  provider_preset?: string | null
  auth_type?: string | null
  read_method?: string | null
  send_method?: string | null
  email_address?: string | null
  username?: string | null
  smtp_host?: string | null
  smtp_port?: number | null
  smtp_secure?: boolean | null
  imap_host?: string | null
  imap_port?: number | null
  imap_secure?: boolean | null
  scopes?: unknown
  status?: string | null
  is_default?: boolean | null
  is_active?: boolean | null
  last_test_at?: string | null
  last_sync_at?: string | null
  sync_cursor?: string | null
  sync_checkpoint?: unknown
}

type PersistMicrosoft365TokenInput = {
  accessToken: string
  refreshToken?: string | null
  expiresAt?: string | null
  emailAddress?: string | null
}

function normalizeBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  return null
}

function normalizeScopes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

export function normalizeMailProviderFamily(provider: string): MailProviderFamily {
  const normalized = String(provider || '').trim().toLowerCase()
  if (normalized === 'outlook' || normalized === 'office365' || normalized === 'microsoft365') {
    return 'microsoft365'
  }
  if (normalized.includes('imap') || normalized.includes('smtp') || normalized === 'email') {
    return 'generic_imap_smtp'
  }
  return 'unknown'
}

function normalizeAuthType(value: unknown, providerFamily: MailProviderFamily): MailAuthType {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'oauth2' || normalized === 'basic' || normalized === 'app_password') {
    return normalized
  }
  if (providerFamily === 'microsoft365') {
    return 'oauth2'
  }
  return 'basic'
}

function normalizeReadMethod(
  value: unknown,
  providerFamily: MailProviderFamily,
  accessToken?: string | null,
  refreshToken?: string | null,
  imapHost?: string | null
): MailReadMethod {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'graph' || normalized === 'imap' || normalized === 'none') {
    return normalized
  }
  if (providerFamily === 'microsoft365' && (accessToken || refreshToken)) {
    return 'graph'
  }
  if (imapHost) {
    return 'imap'
  }
  return 'none'
}

function normalizeSendMethod(
  value: unknown,
  providerFamily: MailProviderFamily,
  accessToken?: string | null,
  refreshToken?: string | null,
  smtpHost?: string | null
): MailSendMethod {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'graph' || normalized === 'smtp' || normalized === 'none') {
    return normalized
  }
  if (providerFamily === 'microsoft365' && (accessToken || refreshToken)) {
    return 'graph'
  }
  if (providerFamily === 'microsoft365') {
    return 'none'
  }
  if (smtpHost) {
    return 'smtp'
  }
  return 'none'
}

export function mapMailIntegrationConfig(
  integration: IntegrationRow,
  settings?: EmailSettingsRow | null
): MailIntegrationConfig {
  const provider = String(integration.provider || '').trim().toLowerCase()
  const providerFamily = settings?.provider_family
    ? normalizeMailProviderFamily(String(settings.provider_family))
    : normalizeMailProviderFamily(provider)

  const emailAddress = String(settings?.email_address || integration.email || '').trim()
  const username = String(settings?.username || emailAddress || '').trim()

  const smtpHost = String(settings?.smtp_host || integration.smtp_host || '').trim() || null
  const smtpPort = Number(settings?.smtp_port || integration.smtp_port || 0) || null
  const smtpSecure = normalizeBool(settings?.smtp_secure) ?? (smtpPort === 465 ? true : null)

  const imapHost = String(settings?.imap_host || '').trim() || null
  const imapPort = Number(settings?.imap_port || 0) || null
  const imapSecure = normalizeBool(settings?.imap_secure) ?? (imapPort === 993 ? true : null)

  const authType = normalizeAuthType(settings?.auth_type, providerFamily)
  const readMethod = normalizeReadMethod(
    settings?.read_method,
    providerFamily,
    integration.access_token,
    integration.refresh_token,
    imapHost
  )
  const sendMethod = normalizeSendMethod(
    settings?.send_method,
    providerFamily,
    integration.access_token,
    integration.refresh_token,
    smtpHost
  )

  return {
    integrationId: integration.id,
    companyId: integration.companies_id || null,
    provider,
    providerPreset: String(settings?.provider_preset || '').trim() || null,
    providerFamily,
    authType,
    readMethod,
    sendMethod,
    emailAddress,
    username: username || emailAddress,
    password: String(integration.app_key || '').trim() || null,
    accessToken: String(integration.access_token || '').trim() || null,
    refreshToken: String(integration.refresh_token || '').trim() || null,
    expiresAt: String(integration.expires_at || '').trim() || null,
    smtpHost,
    smtpPort,
    smtpSecure,
    imapHost,
    imapPort,
    imapSecure,
    scopes: normalizeScopes(settings?.scopes),
    status: String(settings?.status || '').trim() || null,
    isDefault: settings?.is_default === true,
    isActive: settings?.is_active !== false,
    lastTestAt: String(settings?.last_test_at || '').trim() || null,
    lastSyncAt: String(settings?.last_sync_at || '').trim() || null,
    syncCursor: String(settings?.sync_cursor || '').trim() || null,
    syncCheckpoint:
      settings?.sync_checkpoint && typeof settings.sync_checkpoint === 'object' && !Array.isArray(settings.sync_checkpoint)
        ? (settings.sync_checkpoint as Record<string, unknown>)
        : null,
    canRead: readMethod !== 'none',
    canSend: sendMethod !== 'none',
    rawIntegration: integration as unknown as Record<string, unknown>,
    rawSettings: (settings || null) as unknown as Record<string, unknown> | null,
  }
}

async function getEmailSettings(integrationId: string): Promise<EmailSettingsRow | null> {
  try {
    const { data, error } = await supabase
      .from('tb_email_integration_settings')
      .select(
        'integration_id, provider_family, provider_preset, auth_type, read_method, send_method, email_address, username, smtp_host, smtp_port, smtp_secure, imap_host, imap_port, imap_secure, scopes, status, is_default, is_active, last_test_at, last_sync_at, sync_cursor, sync_checkpoint'
      )
      .eq('integration_id', integrationId)
      .maybeSingle()

    if (error) {
      if (String(error.message || '').includes('does not exist') || error.code === '42P01') {
        return null
      }
      throw error
    }

    return (data || null) as EmailSettingsRow | null
  } catch (error: any) {
    logger.warn('[mail-integration.repository] Falha ao buscar tb_email_integration_settings', {
      integrationId,
      error: error?.message || error,
    })
    return null
  }
}

export async function loadMailIntegrationConfig(integrationId: string): Promise<MailIntegrationConfig> {
  const { data, error } = await supabase
    .from('tb_integrations')
    .select('id, provider, email, smtp_host, smtp_port, app_key, access_token, refresh_token, expires_at, user_id, companies_id')
    .eq('id', integrationId)
    .maybeSingle()

  if (error || !data) {
    throw new Error('Credenciais de email não encontradas')
  }

  const settings = await getEmailSettings(integrationId)
  return mapMailIntegrationConfig(data as IntegrationRow, settings)
}

export async function persistMicrosoft365Tokens(
  integrationId: string,
  input: PersistMicrosoft365TokenInput
): Promise<void> {
  const accessToken = String(input.accessToken || '').trim()
  if (!accessToken) {
    throw new Error('Nao foi possivel persistir token vazio do Microsoft 365.')
  }

  const refreshToken = String(input.refreshToken || '').trim() || null
  const expiresAt = String(input.expiresAt || '').trim() || null
  const emailAddress = String(input.emailAddress || '').trim() || null

  const integrationUpdate: Record<string, unknown> = {
    access_token: accessToken,
  }

  if (refreshToken) {
    integrationUpdate.refresh_token = refreshToken
  }

  if (expiresAt) {
    integrationUpdate.expires_at = expiresAt
  }

  if (emailAddress) {
    integrationUpdate.email = emailAddress
  }

  const { error: integrationError } = await supabase
    .from('tb_integrations')
    .update(integrationUpdate)
    .eq('id', integrationId)

  if (integrationError) {
    throw integrationError
  }

  try {
    const { error: settingsError } = await supabase
      .from('tb_email_integration_settings')
      .upsert(
          {
            integration_id: integrationId,
            email_address: emailAddress,
            username: emailAddress,
            status: 'connected',
            is_active: true,
            updated_at: new Date().toISOString(),
          },
        { onConflict: 'integration_id' }
      )

    if (settingsError && settingsError.code !== '42P01') {
      throw settingsError
    }
  } catch (error: any) {
    logger.warn('[mail-integration.repository] Falha ao persistir status do Microsoft 365', {
      integrationId,
      error: error?.message || error,
    })
  }
}
