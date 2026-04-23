import { supabase } from '../../../lib/supabase'
import logger from '../../../lib/logger'
import { loadMailIntegrationConfig } from './mail-integration.repository'
import { testMailIntegrationConnection } from './mail-connection.service'
import {
  MailAuthType,
  MailIntegrationConfig,
  MailProviderFamily,
  MailReadMethod,
  MailSendMethod,
} from './mail.types'

export type EmailIntegrationStatus =
  | 'draft'
  | 'configured'
  | 'connected'
  | 'auth_failed'
  | 'test_failed'
  | 'expired'
  | 'disabled'
  | 'pending'

export type EmailProviderPreset =
  | 'gmail'
  | 'microsoft365'
  | 'outlook_personal'
  | 'hotmail'
  | 'yahoo'
  | 'custom'
  | 'generic_imap_smtp'

type PlatformUserContext = {
  id: string
  email: string
  companies_id: string | null
}

type StoredEmailIntegration = {
  id: string
  user_id: string | null
  companies_id?: string | null
  provider?: string | null
  email?: string | null
  smtp_host?: string | null
  smtp_port?: number | null
  app_key?: string | null
  access_token?: string | null
  refresh_token?: string | null
  expires_at?: string | null
  created_at?: string | null
}

type EmailSettingsPayload = {
  providerPreset: EmailProviderPreset
  providerFamily: MailProviderFamily
  authType: MailAuthType
  readMethod: MailReadMethod
  sendMethod: MailSendMethod
  emailAddress: string | null
  username: string | null
  password: string | null
  oauthClientId: string | null
  oauthClientSecret: string | null
  oauthRedirectUri: string | null
  oauthTenantId: string | null
  smtpHost: string | null
  smtpPort: number | null
  smtpSecure: boolean | null
  imapHost: string | null
  imapPort: number | null
  imapSecure: boolean | null
  isDefault?: boolean
  isActive?: boolean
}

const EMAIL_PRESETS: Record<EmailProviderPreset, Partial<EmailSettingsPayload>> = {
  gmail: {
    providerFamily: 'generic_imap_smtp',
    authType: 'app_password',
    readMethod: 'imap',
    sendMethod: 'smtp',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecure: false,
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecure: true,
  },
  microsoft365: {
    providerFamily: 'microsoft365',
    authType: 'oauth2',
    readMethod: 'graph',
    sendMethod: 'graph',
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecure: false,
    imapHost: null,
    imapPort: null,
    imapSecure: null,
  },
  outlook_personal: {
    providerFamily: 'generic_imap_smtp',
    authType: 'app_password',
    readMethod: 'imap',
    sendMethod: 'smtp',
    smtpHost: 'smtp-mail.outlook.com',
    smtpPort: 587,
    smtpSecure: false,
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecure: true,
  },
  hotmail: {
    providerFamily: 'generic_imap_smtp',
    authType: 'app_password',
    readMethod: 'imap',
    sendMethod: 'smtp',
    smtpHost: 'smtp-mail.outlook.com',
    smtpPort: 587,
    smtpSecure: false,
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecure: true,
  },
  yahoo: {
    providerFamily: 'generic_imap_smtp',
    authType: 'app_password',
    readMethod: 'imap',
    sendMethod: 'smtp',
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 587,
    smtpSecure: false,
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    imapSecure: true,
  },
  custom: {
    providerFamily: 'generic_imap_smtp',
    authType: 'basic',
    readMethod: 'imap',
    sendMethod: 'smtp',
    smtpHost: null,
    smtpPort: 587,
    smtpSecure: false,
    imapHost: null,
    imapPort: 993,
    imapSecure: true,
  },
  generic_imap_smtp: {
    providerFamily: 'generic_imap_smtp',
    authType: 'basic',
    readMethod: 'imap',
    sendMethod: 'smtp',
    smtpHost: null,
    smtpPort: 587,
    smtpSecure: false,
    imapHost: null,
    imapPort: 993,
    imapSecure: true,
  },
}

function parseNullableString(value: unknown): string | null {
  const normalized = String(value || '').trim()
  return normalized || null
}

function parseNullableInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.trunc(parsed)
}

function parseNullableBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return null
  if (['true', '1', 'yes', 'sim'].includes(normalized)) return true
  if (['false', '0', 'no', 'nao', 'não'].includes(normalized)) return false
  return null
}

function normalizePreset(value: unknown): EmailProviderPreset {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'microsoft365' || normalized === 'office365') return 'microsoft365'
  if (normalized === 'outlook' || normalized === 'outlook_personal' || normalized === 'outlook.com') return 'outlook_personal'
  if (normalized === 'hotmail' || normalized === 'live') return 'hotmail'
  if (normalized === 'yahoo') return 'yahoo'
  if (normalized === 'custom' || normalized === 'generic_imap_smtp' || normalized === 'email') return 'custom'
  return 'gmail'
}

function inferPresetFromConfig(config: MailIntegrationConfig): EmailProviderPreset {
  if (config.providerPreset) return normalizePreset(config.providerPreset)
  if (config.providerFamily === 'microsoft365') return 'microsoft365'

  const smtpHost = String(config.smtpHost || '').trim().toLowerCase()
  const imapHost = String(config.imapHost || '').trim().toLowerCase()
  const email = String(config.emailAddress || config.username || '').trim().toLowerCase()

  if (smtpHost === 'smtp.gmail.com' && imapHost === 'imap.gmail.com') return 'gmail'
  if (smtpHost === 'smtp.mail.yahoo.com' && imapHost === 'imap.mail.yahoo.com') return 'yahoo'
  if (smtpHost === 'smtp-mail.outlook.com' && imapHost === 'outlook.office365.com') {
    if (email.endsWith('@hotmail.com') || email.endsWith('@live.com')) return 'hotmail'
    return 'outlook_personal'
  }

  return 'custom'
}

function normalizeProviderFamily(value: unknown, preset: EmailProviderPreset): MailProviderFamily {
  if (preset === 'microsoft365') return 'microsoft365'
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === 'microsoft365' ? 'microsoft365' : 'generic_imap_smtp'
}

function normalizeAuthType(value: unknown, preset: EmailProviderPreset): MailAuthType {
  if (preset === 'microsoft365') return 'oauth2'
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'app_password') return 'app_password'
  if (normalized === 'oauth2') return 'oauth2'
  return EMAIL_PRESETS[preset].authType || 'basic'
}

function normalizeReadMethod(value: unknown, providerFamily: MailProviderFamily, imapHost: string | null): MailReadMethod {
  if (providerFamily === 'microsoft365') return 'graph'
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'none') return 'none'
  return imapHost ? 'imap' : 'none'
}

function normalizeSendMethod(value: unknown, providerFamily: MailProviderFamily, smtpHost: string | null): MailSendMethod {
  if (providerFamily === 'microsoft365') return 'graph'
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'none') return 'none'
  return smtpHost ? 'smtp' : 'none'
}

function isEmailProvider(provider: string | null | undefined): boolean {
  const normalized = String(provider || '').trim().toLowerCase()
  return ['email', 'outlook', 'office365', 'microsoft365'].includes(normalized)
}

function isEmailIntegrationCandidate(row: StoredEmailIntegration): boolean {
  const provider = String(row.provider || '').trim().toLowerCase()
  if (provider === 'whatsapp') return false
  return isEmailProvider(provider) || !!String(row.email || '').trim() || !!String(row.smtp_host || '').trim()
}

function isOwnedEmailIntegration(
  integration: StoredEmailIntegration,
  userId: string,
  companiesId: string | null
): boolean {
  return integration.user_id === userId || (!!companiesId && integration.companies_id === companiesId)
}

export async function getAuthenticatedPlatformUser(email: string): Promise<PlatformUserContext> {
  const normalizedEmail = String(email || '').trim()
  if (!normalizedEmail) throw new Error('Usuario autenticado nao encontrado.')

  const { data: userData, error: userError } = await supabase
    .from('tb_users')
    .select('id, email')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (userError || !userData?.id) {
    throw new Error('Usuario autenticado nao encontrado na tabela tb_users')
  }

  const { data: companyUser, error: companyUserError } = await supabase
    .from('tb_company_users')
    .select('companies_id')
    .eq('user_id', userData.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (companyUserError) {
    throw new Error(companyUserError.message)
  }

  return {
    id: userData.id,
    email: userData.email || normalizedEmail,
    companies_id: companyUser?.companies_id || null,
  }
}

export function normalizeEmailIntegrationPayload(body: any): EmailSettingsPayload {
  const preset = normalizePreset(body?.provider_preset || body?.providerPreset || body?.preset)
  const defaults = EMAIL_PRESETS[preset]
  const providerFamily = normalizeProviderFamily(body?.provider_family || body?.providerFamily, preset)
  const emailAddress = parseNullableString(body?.email_address || body?.emailAddress)
  const username = parseNullableString(body?.username) || emailAddress
  const password = parseNullableString(body?.password || body?.smtpPass)
  const oauthClientId = parseNullableString(body?.oauth_client_id || body?.oauthClientId)
  const oauthClientSecret = parseNullableString(body?.oauth_client_secret || body?.oauthClientSecret)
  const oauthRedirectUri = parseNullableString(body?.oauth_redirect_uri || body?.oauthRedirectUri)
  const oauthTenantId = parseNullableString(body?.oauth_tenant_id || body?.oauthTenantId)

  const smtpHost =
    providerFamily === 'microsoft365'
      ? 'smtp.office365.com'
      : parseNullableString(body?.smtp_host || body?.smtpHost) || (defaults.smtpHost as string | null) || null
  const smtpPort =
    providerFamily === 'microsoft365'
      ? 587
      : parseNullableInteger(body?.smtp_port || body?.smtpPort) || (defaults.smtpPort as number | null) || null
  const smtpSecure =
    providerFamily === 'microsoft365'
      ? false
      : parseNullableBoolean(body?.smtp_secure ?? body?.smtpSecure) ??
        (defaults.smtpSecure as boolean | null) ??
        (smtpPort === 465 ? true : smtpPort === 587 ? false : null)

  const imapHost =
    providerFamily === 'microsoft365'
      ? null
      : parseNullableString(body?.imap_host || body?.imapHost) || (defaults.imapHost as string | null) || null
  const imapPort =
    providerFamily === 'microsoft365'
      ? null
      : parseNullableInteger(body?.imap_port || body?.imapPort) || (defaults.imapPort as number | null) || null
  const imapSecure =
    providerFamily === 'microsoft365'
      ? null
      : parseNullableBoolean(body?.imap_secure ?? body?.imapSecure) ??
        (defaults.imapSecure as boolean | null) ??
        (imapPort === 993 ? true : imapPort === 143 ? false : null)

  const authType = normalizeAuthType(body?.auth_type || body?.authType, preset)
  const readMethod = normalizeReadMethod(body?.read_method || body?.readMethod || defaults.readMethod, providerFamily, imapHost)
  const sendMethod = normalizeSendMethod(body?.send_method || body?.sendMethod || defaults.sendMethod, providerFamily, smtpHost)

  return {
    providerPreset: preset,
    providerFamily,
    authType,
    readMethod,
    sendMethod,
    emailAddress,
    username,
    password,
    oauthClientId,
    oauthClientSecret,
    oauthRedirectUri,
    oauthTenantId,
    smtpHost,
    smtpPort,
    smtpSecure,
    imapHost,
    imapPort,
    imapSecure,
    isDefault: parseNullableBoolean(body?.is_default ?? body?.isDefault) ?? undefined,
    isActive: parseNullableBoolean(body?.is_active ?? body?.isActive) ?? undefined,
  }
}

function ensureValidPayload(payload: EmailSettingsPayload, existing?: MailIntegrationConfig | null) {
  if (payload.providerFamily === 'microsoft365') {
    if (!(payload.emailAddress || existing?.emailAddress)) {
      throw new Error('Informe o email principal da integracao Microsoft 365.')
    }
    if (!(payload.oauthClientId || existing?.oauthClientId)) {
      throw new Error('Informe o Client ID da integracao Microsoft 365.')
    }
    if (!(payload.oauthClientSecret || existing?.oauthClientSecret)) {
      throw new Error('Informe o Client Secret da integracao Microsoft 365.')
    }
    if (!(payload.oauthRedirectUri || existing?.oauthRedirectUri)) {
      throw new Error('Informe o Redirect URI da integracao Microsoft 365.')
    }
    return
  }

  const login = payload.username || payload.emailAddress
  if (!login) throw new Error('Informe ao menos o email ou usuario da integracao.')
  if (payload.readMethod === 'imap' && (!payload.imapHost || !payload.imapPort)) {
    throw new Error('Preencha host e porta IMAP para habilitar leitura.')
  }
  if (payload.sendMethod === 'smtp' && (!payload.smtpHost || !payload.smtpPort)) {
    throw new Error('Preencha host e porta SMTP para habilitar envio.')
  }
  if (!payload.password && !existing?.password) {
    throw new Error('Informe a senha ou app password para salvar a integracao.')
  }
}

function resolveStatus(payload: EmailSettingsPayload, existing?: MailIntegrationConfig | null): EmailIntegrationStatus {
  if (payload.isActive === false) return 'disabled'
  if (payload.providerFamily === 'microsoft365') {
    return existing?.accessToken || existing?.refreshToken ? 'connected' : 'pending'
  }
  return 'configured'
}

function hasSecret(config: MailIntegrationConfig): boolean {
  return !!(config.password || config.accessToken || config.refreshToken)
}

export function buildEmailIntegrationResponse(config: MailIntegrationConfig) {
  const preset = inferPresetFromConfig(config)
  const status = config.isActive === false ? 'disabled' : (config.status || (hasSecret(config) ? 'configured' : 'draft'))

  return {
    id: config.integrationId,
    company_id: config.companyId || null,
    provider: config.provider,
    provider_preset: preset,
    provider_label: EMAIL_PRESETS[preset] ? preset : 'custom',
    provider_family: config.providerFamily,
    auth_type: config.authType,
    read_method: config.readMethod,
    send_method: config.sendMethod,
    email_address: config.emailAddress || null,
    username: config.username || null,
    oauth_client_id: config.oauthClientId || null,
    oauth_redirect_uri: config.oauthRedirectUri || null,
    oauth_tenant_id: config.oauthTenantId || null,
    smtp_host: config.smtpHost || null,
    smtp_port: config.smtpPort || null,
    smtp_secure: config.smtpSecure ?? null,
    imap_host: config.imapHost || null,
    imap_port: config.imapPort || null,
    imap_secure: config.imapSecure ?? null,
    status,
    is_default: !!config.isDefault,
    is_active: config.isActive !== false,
    can_read: config.canRead && config.isActive !== false,
    can_send: config.canSend && config.isActive !== false,
    has_password: !!config.password,
    has_oauth_client_secret: !!config.oauthClientSecret,
    has_access_token: !!config.accessToken,
    has_refresh_token: !!config.refreshToken,
    last_test_at: config.lastTestAt || null,
    last_sync_at: config.lastSyncAt || null,
  }
}

export async function listEmailIntegrationConfigsForUser(email: string) {
  const platformUser = await getAuthenticatedPlatformUser(email)
  const rows = await loadOwnedEmailRows(platformUser)
  const configs = await Promise.all(rows.map((row) => loadMailIntegrationConfig(row.id).catch(() => null)))

  return {
    platformUser,
    configs: configs.filter(Boolean) as MailIntegrationConfig[],
  }
}

async function loadCandidateEmailIntegrations(): Promise<StoredEmailIntegration[]> {
  const { data, error } = await supabase
    .from('tb_integrations')
    .select('id, user_id, companies_id, provider, email, smtp_host, smtp_port, app_key, access_token, refresh_token, expires_at, created_at')
    .neq('provider', 'whatsapp')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return Array.isArray(data) ? (data as StoredEmailIntegration[]) : []
}

async function loadOwnedEmailRows(platformUser: PlatformUserContext): Promise<StoredEmailIntegration[]> {
  const rows = await loadCandidateEmailIntegrations()
  return rows.filter((row) => isOwnedEmailIntegration(row, platformUser.id, platformUser.companies_id) && isEmailIntegrationCandidate(row))
}

export async function listEmailIntegrationsForUser(email: string) {
  const { platformUser, configs: validConfigs } = await listEmailIntegrationConfigsForUser(email)

  const defaultConfig =
    validConfigs.find((config) => config.isActive !== false && config.isDefault) ||
    validConfigs.find((config) => config.isActive !== false && config.status === 'connected') ||
    validConfigs.find((config) => config.isActive !== false) ||
    validConfigs[0] ||
    null

  return {
    platformUser,
    integrations: validConfigs.map((config) => {
      const response = buildEmailIntegrationResponse(config)
      return {
        ...response,
        is_default: response.id === defaultConfig?.integrationId || response.is_default,
      }
    }),
    defaultIntegration: defaultConfig ? buildEmailIntegrationResponse({ ...defaultConfig, isDefault: true }) : null,
  }
}

export async function getDefaultEmailIntegrationForUser(email: string) {
  const result = await listEmailIntegrationsForUser(email)
  return result.defaultIntegration
}

async function assertOwnedIntegration(integrationId: string, platformUser: PlatformUserContext): Promise<MailIntegrationConfig> {
  const config = await loadMailIntegrationConfig(integrationId)
  if (config.companyId && platformUser.companies_id && config.companyId !== platformUser.companies_id) {
    throw new Error('Integracao de email nao pertence a sua empresa.')
  }

  const rawUserId = String(config.rawIntegration?.user_id || '').trim()
  if (!config.companyId && rawUserId && rawUserId !== platformUser.id) {
    throw new Error('Integracao de email nao pertence ao usuario autenticado.')
  }

  return config
}

async function clearDefaultForCompany(platformUser: PlatformUserContext, exceptIntegrationId?: string) {
  const rows = await loadOwnedEmailRows(platformUser)
  await Promise.all(rows
    .filter((row) => row.id !== exceptIntegrationId)
    .map((row) => supabase
      .from('tb_email_integration_settings')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('integration_id', row.id)
    )
  )
}

async function persistSettings(integrationId: string, payload: EmailSettingsPayload, status: EmailIntegrationStatus) {
  const { error } = await supabase.from('tb_email_integration_settings').upsert(
    {
      integration_id: integrationId,
      provider_family: payload.providerFamily,
      provider_preset: payload.providerPreset,
      oauth_client_id: payload.oauthClientId,
      oauth_client_secret: payload.oauthClientSecret,
      oauth_redirect_uri: payload.oauthRedirectUri,
      oauth_tenant_id: payload.oauthTenantId,
      auth_type: payload.authType,
      read_method: payload.readMethod,
      send_method: payload.sendMethod,
      email_address: payload.emailAddress,
      username: payload.username,
      smtp_host: payload.smtpHost,
      smtp_port: payload.smtpPort,
      smtp_secure: payload.smtpSecure,
      imap_host: payload.imapHost,
      imap_port: payload.imapPort,
      imap_secure: payload.imapSecure,
      status,
      is_default: payload.isDefault ?? false,
      is_active: payload.isActive ?? true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'integration_id' }
  )

  if (error) throw error
}

export async function createEmailIntegrationForUser(email: string, body: any) {
  const platformUser = await getAuthenticatedPlatformUser(email)
  const payload = normalizeEmailIntegrationPayload(body)
  ensureValidPayload(payload)

  const provider = payload.providerFamily === 'microsoft365' ? 'microsoft365' : 'email'
  const emailAddress = payload.emailAddress || payload.username
  const { data, error } = await supabase
    .from('tb_integrations')
    .insert({
      provider,
      user_id: platformUser.id,
      companies_id: platformUser.companies_id,
      email: emailAddress,
      smtp_host: payload.smtpHost,
      smtp_port: payload.smtpPort,
      app_key: payload.password,
    })
    .select('id')
    .single()

  if (error || !data?.id) throw error || new Error('Nao foi possivel criar a integracao de email.')

  const ownedRows = await loadOwnedEmailRows(platformUser)
  const shouldBeDefault = payload.isDefault ?? ownedRows.length <= 1
  if (shouldBeDefault) await clearDefaultForCompany(platformUser, data.id)
  await persistSettings(data.id, { ...payload, isDefault: shouldBeDefault }, resolveStatus({ ...payload, isDefault: shouldBeDefault }))

  const config = await loadMailIntegrationConfig(data.id)
  return buildEmailIntegrationResponse(config)
}

export async function updateEmailIntegrationForUser(email: string, integrationId: string, body: any) {
  const platformUser = await getAuthenticatedPlatformUser(email)
  const existing = await assertOwnedIntegration(integrationId, platformUser)
  const payload = normalizeEmailIntegrationPayload(body)
  ensureValidPayload(payload, existing)

  const provider = payload.providerFamily === 'microsoft365' ? 'microsoft365' : 'email'
  const emailAddress = payload.emailAddress || payload.username
  const nextPassword = payload.password || existing.password || null

  const { error } = await supabase
    .from('tb_integrations')
    .update({
      provider,
      user_id: platformUser.id,
      companies_id: platformUser.companies_id,
      email: emailAddress,
      smtp_host: payload.smtpHost,
      smtp_port: payload.smtpPort,
      app_key: nextPassword,
    })
    .eq('id', integrationId)

  if (error) throw error

  const shouldBeDefault = payload.isDefault ?? existing.isDefault ?? false
  if (shouldBeDefault) await clearDefaultForCompany(platformUser, integrationId)
  await persistSettings(
    integrationId,
    {
      ...payload,
      oauthClientId: payload.oauthClientId || existing.oauthClientId || null,
      oauthClientSecret: payload.oauthClientSecret || existing.oauthClientSecret || null,
      oauthRedirectUri: payload.oauthRedirectUri || existing.oauthRedirectUri || null,
      oauthTenantId: payload.oauthTenantId || existing.oauthTenantId || null,
      isDefault: shouldBeDefault,
      isActive: payload.isActive ?? existing.isActive ?? true,
    },
    resolveStatus(payload, existing)
  )

  const config = await loadMailIntegrationConfig(integrationId)
  return buildEmailIntegrationResponse(config)
}

export async function upsertDefaultEmailIntegrationForUser(email: string, body: any) {
  const current = await listEmailIntegrationsForUser(email)
  const defaultId = current.defaultIntegration?.id
  if (defaultId) {
    return updateEmailIntegrationForUser(email, defaultId, { ...body, isDefault: true, isActive: true })
  }

  return createEmailIntegrationForUser(email, { ...body, isDefault: true, isActive: true })
}

export async function setDefaultEmailIntegrationForUser(email: string, integrationId: string) {
  const platformUser = await getAuthenticatedPlatformUser(email)
  const existing = await assertOwnedIntegration(integrationId, platformUser)
  await clearDefaultForCompany(platformUser, integrationId)

  const { error } = await supabase
    .from('tb_email_integration_settings')
    .update({
      is_default: true,
      is_active: true,
      status: existing.status === 'disabled' ? 'configured' : existing.status || 'configured',
      updated_at: new Date().toISOString(),
    })
    .eq('integration_id', integrationId)

  if (error) throw error

  const config = await loadMailIntegrationConfig(integrationId)
  return buildEmailIntegrationResponse({ ...config, isDefault: true, isActive: true })
}

export async function setEmailIntegrationActiveForUser(email: string, integrationId: string, isActive: boolean) {
  const platformUser = await getAuthenticatedPlatformUser(email)
  const existing = await assertOwnedIntegration(integrationId, platformUser)

  const updatePayload: Record<string, unknown> = {
    is_active: isActive,
    status: isActive ? (existing.status === 'disabled' ? 'configured' : existing.status || 'configured') : 'disabled',
    updated_at: new Date().toISOString(),
  }

  if (!isActive) {
    updatePayload.is_default = false
  }

  const { error } = await supabase
    .from('tb_email_integration_settings')
    .update(updatePayload)
    .eq('integration_id', integrationId)

  if (error) throw error

  const config = await loadMailIntegrationConfig(integrationId)
  return buildEmailIntegrationResponse({ ...config, isActive })
}

export async function deleteEmailIntegrationForUser(email: string, integrationId: string) {
  const platformUser = await getAuthenticatedPlatformUser(email)
  await assertOwnedIntegration(integrationId, platformUser)

  const { error } = await supabase
    .from('tb_integrations')
    .delete()
    .eq('id', integrationId)

  if (error) throw error
  return { deleted: true }
}

export async function testEmailIntegrationForUser(email: string, integrationId: string) {
  const platformUser = await getAuthenticatedPlatformUser(email)
  await assertOwnedIntegration(integrationId, platformUser)

  const result = await testMailIntegrationConnection(integrationId)
  const nextStatus: EmailIntegrationStatus = result.success ? 'connected' : 'test_failed'

  const { error } = await supabase
    .from('tb_email_integration_settings')
    .update({
      status: nextStatus,
      last_test_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('integration_id', integrationId)

  if (error) {
    logger.warn('[testEmailIntegrationForUser] Falha ao atualizar status de teste', {
      integrationId,
      error: error.message,
    })
  }

  return result
}
