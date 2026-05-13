import logger from '../../../lib/logger'
import { supabase } from '../../../lib/supabase'
import { getUserIdAndCompanyIdByEmail } from '../../../utils/company-helper'
import {
  CalendlyCurrentUserResource,
  CalendlyEventTypeMapping,
  CalendlyIntegrationConfig,
  CalendlyIntegrationResponse,
  CalendlyWebhookScope,
} from './calendly.types'

type IntegrationRow = {
  id: string
  provider?: string | null
  email?: string | null
  access_token?: string | null
  user_id?: string | null
  companies_id?: string | null
  metadata?: Record<string, unknown> | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function normalizeBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  return fallback
}

function normalizeMappings(value: unknown): CalendlyEventTypeMapping[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => {
      const record = asRecord(item)
      if (!record) return null
      const specialty = String(record.specialty || '').trim()
      const eventTypeUri = String(record.eventTypeUri || record.event_type_uri || '').trim()
      const eventTypeName = String(record.eventTypeName || record.event_type_name || '').trim()
      if (!specialty || !eventTypeUri || !eventTypeName) return null
      return {
        id: String(record.id || `mapping-${index + 1}`).trim(),
        specialty,
        eventTypeUri,
        eventTypeName,
        doctor: String(record.doctor || '').trim() || null,
        unit: String(record.unit || '').trim() || null,
        consultationType: String(record.consultationType || record.consultation_type || '').trim() || null,
        locationKind: String(record.locationKind || record.location_kind || '').trim() || null,
        locationLabel: String(record.locationLabel || record.location_label || '').trim() || null,
        timezone: String(record.timezone || '').trim() || null,
        active: normalizeBool(record.active, true),
      } satisfies CalendlyEventTypeMapping
    })
    .filter(Boolean) as CalendlyEventTypeMapping[]
}

export function mapCalendlyIntegrationConfig(
  row: IntegrationRow
): CalendlyIntegrationConfig {
  const metadata = asRecord(row.metadata)
  return {
    integrationId: row.id,
    companyId: String(row.companies_id || '').trim() || null,
    userId: String(row.user_id || '').trim() || null,
    provider: String(row.provider || 'calendly').trim() || 'calendly',
    accessToken: String(row.access_token || '').trim() || null,
    emailAddress: String(row.email || '').trim() || null,
    ownerUri: String(metadata?.owner_uri || '').trim() || null,
    organizationUri: String(metadata?.organization_uri || '').trim() || null,
    schedulingUrl: String(metadata?.scheduling_url || '').trim() || null,
    webhookScope: String(metadata?.webhook_scope || 'organization').trim() === 'user' ? 'user' : 'organization',
    webhookBaseUrl: String(metadata?.webhook_base_url || '').trim() || null,
    webhookSigningKey: String(metadata?.webhook_signing_key || '').trim() || null,
    webhookSubscriptionUri: String(metadata?.webhook_subscription_uri || '').trim() || null,
    defaultTimezone: String(metadata?.default_timezone || '').trim() || null,
    status: String(metadata?.status || '').trim() || null,
    isDefault: normalizeBool(metadata?.is_default, false),
    isActive: normalizeBool(metadata?.is_active, true),
    lastTestAt: String(metadata?.last_test_at || '').trim() || null,
    lastSyncAt: String(metadata?.last_sync_at || '').trim() || null,
    lastWebhookSyncAt: String(metadata?.last_webhook_sync_at || '').trim() || null,
    eventTypeMappings: normalizeMappings(metadata?.event_type_mappings),
    rawIntegration: row as unknown as Record<string, unknown>,
    rawMetadata: metadata,
  }
}

export function buildCalendlyIntegrationResponse(
  config: CalendlyIntegrationConfig
): CalendlyIntegrationResponse {
  return {
    id: config.integrationId,
    provider: config.provider || 'calendly',
    email_address: config.emailAddress || null,
    owner_uri: config.ownerUri || null,
    organization_uri: config.organizationUri || null,
    scheduling_url: config.schedulingUrl || null,
    webhook_scope: config.webhookScope,
    webhook_base_url: config.webhookBaseUrl || null,
    webhook_subscription_uri: config.webhookSubscriptionUri || null,
    default_timezone: config.defaultTimezone || null,
    status: config.isActive === false ? 'disabled' : String(config.status || (config.accessToken ? 'configured' : 'draft')),
    is_default: config.isDefault === true,
    is_active: config.isActive !== false,
    has_access_token: !!String(config.accessToken || '').trim(),
    last_test_at: config.lastTestAt || null,
    last_sync_at: config.lastSyncAt || null,
    last_webhook_sync_at: config.lastWebhookSyncAt || null,
    event_type_mappings: config.eventTypeMappings || [],
  }
}

function buildMetadataFromConfig(config: {
  ownerUri?: string | null
  organizationUri?: string | null
  schedulingUrl?: string | null
  webhookScope?: CalendlyWebhookScope
  webhookBaseUrl?: string | null
  webhookSigningKey?: string | null
  webhookSubscriptionUri?: string | null
  defaultTimezone?: string | null
  status?: string | null
  isDefault?: boolean
  isActive?: boolean
  lastTestAt?: string | null
  lastSyncAt?: string | null
  lastWebhookSyncAt?: string | null
  eventTypeMappings?: CalendlyEventTypeMapping[]
}) {
  return {
    provider_family: 'calendar',
    provider_preset: 'calendly',
    owner_uri: config.ownerUri || null,
    organization_uri: config.organizationUri || null,
    scheduling_url: config.schedulingUrl || null,
    webhook_scope: config.webhookScope || 'organization',
    webhook_base_url: config.webhookBaseUrl || null,
    webhook_signing_key: config.webhookSigningKey || null,
    webhook_subscription_uri: config.webhookSubscriptionUri || null,
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

export async function loadCalendlyIntegrationConfig(integrationId: string): Promise<CalendlyIntegrationConfig> {
  const { data, error } = await supabase
    .from('tb_integrations')
    .select('id, provider, email, access_token, user_id, companies_id, metadata')
    .eq('id', integrationId)
    .eq('provider', 'calendly')
    .maybeSingle()

  if (error || !data) {
    throw new Error('Integracao do Calendly nao encontrada.')
  }

  return mapCalendlyIntegrationConfig(data as IntegrationRow)
}

export async function listCalendlyIntegrationConfigsForUser(userEmail: string): Promise<CalendlyIntegrationConfig[]> {
  const { userId, companyId } = await getUserIdAndCompanyIdByEmail(userEmail)
  if (!userId) return []

  let query = supabase
    .from('tb_integrations')
    .select('id, provider, email, access_token, user_id, companies_id, metadata')
    .eq('provider', 'calendly')
    .order('created_at', { ascending: false })

  query = companyId ? query.eq('companies_id', companyId) : query.eq('user_id', userId)
  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data || []).map((row) => mapCalendlyIntegrationConfig(row as IntegrationRow))
}

export async function persistCalendlyIntegrationForUser(
  userEmail: string,
  body: {
    integrationId?: string | null
    accessToken?: string | null
    emailAddress?: string | null
    ownerUri?: string | null
    organizationUri?: string | null
    schedulingUrl?: string | null
    webhookScope?: CalendlyWebhookScope
    webhookBaseUrl?: string | null
    webhookSigningKey?: string | null
    webhookSubscriptionUri?: string | null
    defaultTimezone?: string | null
    status?: string | null
    isDefault?: boolean
    isActive?: boolean
    lastTestAt?: string | null
    lastSyncAt?: string | null
    lastWebhookSyncAt?: string | null
    eventTypeMappings?: CalendlyEventTypeMapping[]
  }
): Promise<CalendlyIntegrationConfig> {
  const { userId, companyId } = await getUserIdAndCompanyIdByEmail(userEmail)
  if (!userId) {
    throw new Error('Usuario autenticado nao encontrado para salvar integracao do Calendly.')
  }

  const metadata = buildMetadataFromConfig(body)
  const payload = {
    provider: 'calendly',
    email: String(body.emailAddress || userEmail || '').trim() || null,
    access_token: String(body.accessToken || '').trim() || null,
    user_id: userId,
    companies_id: companyId,
    metadata,
  }

  const integrationId = String(body.integrationId || '').trim()
  if (integrationId) {
    const { error } = await supabase
      .from('tb_integrations')
      .update(payload)
      .eq('id', integrationId)
      .eq('provider', 'calendly')

    if (error) throw error
    if (body.isDefault) {
      await setCalendlyIntegrationDefaultForUser(userEmail, integrationId)
    }
    return loadCalendlyIntegrationConfig(integrationId)
  }

  const { data, error } = await supabase
    .from('tb_integrations')
    .insert(payload)
    .select('id')
    .single()

  if (error || !data?.id) throw error || new Error('Nao foi possivel criar a integracao do Calendly.')

  if (body.isDefault) {
    await setCalendlyIntegrationDefaultForUser(userEmail, data.id)
  }

  return loadCalendlyIntegrationConfig(data.id)
}

export async function setCalendlyIntegrationDefaultForUser(userEmail: string, integrationId: string): Promise<void> {
  const { userId, companyId } = await getUserIdAndCompanyIdByEmail(userEmail)
  if (!userId) throw new Error('Usuario nao encontrado.')

  const configs = await listCalendlyIntegrationConfigsForUser(userEmail)
  for (const config of configs) {
    const nextMetadata = {
      ...(config.rawMetadata || {}),
      ...buildMetadataFromConfig({
        ownerUri: config.ownerUri,
        organizationUri: config.organizationUri,
        schedulingUrl: config.schedulingUrl,
        webhookScope: config.webhookScope,
        webhookBaseUrl: config.webhookBaseUrl,
        webhookSigningKey: config.webhookSigningKey,
        webhookSubscriptionUri: config.webhookSubscriptionUri,
        defaultTimezone: config.defaultTimezone,
        status: config.status,
        isDefault: config.integrationId === integrationId,
        isActive: config.isActive,
        lastTestAt: config.lastTestAt,
        lastSyncAt: config.lastSyncAt,
        lastWebhookSyncAt: config.lastWebhookSyncAt,
        eventTypeMappings: config.eventTypeMappings,
      }),
    }
    let query = supabase.from('tb_integrations').update({ metadata: nextMetadata }).eq('id', config.integrationId)
    query = companyId ? query.eq('companies_id', companyId) : query.eq('user_id', userId)
    const { error } = await query
    if (error) throw error
  }
}

export async function setCalendlyIntegrationActiveForUser(
  userEmail: string,
  integrationId: string,
  isActive: boolean
): Promise<CalendlyIntegrationConfig> {
  const config = await loadCalendlyIntegrationConfig(integrationId)
  const metadata = {
    ...(config.rawMetadata || {}),
    ...buildMetadataFromConfig({
      ownerUri: config.ownerUri,
      organizationUri: config.organizationUri,
      schedulingUrl: config.schedulingUrl,
      webhookScope: config.webhookScope,
      webhookBaseUrl: config.webhookBaseUrl,
      webhookSigningKey: config.webhookSigningKey,
      webhookSubscriptionUri: config.webhookSubscriptionUri,
      defaultTimezone: config.defaultTimezone,
      status: isActive ? config.status || 'configured' : 'disabled',
      isDefault: config.isDefault,
      isActive,
      lastTestAt: config.lastTestAt,
      lastSyncAt: config.lastSyncAt,
      lastWebhookSyncAt: config.lastWebhookSyncAt,
      eventTypeMappings: config.eventTypeMappings,
    }),
  }
  const { userId, companyId } = await getUserIdAndCompanyIdByEmail(userEmail)
  let query = supabase.from('tb_integrations').update({ metadata }).eq('id', integrationId).eq('provider', 'calendly')
  query = companyId ? query.eq('companies_id', companyId) : query.eq('user_id', userId || '')
  const { error } = await query
  if (error) throw error
  return loadCalendlyIntegrationConfig(integrationId)
}

export async function deleteCalendlyIntegrationForUser(userEmail: string, integrationId: string): Promise<{ deleted: boolean }> {
  const { userId, companyId } = await getUserIdAndCompanyIdByEmail(userEmail)
  if (!userId) throw new Error('Usuario nao encontrado.')
  let query = supabase.from('tb_integrations').delete().eq('id', integrationId).eq('provider', 'calendly')
  query = companyId ? query.eq('companies_id', companyId) : query.eq('user_id', userId)
  const { error } = await query
  if (error) throw error
  return { deleted: true }
}

export async function updateCalendlyIntegrationMetadata(
  integrationId: string,
  partial: Partial<{
    emailAddress: string | null
    ownerUri: string | null
    organizationUri: string | null
    schedulingUrl: string | null
    webhookScope: CalendlyWebhookScope
    webhookBaseUrl: string | null
    webhookSigningKey: string | null
    webhookSubscriptionUri: string | null
    defaultTimezone: string | null
    status: string | null
    isDefault: boolean
    isActive: boolean
    lastTestAt: string | null
    lastSyncAt: string | null
    lastWebhookSyncAt: string | null
    eventTypeMappings: CalendlyEventTypeMapping[]
  }>
): Promise<CalendlyIntegrationConfig> {
  const config = await loadCalendlyIntegrationConfig(integrationId)
  const merged = {
    emailAddress: partial.emailAddress ?? config.emailAddress ?? null,
    ownerUri: partial.ownerUri ?? config.ownerUri ?? null,
    organizationUri: partial.organizationUri ?? config.organizationUri ?? null,
    schedulingUrl: partial.schedulingUrl ?? config.schedulingUrl ?? null,
    webhookScope: partial.webhookScope ?? config.webhookScope,
    webhookBaseUrl: partial.webhookBaseUrl ?? config.webhookBaseUrl ?? null,
    webhookSigningKey: partial.webhookSigningKey ?? config.webhookSigningKey ?? null,
    webhookSubscriptionUri: partial.webhookSubscriptionUri ?? config.webhookSubscriptionUri ?? null,
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
  const updatePayload: Record<string, unknown> = { metadata }
  if (partial.emailAddress !== undefined) {
    updatePayload.email = partial.emailAddress
  }

  const { error } = await supabase
    .from('tb_integrations')
    .update(updatePayload)
    .eq('id', integrationId)
    .eq('provider', 'calendly')

  if (error) throw error

  return loadCalendlyIntegrationConfig(integrationId)
}

export async function hydrateCalendlyCurrentUser(
  integrationId: string,
  resource: CalendlyCurrentUserResource
): Promise<CalendlyIntegrationConfig> {
  return updateCalendlyIntegrationMetadata(integrationId, {
    emailAddress: String(resource.email || '').trim() || null,
    ownerUri: String(resource.uri || '').trim() || null,
    organizationUri: String(resource.current_organization || '').trim() || null,
    schedulingUrl: String(resource.scheduling_url || '').trim() || null,
    defaultTimezone: String(resource.timezone || '').trim() || null,
    status: 'connected',
    lastTestAt: new Date().toISOString(),
  })
}

export async function logCalendlyWebhookSync(
  integrationId: string,
  input: { status?: string | null; webhookSubscriptionUri?: string | null }
): Promise<void> {
  try {
    await updateCalendlyIntegrationMetadata(integrationId, {
      status: input.status || 'connected',
      webhookSubscriptionUri: input.webhookSubscriptionUri,
      lastWebhookSyncAt: new Date().toISOString(),
    })
  } catch (error: any) {
    logger.warn('[calendly.repository] Falha ao salvar metadata do webhook', {
      integrationId,
      error: error?.message || error,
    })
  }
}

