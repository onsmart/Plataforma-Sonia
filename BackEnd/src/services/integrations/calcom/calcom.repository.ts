import logger from '../../../lib/logger'
import { supabase } from '../../../lib/supabase'
import { getUserIdAndCompanyIdByEmail } from '../../../utils/company-helper'
import { resolvePublicBackendBaseUrl } from '../../../utils/public-backend-url'
import { CAL_COM_DEFAULT_BASE_URL } from './calcom.client'
import {
  CalComEventTypeMapping,
  CalComIntegrationConfig,
  CalComIntegrationResponse,
} from './calcom.types'

type IntegrationRow = {
  id: string
  provider?: string | null
  email?: string | null
  access_token?: string | null
  app_key?: string | null
  user_id?: string | null
  companies_id?: string | null
  metadata?: Record<string, unknown> | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function parseSerializedMetadata(value: unknown): Record<string, unknown> | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  try {
    return asRecord(JSON.parse(raw))
  } catch {
    return null
  }
}

function normalizeBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const n = value.trim().toLowerCase()
    if (n === 'true' || n === '1') return true
    if (n === 'false' || n === '0') return false
  }
  return fallback
}

function normalizeMappings(value: unknown): CalComEventTypeMapping[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => {
      const record = asRecord(item)
      if (!record) return null
      const specialty = String(record.specialty || '').trim()
      const eventTypeName = String(record.eventTypeName || record.event_type_name || '').trim()
      const rawId = record.eventTypeId ?? record.event_type_id
      const eventTypeId = Number(rawId)
      if (!specialty || !eventTypeName || !Number.isFinite(eventTypeId) || eventTypeId <= 0) return null
      return {
        id: String(record.id || `mapping-${index + 1}`).trim(),
        specialty,
        eventTypeId,
        eventTypeName,
        eventTypeSlug: String(record.eventTypeSlug || record.event_type_slug || '').trim() || null,
        doctor: String(record.doctor || '').trim() || null,
        unit: String(record.unit || '').trim() || null,
        consultationType: String(record.consultationType || record.consultation_type || '').trim() || null,
        locationKind: String(record.locationKind || record.location_kind || '').trim() || null,
        locationLabel: String(record.locationLabel || record.location_label || '').trim() || null,
        timezone: String(record.timezone || '').trim() || null,
        active: normalizeBool(record.active, true),
      } satisfies CalComEventTypeMapping
    })
    .filter(Boolean) as CalComEventTypeMapping[]
}

function isCalComIntegrationRow(row: IntegrationRow): boolean {
  const provider = String(row.provider || '').trim().toLowerCase()
  if (provider === 'calcom') return true
  const metadata = asRecord(row.metadata) || parseSerializedMetadata(row.app_key)
  return String(metadata?.provider_preset || '').trim().toLowerCase() === 'calcom'
}

export function mapCalComIntegrationConfig(row: IntegrationRow): CalComIntegrationConfig {
  const metadata = asRecord(row.metadata) || parseSerializedMetadata(row.app_key)
  return {
    integrationId: row.id,
    companyId: String(row.companies_id || '').trim() || null,
    userId: String(row.user_id || '').trim() || null,
    provider: 'calcom',
    apiKey: String(row.access_token || '').trim() || null,
    baseUrl: String(metadata?.base_url || '').trim() || CAL_COM_DEFAULT_BASE_URL,
    emailAddress: String(row.email || '').trim() || null,
    calUsername: String(metadata?.cal_username || '').trim() || null,
    webhookSecret: String(metadata?.webhook_secret || '').trim() || null,
    webhookSubscriptionId: String(metadata?.webhook_subscription_id || '').trim() || null,
    webhookCallbackUrl: String(metadata?.webhook_callback_url || '').trim() || null,
    defaultTimezone: String(metadata?.default_timezone || '').trim() || null,
    status: String(metadata?.status || '').trim() || null,
    isDefault: normalizeBool(metadata?.is_default, false),
    isActive: normalizeBool(metadata?.is_active, true),
    lastTestAt: String(metadata?.last_test_at || '').trim() || null,
    lastSyncAt: String(metadata?.last_sync_at || '').trim() || null,
    lastWebhookSyncAt: String(metadata?.last_webhook_sync_at || '').trim() || null,
    eventTypeMappings: normalizeMappings(metadata?.event_type_mappings),
    rawMetadata: metadata,
  }
}

export function buildCalComIntegrationResponse(
  config: CalComIntegrationConfig
): CalComIntegrationResponse {
  return {
    id: config.integrationId,
    provider: 'calcom',
    email_address: config.emailAddress || null,
    cal_username: config.calUsername || null,
    base_url: config.baseUrl || CAL_COM_DEFAULT_BASE_URL,
    webhook_callback_url: config.webhookCallbackUrl || null,
    webhook_subscription_id: config.webhookSubscriptionId || null,
    default_timezone: config.defaultTimezone || null,
    status: config.isActive === false
      ? 'disabled'
      : String(config.status || (config.apiKey ? 'configured' : 'draft')),
    is_default: config.isDefault === true,
    is_active: config.isActive !== false,
    has_api_key: !!String(config.apiKey || '').trim(),
    last_test_at: config.lastTestAt || null,
    last_sync_at: config.lastSyncAt || null,
    last_webhook_sync_at: config.lastWebhookSyncAt || null,
    event_type_mappings: config.eventTypeMappings || [],
  }
}

function buildMetadataFromConfig(config: {
  baseUrl?: string | null
  calUsername?: string | null
  webhookSecret?: string | null
  webhookSubscriptionId?: string | null
  webhookCallbackUrl?: string | null
  defaultTimezone?: string | null
  status?: string | null
  isDefault?: boolean
  isActive?: boolean
  lastTestAt?: string | null
  lastSyncAt?: string | null
  lastWebhookSyncAt?: string | null
  eventTypeMappings?: CalComEventTypeMapping[]
}): Record<string, unknown> {
  return {
    provider_family: 'calendar',
    provider_preset: 'calcom',
    base_url: config.baseUrl || CAL_COM_DEFAULT_BASE_URL,
    cal_username: config.calUsername || null,
    webhook_secret: config.webhookSecret || null,
    webhook_subscription_id: config.webhookSubscriptionId || null,
    webhook_callback_url: config.webhookCallbackUrl || null,
    default_timezone: config.defaultTimezone || null,
    status: config.status || 'configured',
    is_default: config.isDefault === true,
    is_active: config.isActive !== false,
    last_test_at: config.lastTestAt || null,
    last_sync_at: config.lastSyncAt || null,
    last_webhook_sync_at: config.lastWebhookSyncAt || null,
    event_type_mappings: config.eventTypeMappings || [],
  }
}

export async function loadCalComIntegrationConfig(integrationId: string): Promise<CalComIntegrationConfig> {
  const id = String(integrationId || '').trim()
  if (!id) throw new Error('Integracao Cal.com nao encontrada.')

  const { data, error } = await supabase
    .from('tb_integrations')
    .select('id, provider, email, access_token, app_key, user_id, companies_id, metadata')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    logger.error('[calcom.repository] Erro ao carregar integracao', { integrationId: id, message: error.message })
    throw new Error('Integracao Cal.com nao encontrada.')
  }
  if (!data || !isCalComIntegrationRow(data as IntegrationRow)) {
    throw new Error('Integracao Cal.com nao encontrada.')
  }
  return mapCalComIntegrationConfig(data as IntegrationRow)
}

export async function listCalComIntegrationConfigsForUser(
  userEmail: string
): Promise<CalComIntegrationConfig[]> {
  const { userId, companyId } = await getUserIdAndCompanyIdByEmail(userEmail)
  if (!userId) return []

  let query = supabase
    .from('tb_integrations')
    .select('id, provider, email, access_token, app_key, user_id, companies_id, metadata')
    .order('created_at', { ascending: false })

  query = companyId ? query.eq('companies_id', companyId) : query.eq('user_id', userId)
  const { data, error } = await query
  if (error) throw error

  return (data || [])
    .filter((row) => isCalComIntegrationRow(row as IntegrationRow))
    .map((row) => mapCalComIntegrationConfig(row as IntegrationRow))
}

export async function resolveCalComIntegrationIdForCompany(
  companyId: string
): Promise<string | null> {
  const cid = String(companyId || '').trim()
  if (!cid) return null

  const { data, error } = await supabase
    .from('tb_integrations')
    .select('id, provider, app_key, metadata')
    .eq('companies_id', cid)
    .order('created_at', { ascending: false })

  if (error || !data?.length) return null
  const match = data.find((row) => isCalComIntegrationRow(row as IntegrationRow))
  return match?.id ? String(match.id) : null
}

export async function persistCalComIntegrationForUser(
  userEmail: string,
  body: {
    integrationId?: string | null
    apiKey?: string | null
    emailAddress?: string | null
    baseUrl?: string | null
    calUsername?: string | null
    webhookSecret?: string | null
    webhookSubscriptionId?: string | null
    webhookCallbackUrl?: string | null
    defaultTimezone?: string | null
    status?: string | null
    isDefault?: boolean
    isActive?: boolean
    lastTestAt?: string | null
    lastSyncAt?: string | null
    lastWebhookSyncAt?: string | null
    eventTypeMappings?: CalComEventTypeMapping[]
  }
): Promise<CalComIntegrationConfig> {
  const { userId, companyId } = await getUserIdAndCompanyIdByEmail(userEmail)
  if (!userId) throw new Error('Usuario autenticado nao encontrado para salvar integracao Cal.com.')
  if (!companyId) {
    const err = new Error('Usuario sem empresa vinculada.') as Error & { statusCode?: number }
    err.statusCode = 400
    throw err
  }

  let integrationId = String(body.integrationId || '').trim()
  const existingConfig = integrationId
    ? await loadCalComIntegrationConfig(integrationId).catch(() => null)
    : null

  if (integrationId && !existingConfig) {
    throw new Error('Integracao Cal.com nao encontrada.')
  }

  const apiKeyInput = String(body.apiKey || '').trim()
  if (!integrationId && !apiKeyInput) {
    const err = new Error('Informe a API Key do Cal.com para criar a integracao.') as Error & { statusCode?: number }
    err.statusCode = 400
    throw err
  }

  const metadata = buildMetadataFromConfig({
    baseUrl: body.baseUrl ?? existingConfig?.baseUrl ?? CAL_COM_DEFAULT_BASE_URL,
    calUsername: body.calUsername ?? existingConfig?.calUsername ?? null,
    webhookSecret: body.webhookSecret ?? existingConfig?.webhookSecret ?? null,
    webhookSubscriptionId: body.webhookSubscriptionId ?? existingConfig?.webhookSubscriptionId ?? null,
    webhookCallbackUrl: body.webhookCallbackUrl ?? existingConfig?.webhookCallbackUrl ?? null,
    defaultTimezone: body.defaultTimezone ?? existingConfig?.defaultTimezone ?? null,
    status: body.status ?? existingConfig?.status ?? null,
    isDefault: body.isDefault ?? existingConfig?.isDefault ?? false,
    isActive: body.isActive ?? existingConfig?.isActive ?? true,
    lastTestAt: body.lastTestAt ?? existingConfig?.lastTestAt ?? null,
    lastSyncAt: body.lastSyncAt ?? existingConfig?.lastSyncAt ?? null,
    lastWebhookSyncAt: body.lastWebhookSyncAt ?? existingConfig?.lastWebhookSyncAt ?? null,
    eventTypeMappings:
      body.eventTypeMappings !== undefined
        ? body.eventTypeMappings
        : (existingConfig?.eventTypeMappings ?? []),
  })

  const payload = {
    provider: 'calcom',
    email: String(body.emailAddress || userEmail || '').trim() || null,
    access_token: apiKeyInput || existingConfig?.apiKey || null,
    app_key: JSON.stringify(metadata),
    user_id: userId,
    companies_id: companyId,
    metadata,
  }

  if (integrationId) {
    const { error } = await supabase.from('tb_integrations').update(payload).eq('id', integrationId)
    if (error) throw error
    if (body.isDefault) await setCalComIntegrationDefaultForUser(userEmail, integrationId)
    return loadCalComIntegrationConfig(integrationId)
  }

  const { data, error } = await supabase.from('tb_integrations').insert(payload).select('id').single()
  if (error) throw error
  if (!data?.id) throw new Error('Nao foi possivel criar a integracao Cal.com.')

  if (body.isDefault) await setCalComIntegrationDefaultForUser(userEmail, data.id)
  return loadCalComIntegrationConfig(data.id)
}

export async function setCalComIntegrationDefaultForUser(
  userEmail: string,
  integrationId: string
): Promise<void> {
  const { userId, companyId } = await getUserIdAndCompanyIdByEmail(userEmail)
  if (!userId) throw new Error('Usuario nao encontrado.')

  const configs = await listCalComIntegrationConfigsForUser(userEmail)
  for (const config of configs) {
    const nextMetadata = {
      ...(config.rawMetadata || {}),
      ...buildMetadataFromConfig({
        ...config,
        isDefault: config.integrationId === integrationId,
      }),
    }
    let query = supabase
      .from('tb_integrations')
      .update({ metadata: nextMetadata, app_key: JSON.stringify(nextMetadata) })
      .eq('id', config.integrationId)
    query = companyId ? query.eq('companies_id', companyId) : query.eq('user_id', userId)
    const { error } = await query
    if (error) throw error
  }
}

export async function setCalComIntegrationActiveForUser(
  userEmail: string,
  integrationId: string,
  isActive: boolean
): Promise<CalComIntegrationConfig> {
  const config = await loadCalComIntegrationConfig(integrationId)
  const metadata = {
    ...(config.rawMetadata || {}),
    ...buildMetadataFromConfig({
      ...config,
      status: isActive ? config.status || 'configured' : 'disabled',
      isActive,
    }),
  }
  const { userId, companyId } = await getUserIdAndCompanyIdByEmail(userEmail)
  let query = supabase
    .from('tb_integrations')
    .update({ metadata, app_key: JSON.stringify(metadata) })
    .eq('id', integrationId)
    .eq('provider', 'calcom')
  query = companyId ? query.eq('companies_id', companyId) : query.eq('user_id', userId || '')
  const { error } = await query
  if (error) throw error
  return loadCalComIntegrationConfig(integrationId)
}

export async function deleteCalComIntegrationForUser(
  userEmail: string,
  integrationId: string
): Promise<{ deleted: boolean }> {
  const { userId, companyId } = await getUserIdAndCompanyIdByEmail(userEmail)
  if (!userId) throw new Error('Usuario nao encontrado.')
  let query = supabase.from('tb_integrations').delete().eq('id', integrationId).eq('provider', 'calcom')
  query = companyId ? query.eq('companies_id', companyId) : query.eq('user_id', userId)
  const { error } = await query
  if (error) throw error
  return { deleted: true }
}

export async function updateCalComIntegrationMetadata(
  integrationId: string,
  partial: Partial<{
    emailAddress: string | null
    calUsername: string | null
    baseUrl: string | null
    webhookSecret: string | null
    webhookSubscriptionId: string | null
    webhookCallbackUrl: string | null
    defaultTimezone: string | null
    status: string | null
    isDefault: boolean
    isActive: boolean
    lastTestAt: string | null
    lastSyncAt: string | null
    lastWebhookSyncAt: string | null
    eventTypeMappings: CalComEventTypeMapping[]
  }>
): Promise<CalComIntegrationConfig> {
  const config = await loadCalComIntegrationConfig(integrationId)
  const merged = {
    baseUrl: partial.baseUrl ?? config.baseUrl ?? CAL_COM_DEFAULT_BASE_URL,
    calUsername: partial.calUsername ?? config.calUsername ?? null,
    webhookSecret: partial.webhookSecret ?? config.webhookSecret ?? null,
    webhookSubscriptionId: partial.webhookSubscriptionId ?? config.webhookSubscriptionId ?? null,
    webhookCallbackUrl: partial.webhookCallbackUrl ?? config.webhookCallbackUrl ?? null,
    defaultTimezone: partial.defaultTimezone ?? config.defaultTimezone ?? null,
    status: partial.status ?? config.status ?? 'configured',
    isDefault: partial.isDefault ?? config.isDefault ?? false,
    isActive: partial.isActive ?? config.isActive ?? true,
    lastTestAt: partial.lastTestAt ?? config.lastTestAt ?? null,
    lastSyncAt: partial.lastSyncAt ?? config.lastSyncAt ?? null,
    lastWebhookSyncAt: partial.lastWebhookSyncAt ?? config.lastWebhookSyncAt ?? null,
    eventTypeMappings: partial.eventTypeMappings ?? config.eventTypeMappings ?? [],
  }

  const metadata = {
    ...(config.rawMetadata || {}),
    ...buildMetadataFromConfig(merged),
  }
  const updatePayload: Record<string, unknown> = { metadata, app_key: JSON.stringify(metadata) }
  if (partial.emailAddress !== undefined) updatePayload.email = partial.emailAddress

  const { error } = await supabase
    .from('tb_integrations')
    .update(updatePayload)
    .eq('id', integrationId)
    .eq('provider', 'calcom')
  if (error) throw error

  return loadCalComIntegrationConfig(integrationId)
}

export async function logCalComWebhookSync(
  integrationId: string,
  input: { status?: string | null; webhookSubscriptionId?: string | null; callbackUrl?: string | null }
): Promise<void> {
  try {
    await updateCalComIntegrationMetadata(integrationId, {
      status: input.status || 'connected',
      webhookSubscriptionId: input.webhookSubscriptionId ?? undefined,
      webhookCallbackUrl: input.callbackUrl ?? undefined,
      lastWebhookSyncAt: new Date().toISOString(),
    })
  } catch (error: any) {
    logger.warn('[calcom.repository] Falha ao salvar metadata do webhook', {
      integrationId,
      error: error?.message || error,
    })
  }
}

/** Resolve a URL pública de webhook do Cal.com (reutiliza utilitário do backend). */
export function resolveCalComWebhookBaseUrl(): string | null {
  return resolvePublicBackendBaseUrl() || null
}
