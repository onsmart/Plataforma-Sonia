import { Request, Response } from 'express'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import {
  loadMailIntegrationConfig,
  normalizeMailProviderFamily,
  testMailIntegrationConnection,
} from '../../services/integrations/mail'

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
  provider_family: 'microsoft365' | 'generic_imap_smtp'
  auth_type: 'oauth2' | 'basic' | 'app_password'
  read_method: 'graph' | 'imap' | 'none'
  send_method: 'graph' | 'smtp' | 'none'
  email_address: string | null
  username: string | null
  password: string | null
  smtp_host: string | null
  smtp_port: number | null
  smtp_secure: boolean | null
  imap_host: string | null
  imap_port: number | null
  imap_secure: boolean | null
}

function isMissingEmailSettingsTable(error: any): boolean {
  const message = String(error?.message || error?.details || '').toLowerCase()
  return error?.code === '42P01' || message.includes('tb_email_integration_settings')
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

function isEmailProvider(provider: string | null | undefined): boolean {
  const normalized = String(provider || '').trim().toLowerCase()
  return ['email', 'outlook', 'office365', 'microsoft365'].includes(normalized)
}

function isEmailIntegrationCandidate(row: StoredEmailIntegration): boolean {
  const provider = String(row.provider || '').trim().toLowerCase()
  if (provider === 'whatsapp') return false

  return isEmailProvider(provider) || !!String(row.email || '').trim() || !!String(row.smtp_host || '').trim()
}

async function getAuthenticatedPlatformUser(email: string): Promise<{ id: string; companies_id: string | null }> {
  const { data: userData, error: userError } = await supabase
    .from('tb_users')
    .select('id')
    .eq('email', email)
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
    companies_id: companyUser?.companies_id || null,
  }
}

function isOwnedEmailIntegration(
  integration: StoredEmailIntegration,
  userId: string,
  companiesId: string | null
): boolean {
  return integration.user_id === userId || (!!companiesId && integration.companies_id === companiesId)
}

async function loadCandidateEmailIntegrations(): Promise<StoredEmailIntegration[]> {
  const { data, error } = await supabase
    .from('tb_integrations')
    .select(
      'id, user_id, companies_id, provider, email, smtp_host, smtp_port, app_key, access_token, refresh_token, expires_at, created_at'
    )
    .neq('provider', 'whatsapp')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return Array.isArray(data) ? (data as StoredEmailIntegration[]) : []
}

function pickPrimaryOwnedEmailIntegration(
  rows: StoredEmailIntegration[],
  userId: string,
  companiesId: string | null
): StoredEmailIntegration | null {
  const owned = rows.filter(
    (row) => isOwnedEmailIntegration(row, userId, companiesId) && isEmailIntegrationCandidate(row)
  )

  if (owned.length === 0) {
    return null
  }

  return (
    owned.find((row) => {
      const normalized = String(row.provider || '').trim().toLowerCase()
      return ['microsoft365', 'office365', 'outlook', 'email'].includes(normalized)
    }) ||
    owned[0] ||
    null
  )
}

async function getCurrentOwnedEmailContext(email: string): Promise<{
  platformUser: { id: string; companies_id: string | null }
  integration: StoredEmailIntegration | null
}> {
  const platformUser = await getAuthenticatedPlatformUser(email)
  const rows = await loadCandidateEmailIntegrations()
  const integration = pickPrimaryOwnedEmailIntegration(rows, platformUser.id, platformUser.companies_id)
  return { platformUser, integration }
}

function normalizeEmailPayload(body: any): EmailSettingsPayload {
  const requestedProviderFamily = normalizeMailProviderFamily(String(body?.provider_family || body?.providerFamily || ''))
  const provider_family = requestedProviderFamily === 'microsoft365' ? 'microsoft365' : 'generic_imap_smtp'

  const email_address = parseNullableString(body?.email_address || body?.emailAddress)
  const username = parseNullableString(body?.username) || email_address
  const password = parseNullableString(body?.password || body?.smtpPass)
  const smtp_host =
    provider_family === 'microsoft365'
      ? 'smtp.office365.com'
      : parseNullableString(body?.smtp_host || body?.smtpHost)
  const smtp_port =
    provider_family === 'microsoft365'
      ? 587
      : parseNullableInteger(body?.smtp_port || body?.smtpPort)
  const smtp_secure =
    provider_family === 'microsoft365'
      ? false
      : parseNullableBoolean(body?.smtp_secure ?? body?.smtpSecure) ??
        (smtp_port === 465 ? true : smtp_port === 587 ? false : null)
  const imap_host =
    provider_family === 'microsoft365'
      ? null
      : parseNullableString(body?.imap_host || body?.imapHost)
  const imap_port =
    provider_family === 'microsoft365'
      ? null
      : parseNullableInteger(body?.imap_port || body?.imapPort)
  const imap_secure =
    provider_family === 'microsoft365'
      ? null
      : parseNullableBoolean(body?.imap_secure ?? body?.imapSecure) ??
        (imap_port === 993 ? true : imap_port === 143 ? false : null)

  const authTypeRaw = String(body?.auth_type || body?.authType || '').trim().toLowerCase()
  const auth_type =
    provider_family === 'microsoft365'
      ? 'oauth2'
      : authTypeRaw === 'app_password'
        ? 'app_password'
        : 'basic'

  const requestedReadMethod = String(body?.read_method || body?.readMethod || '').trim().toLowerCase()
  const requestedSendMethod = String(body?.send_method || body?.sendMethod || '').trim().toLowerCase()

  const read_method =
    provider_family === 'microsoft365'
      ? 'graph'
      : requestedReadMethod === 'none'
        ? 'none'
        : imap_host
          ? 'imap'
          : 'none'

  const send_method =
    provider_family === 'microsoft365'
      ? 'graph'
      : requestedSendMethod === 'none'
        ? 'none'
        : smtp_host
          ? 'smtp'
          : 'none'

  return {
    provider_family,
    auth_type,
    read_method,
    send_method,
    email_address,
    username,
    password,
    smtp_host,
    smtp_port,
    smtp_secure,
    imap_host,
    imap_port,
    imap_secure,
  }
}

function hasAnyEmailConfig(payload: EmailSettingsPayload): boolean {
  return !!(
    payload.email_address ||
    payload.username ||
    payload.password ||
    payload.smtp_host ||
    payload.imap_host ||
    payload.provider_family === 'microsoft365'
  )
}

async function upsertEmailSettingsRecord(
  integrationId: string,
  payload: EmailSettingsPayload,
  status: string
): Promise<void> {
  const { error } = await supabase.from('tb_email_integration_settings').upsert(
    {
      integration_id: integrationId,
      provider_family: payload.provider_family,
      auth_type: payload.auth_type,
      read_method: payload.read_method,
      send_method: payload.send_method,
      email_address: payload.email_address,
      username: payload.username,
      smtp_host: payload.smtp_host,
      smtp_port: payload.smtp_port,
      smtp_secure: payload.smtp_secure,
      imap_host: payload.imap_host,
      imap_port: payload.imap_port,
      imap_secure: payload.imap_secure,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'integration_id' }
  )

  if (error) {
    throw error
  }
}

function buildEmailIntegrationResponse(config: Awaited<ReturnType<typeof loadMailIntegrationConfig>>) {
  return {
    id: config.integrationId,
    provider: config.provider,
    provider_family: config.providerFamily,
    auth_type: config.authType,
    read_method: config.readMethod,
    send_method: config.sendMethod,
    email_address: config.emailAddress || null,
    username: config.username || null,
    password: config.password || null,
    smtp_host: config.smtpHost || null,
    smtp_port: config.smtpPort || null,
    smtp_secure: config.smtpSecure ?? null,
    imap_host: config.imapHost || null,
    imap_port: config.imapPort || null,
    imap_secure: config.imapSecure ?? null,
    status: config.status || null,
    can_read: config.canRead,
    can_send: config.canSend,
    has_access_token: !!config.accessToken,
    has_refresh_token: !!config.refreshToken,
  }
}

export async function listEmailIntegrations(req: Request, res: Response) {
  try {
    const authenticatedEmail = String(req.user?.email || '').trim()
    if (!authenticatedEmail) {
      return res.status(401).json({ error: 'Usuario nao autenticado.' })
    }

    const { platformUser } = await getCurrentOwnedEmailContext(authenticatedEmail)
    const rows = await loadCandidateEmailIntegrations()
    const ownedRows = rows.filter(
      (row) =>
        isOwnedEmailIntegration(row, platformUser.id, platformUser.companies_id) &&
        isEmailIntegrationCandidate(row)
    )

    const integrations = await Promise.all(
      ownedRows.map(async (row) => {
        try {
          const config = await loadMailIntegrationConfig(row.id)
          return buildEmailIntegrationResponse(config)
        } catch {
          return null
        }
      })
    )

    return res.json({
      success: true,
      integrations: integrations.filter(Boolean),
    })
  } catch (error: any) {
    logger.error('[listEmailIntegrations] Erro ao listar integracoes de email', {
      error: error?.message || error,
    })
    return res.status(500).json({
      error: 'Nao foi possivel listar as integracoes de email.',
      details: error?.message || String(error),
    })
  }
}

export async function getCurrentEmailIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = String(req.user?.email || '').trim()
    if (!authenticatedEmail) {
      return res.status(401).json({ error: 'Usuario nao autenticado.' })
    }

    const { integration } = await getCurrentOwnedEmailContext(authenticatedEmail)
    if (!integration?.id) {
      return res.json({ success: true, integration: null })
    }

    const config = await loadMailIntegrationConfig(integration.id)
    return res.json({ success: true, integration: buildEmailIntegrationResponse(config) })
  } catch (error: any) {
    logger.error('[getCurrentEmailIntegration] Erro ao carregar integracao de email atual', {
      error: error?.message || error,
    })
    return res.status(500).json({
      error: 'Nao foi possivel carregar a integracao de email atual.',
      details: error?.message || String(error),
    })
  }
}

export async function upsertCurrentEmailIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = String(req.user?.email || '').trim()
    if (!authenticatedEmail) {
      return res.status(401).json({ error: 'Usuario nao autenticado.' })
    }

    const payload = normalizeEmailPayload(req.body || {})
    const { platformUser, integration } = await getCurrentOwnedEmailContext(authenticatedEmail)

    if (!hasAnyEmailConfig(payload)) {
      return res.json({ success: true, integration: null })
    }

    const provider = payload.provider_family === 'microsoft365' ? 'microsoft365' : 'email'
    const emailAddress = payload.email_address || payload.username
    const preservedPassword = payload.password || integration?.app_key || null
    let integrationId = integration?.id || null

    if (integrationId) {
      const { error } = await supabase
        .from('tb_integrations')
        .update({
          provider,
          user_id: platformUser.id,
          companies_id: platformUser.companies_id,
          email: emailAddress,
          smtp_host: payload.smtp_host,
          smtp_port: payload.smtp_port,
          app_key: preservedPassword,
        })
        .eq('id', integrationId)

      if (error) {
        throw error
      }
    } else {
      const { data, error } = await supabase
        .from('tb_integrations')
        .insert({
          provider,
          user_id: platformUser.id,
          companies_id: platformUser.companies_id,
          email: emailAddress,
          smtp_host: payload.smtp_host,
          smtp_port: payload.smtp_port,
          app_key: preservedPassword,
        })
        .select('id')
        .single()

      if (error || !data?.id) {
        throw error || new Error('Nao foi possivel criar a integracao de email.')
      }

      integrationId = data.id
    }

    if (!integrationId) {
      throw new Error('Nao foi possivel identificar a integracao de email apos salvar.')
    }

    try {
      await upsertEmailSettingsRecord(
        integrationId,
        payload,
        payload.provider_family === 'microsoft365' ? 'connected' : 'configured'
      )
    } catch (settingsError: any) {
      if (isMissingEmailSettingsTable(settingsError)) {
        return res.status(500).json({
          error: 'Tabela de configuracao avancada de email nao encontrada.',
          details: 'Execute a migration de email multi-provider antes de salvar configuracoes IMAP/SMTP.',
          code: 'EMAIL_SETTINGS_TABLE_MISSING',
        })
      }
      throw settingsError
    }

    const config = await loadMailIntegrationConfig(integrationId)
    return res.json({ success: true, integration: buildEmailIntegrationResponse(config) })
  } catch (error: any) {
    logger.error('[upsertCurrentEmailIntegration] Erro ao salvar integracao atual de email', {
      error: error?.message || error,
    })
    return res.status(500).json({
      error: 'Nao foi possivel salvar a integracao de email.',
      details: error?.message || String(error),
    })
  }
}

export async function testCurrentEmailIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = String(req.user?.email || '').trim()
    if (!authenticatedEmail) {
      return res.status(401).json({ error: 'Usuario nao autenticado.' })
    }

    const { integration } = await getCurrentOwnedEmailContext(authenticatedEmail)
    if (!integration?.id) {
      return res.status(404).json({ error: 'Nenhuma integracao de email encontrada para testar.' })
    }

    const result = await testMailIntegrationConnection(integration.id)

    try {
      const currentConfig = await loadMailIntegrationConfig(integration.id)
      await upsertEmailSettingsRecord(
        integration.id,
        {
          provider_family:
            currentConfig.providerFamily === 'microsoft365' ? 'microsoft365' : 'generic_imap_smtp',
          auth_type:
            currentConfig.authType === 'oauth2'
              ? 'oauth2'
              : currentConfig.authType === 'app_password'
                ? 'app_password'
                : 'basic',
          read_method: currentConfig.readMethod,
          send_method: currentConfig.sendMethod,
          email_address: currentConfig.emailAddress || null,
          username: currentConfig.username || null,
          password: currentConfig.password || null,
          smtp_host: currentConfig.smtpHost || null,
          smtp_port: currentConfig.smtpPort || null,
          smtp_secure: currentConfig.smtpSecure ?? null,
          imap_host: currentConfig.imapHost || null,
          imap_port: currentConfig.imapPort || null,
          imap_secure: currentConfig.imapSecure ?? null,
        },
        result.success ? 'connected' : 'error'
      )
    } catch (settingsError: any) {
      if (!isMissingEmailSettingsTable(settingsError)) {
        throw settingsError
      }
    }

    return res.json({ success: result.success, result })
  } catch (error: any) {
    logger.error('[testCurrentEmailIntegration] Erro ao testar integracao atual de email', {
      error: error?.message || error,
    })
    return res.status(500).json({
      error: 'Nao foi possivel testar a integracao de email.',
      details: error?.message || String(error),
    })
  }
}
