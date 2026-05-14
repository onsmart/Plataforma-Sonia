import logger from '../../../lib/logger'
import {
  buildCalendlyIntegrationResponse,
  deleteCalendlyIntegrationForUser,
  hydrateCalendlyCurrentUser,
  listCalendlyIntegrationConfigsForUser,
  loadCalendlyIntegrationConfig,
  logCalendlyWebhookSync,
  persistCalendlyIntegrationForUser,
  setCalendlyIntegrationActiveForUser,
  setCalendlyIntegrationDefaultForUser,
  updateCalendlyIntegrationMetadata,
} from './calendly.repository'
import { CalendlyApiClient, CalendlyApiError } from './calendly.client'
import { CalendlyCurrentUserResource, CalendlyEventTypeMapping, CalendlyWebhookScope } from './calendly.types'

export class CalendlyWebhookSetupError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'CalendlyWebhookSetupError'
    this.statusCode = statusCode
  }
}

function isPrivateOrLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase()
  if (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.endsWith('.local')
  ) {
    return true
  }

  const parts = normalized.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false
  }

  const [first, second] = parts
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

function normalizeWebhookBaseUrl(rawBaseUrl: string) {
  const trimmed = String(rawBaseUrl || '').trim().replace(/\/+$/, '')
  if (!trimmed) {
    throw new CalendlyWebhookSetupError(
      'Informe uma Webhook base URL publica em HTTPS para registrar o webhook do Calendly.'
    )
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new CalendlyWebhookSetupError('Webhook base URL invalida. Use uma URL publica completa, por exemplo https://webhook.seudominio.com.')
  }

  if (parsed.protocol !== 'https:') {
    throw new CalendlyWebhookSetupError('O Calendly exige uma Webhook base URL publica em HTTPS.')
  }

  if (isPrivateOrLocalHostname(parsed.hostname)) {
    throw new CalendlyWebhookSetupError(
      'A Webhook base URL nao pode ser localhost, IP local ou rede privada. Use um dominio publico HTTPS acessivel pelo Calendly.'
    )
  }

  return trimmed
}

function isCalendlyPermissionError(error: unknown) {
  if (error instanceof CalendlyApiError) {
    return error.statusCode === 401 || error.statusCode === 403
  }
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase()
  return message.includes('permission') || message.includes('not authorized') || message.includes('unauthorized') || message.includes('forbidden')
}

function buildCalendlyPermissionMessage(scope: CalendlyWebhookScope) {
  if (scope === 'organization') {
    return 'O Calendly recusou o webhook no escopo organization. Use um PAT de Owner/Admin da organizacao ou altere o escopo do webhook para user.'
  }
  return 'O Calendly recusou o webhook por permissao. Gere um novo PAT com webhooks:write e permissoes de leitura dos eventos agendados, e confirme que a conta possui plano com suporte a webhooks.'
}

function ensureMappings(value: unknown): CalendlyEventTypeMapping[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
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
        active: record.active !== false,
      } satisfies CalendlyEventTypeMapping
    })
    .filter(Boolean) as CalendlyEventTypeMapping[]
}

export function normalizeCalendlyBody(body: Record<string, unknown>) {
  const webhookScope: CalendlyWebhookScope =
    String(body.webhookScope || body.webhook_scope || 'organization').trim() === 'user'
      ? 'user'
      : 'organization'
  return {
    integrationId: String(body.integrationId || body.integration_id || '').trim() || null,
    accessToken: String(body.accessToken || body.access_token || '').trim() || null,
    emailAddress: String(body.emailAddress || body.email_address || '').trim() || null,
    ownerUri: String(body.ownerUri || body.owner_uri || '').trim() || null,
    organizationUri: String(body.organizationUri || body.organization_uri || '').trim() || null,
    schedulingUrl: String(body.schedulingUrl || body.scheduling_url || '').trim() || null,
    webhookScope,
    webhookBaseUrl: String(body.webhookBaseUrl || body.webhook_base_url || '').trim() || null,
    webhookSigningKey: String(body.webhookSigningKey || body.webhook_signing_key || '').trim() || null,
    webhookSubscriptionUri: String(body.webhookSubscriptionUri || body.webhook_subscription_uri || '').trim() || null,
    defaultTimezone: String(body.defaultTimezone || body.default_timezone || '').trim() || null,
    status: String(body.status || '').trim() || null,
    isDefault: body.isDefault === true || body.is_default === true,
    isActive: body.isActive !== false && body.is_active !== false,
    eventTypeMappings: ensureMappings(body.eventTypeMappings || body.event_type_mappings),
  }
}

export async function listCalendlyIntegrationsForUser(userEmail: string) {
  const configs = await listCalendlyIntegrationConfigsForUser(userEmail)
  const integrations = configs.map((config) => buildCalendlyIntegrationResponse(config))
  const defaultIntegration = integrations.find((item) => item.is_default) || integrations[0] || null
  return { integrations, defaultIntegration }
}

export async function createCalendlyIntegrationForUser(userEmail: string, body: Record<string, unknown>) {
  const normalized = normalizeCalendlyBody(body)
  const created = await persistCalendlyIntegrationForUser(userEmail, normalized)
  return buildCalendlyIntegrationResponse(created)
}

export async function updateCalendlyIntegrationForUser(
  userEmail: string,
  integrationId: string,
  body: Record<string, unknown>
) {
  const normalized = normalizeCalendlyBody({ ...body, integrationId })
  const updated = await persistCalendlyIntegrationForUser(userEmail, normalized)
  return buildCalendlyIntegrationResponse(updated)
}

export async function setDefaultCalendlyIntegrationForUser(userEmail: string, integrationId: string) {
  await setCalendlyIntegrationDefaultForUser(userEmail, integrationId)
  const config = await loadCalendlyIntegrationConfig(integrationId)
  return buildCalendlyIntegrationResponse(config)
}

export async function setCalendlyIntegrationEnabledForUser(userEmail: string, integrationId: string, enabled: boolean) {
  const updated = await setCalendlyIntegrationActiveForUser(userEmail, integrationId, enabled)
  return buildCalendlyIntegrationResponse(updated)
}

export async function removeCalendlyIntegrationForUser(userEmail: string, integrationId: string) {
  return deleteCalendlyIntegrationForUser(userEmail, integrationId)
}

export async function testCalendlyIntegrationForUser(userEmail: string, integrationId: string) {
  void userEmail
  const config = await loadCalendlyIntegrationConfig(integrationId)
  const client = new CalendlyApiClient(config)
  const currentUser = await client.getCurrentUser()
  const hydrated = await hydrateCalendlyCurrentUser(integrationId, currentUser)
  const eventTypes = await client.listEventTypes({
    organizationUri: hydrated.organizationUri,
    ownerUri: hydrated.ownerUri,
    active: true,
    count: 50,
  })
  return {
    success: true,
    provider: 'calendly',
    currentUser,
    eventTypesCount: eventTypes.length,
    integration: buildCalendlyIntegrationResponse(hydrated),
  }
}

export async function listCalendlyEventTypesForIntegration(integrationId: string) {
  const config = await loadCalendlyIntegrationConfig(integrationId)
  const client = new CalendlyApiClient(config)
  let currentUser: CalendlyCurrentUserResource | null = null

  if (!config.ownerUri || !config.organizationUri) {
    currentUser = await client.getCurrentUser()
    await hydrateCalendlyCurrentUser(integrationId, currentUser)
  }

  const eventTypes = await client.listEventTypes({
    organizationUri: currentUser?.current_organization || config.organizationUri,
    ownerUri: currentUser?.uri || config.ownerUri,
    active: true,
    count: 100,
  })

  return eventTypes.map((eventType) => ({
    uri: eventType.uri,
    name: eventType.name,
    slug: eventType.slug || null,
    scheduling_url: eventType.scheduling_url || null,
    active: eventType.active !== false,
    duration: eventType.duration || null,
    location_kind: eventType.location?.kind || null,
    location_label:
      eventType.location?.location ||
      eventType.location?.additional_info ||
      eventType.location?.phone_number ||
      null,
  }))
}

export async function syncCalendlyWebhookForIntegration(
  integrationId: string,
  requestOrigin?: string | null
) {
  const config = await loadCalendlyIntegrationConfig(integrationId)
  const client = new CalendlyApiClient(config)
  let ownerUri = config.ownerUri || null
  let organizationUri = config.organizationUri || null

  // Calendly requires organization even for user-scoped webhook subscriptions.
  // Refreshing on every sync avoids stale metadata after users switch scope/token.
  const currentUser = await client.getCurrentUser()
  ownerUri = currentUser.uri || ownerUri
  organizationUri = currentUser.current_organization || organizationUri
  await hydrateCalendlyCurrentUser(integrationId, currentUser)

  if (!organizationUri) {
    throw new CalendlyWebhookSetupError(
      'Nao foi possivel obter a organization URI do Calendly. Teste a conexao novamente ou gere um novo PAT para a conta correta.',
      400
    )
  }

  if ((config.webhookScope || 'organization') === 'user' && !ownerUri) {
    throw new CalendlyWebhookSetupError(
      'Nao foi possivel obter a user URI do Calendly para registrar o webhook no escopo user.',
      400
    )
  }

  const baseUrl = normalizeWebhookBaseUrl(config.webhookBaseUrl || requestOrigin || '')

  const callbackUrl = `${baseUrl}/calendar/webhook/${integrationId}`
  let resolvedWebhookScope: CalendlyWebhookScope = config.webhookScope || 'organization'
  let resource: { uri?: string | null; signing_key?: string | null }
  try {
    resource = await client.createWebhookSubscription({
      callbackUrl,
      scope: resolvedWebhookScope,
      organizationUri,
      ownerUri,
      signingKey: config.webhookSigningKey,
    })
  } catch (error) {
    if (resolvedWebhookScope === 'organization' && isCalendlyPermissionError(error)) {
      resolvedWebhookScope = 'user'
      try {
        resource = await client.createWebhookSubscription({
          callbackUrl,
          scope: resolvedWebhookScope,
          organizationUri,
          ownerUri,
          signingKey: config.webhookSigningKey,
        })
      } catch (fallbackError) {
        if (isCalendlyPermissionError(fallbackError)) {
          throw new CalendlyWebhookSetupError(buildCalendlyPermissionMessage('user'), 403)
        }
        throw fallbackError
      }
    } else if (isCalendlyPermissionError(error)) {
      throw new CalendlyWebhookSetupError(buildCalendlyPermissionMessage(resolvedWebhookScope), 403)
    } else {
      throw error
    }
  }

  await logCalendlyWebhookSync(integrationId, {
    status: 'connected',
    webhookSubscriptionUri: String(resource.uri || '').trim() || config.webhookSubscriptionUri || null,
  })

  const updated = await updateCalendlyIntegrationMetadata(integrationId, {
    webhookSubscriptionUri: String(resource.uri || '').trim() || config.webhookSubscriptionUri || null,
    webhookSigningKey: String(resource.signing_key || '').trim() || config.webhookSigningKey || null,
    webhookScope: resolvedWebhookScope,
    status: 'connected',
    lastWebhookSyncAt: new Date().toISOString(),
  })

  return {
    success: true,
    callbackUrl,
    webhookSubscriptionUri: updated.webhookSubscriptionUri || null,
    webhookScope: updated.webhookScope,
  }
}

export async function saveCalendlyMappingsForIntegration(
  integrationId: string,
  mappings: CalendlyEventTypeMapping[]
) {
  const updated = await updateCalendlyIntegrationMetadata(integrationId, {
    eventTypeMappings: mappings,
    lastSyncAt: new Date().toISOString(),
  })
  return buildCalendlyIntegrationResponse(updated)
}

export async function handleCalendlyWebhookEvent(params: {
  integrationId: string
  payload: Record<string, unknown>
}) {
  const payload = params.payload || {}
  const event = String(payload.event || '').trim() || 'unknown'
  const createdAt = new Date().toISOString()
  logger.info('[calendly.webhook] Evento recebido', {
    integrationId: params.integrationId,
    event,
    payload,
  })
  await updateCalendlyIntegrationMetadata(params.integrationId, {
    status: 'connected',
    lastWebhookSyncAt: createdAt,
  })
  return {
    success: true,
    event,
    receivedAt: createdAt,
  }
}
