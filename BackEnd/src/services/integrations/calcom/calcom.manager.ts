import logger from '../../../lib/logger'
import { resolvePublicBackendBaseUrl } from '../../../utils/public-backend-url'
import {
  buildCalComIntegrationResponse,
  deleteCalComIntegrationForUser,
  listCalComIntegrationConfigsForUser,
  loadCalComIntegrationConfig,
  logCalComWebhookSync,
  persistCalComIntegrationForUser,
  resolveCalComWebhookBaseUrl,
  setCalComIntegrationActiveForUser,
  setCalComIntegrationDefaultForUser,
  updateCalComIntegrationMetadata,
} from './calcom.repository'
import { CalComApiClient } from './calcom.client'
import { CalComEventTypeMapping } from './calcom.types'
import crypto from 'crypto'

export class CalComWebhookSetupError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'CalComWebhookSetupError'
    this.statusCode = statusCode
  }
}

function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

function ensureMappings(value: unknown): CalComEventTypeMapping[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const r = item as Record<string, unknown>
      const specialty = String(r.specialty || '').trim()
      const eventTypeName = String(r.eventTypeName || r.event_type_name || '').trim()
      const eventTypeId = Number(r.eventTypeId ?? r.event_type_id)
      if (!specialty || !eventTypeName || !Number.isFinite(eventTypeId) || eventTypeId <= 0) return null
      return {
        id: String(r.id || `mapping-${index + 1}`).trim(),
        specialty,
        eventTypeId,
        eventTypeName,
        eventTypeSlug: String(r.eventTypeSlug || r.event_type_slug || '').trim() || null,
        doctor: String(r.doctor || '').trim() || null,
        unit: String(r.unit || '').trim() || null,
        consultationType: String(r.consultationType || r.consultation_type || '').trim() || null,
        locationKind: String(r.locationKind || r.location_kind || '').trim() || null,
        locationLabel: String(r.locationLabel || r.location_label || '').trim() || null,
        timezone: String(r.timezone || '').trim() || null,
        active: r.active !== false,
      } satisfies CalComEventTypeMapping
    })
    .filter(Boolean) as CalComEventTypeMapping[]
}

export function normalizeCalComBody(body: Record<string, unknown>) {
  const hasMappingsField =
    Object.prototype.hasOwnProperty.call(body, 'eventTypeMappings') ||
    Object.prototype.hasOwnProperty.call(body, 'event_type_mappings')
  const rawMappings = body.eventTypeMappings ?? body.event_type_mappings

  return {
    integrationId: String(body.integrationId || body.integration_id || '').trim() || null,
    apiKey: String(body.apiKey || body.api_key || '').trim() || null,
    emailAddress: String(body.emailAddress || body.email_address || '').trim() || null,
    baseUrl: String(body.baseUrl || body.base_url || '').trim() || null,
    defaultTimezone: String(body.defaultTimezone || body.default_timezone || '').trim() || null,
    isDefault: body.isDefault === true || body.is_default === true,
    isActive: body.isActive !== false && body.is_active !== false,
    ...(hasMappingsField ? { eventTypeMappings: ensureMappings(rawMappings) } : {}),
  }
}

export async function listCalComIntegrationsForUser(userEmail: string) {
  const configs = await listCalComIntegrationConfigsForUser(userEmail)
  const integrations = configs.map((c) => buildCalComIntegrationResponse(c))
  const defaultIntegration = integrations.find((i) => i.is_default) || integrations[0] || null
  const publicWebhookBaseUrl = resolveCalComWebhookBaseUrl() || resolvePublicBackendBaseUrl() || null
  return { integrations, defaultIntegration, publicWebhookBaseUrl }
}

export async function createCalComIntegrationForUser(
  userEmail: string,
  body: Record<string, unknown>
) {
  const normalized = normalizeCalComBody(body)
  const created = await persistCalComIntegrationForUser(userEmail, normalized)
  return buildCalComIntegrationResponse(created)
}

export async function updateCalComIntegrationForUser(
  userEmail: string,
  integrationId: string,
  body: Record<string, unknown>
) {
  const normalized = normalizeCalComBody({ ...body, integrationId })
  const updated = await persistCalComIntegrationForUser(userEmail, normalized)
  return buildCalComIntegrationResponse(updated)
}

export async function setDefaultCalComIntegrationForUser(
  userEmail: string,
  integrationId: string
) {
  await setCalComIntegrationDefaultForUser(userEmail, integrationId)
  const config = await loadCalComIntegrationConfig(integrationId)
  return buildCalComIntegrationResponse(config)
}

export async function setCalComIntegrationEnabledForUser(
  userEmail: string,
  integrationId: string,
  enabled: boolean
) {
  const updated = await setCalComIntegrationActiveForUser(userEmail, integrationId, enabled)
  return buildCalComIntegrationResponse(updated)
}

export async function removeCalComIntegrationForUser(userEmail: string, integrationId: string) {
  return deleteCalComIntegrationForUser(userEmail, integrationId)
}

export async function testCalComIntegrationForUser(userEmail: string, integrationId: string) {
  const config = await loadCalComIntegrationConfig(integrationId)
  const client = new CalComApiClient(config)

  const currentUser = await client.getCurrentUser()
  const eventTypes = await client.listEventTypes()

  await updateCalComIntegrationMetadata(integrationId, {
    emailAddress: String(currentUser.email || config.emailAddress || '').trim() || null,
    calUsername: String(currentUser.username || '').trim() || null,
    status: 'connected',
    lastTestAt: new Date().toISOString(),
  })

  const updated = await loadCalComIntegrationConfig(integrationId)
  return {
    success: true,
    provider: 'calcom',
    currentUser,
    eventTypesCount: eventTypes.length,
    integration: buildCalComIntegrationResponse(updated),
  }
}

export async function listCalComEventTypesForIntegration(
  integrationId: string,
  _userEmail?: string
) {
  const config = await loadCalComIntegrationConfig(integrationId)
  const client = new CalComApiClient(config)
  const eventTypes = await client.listEventTypes()

  return eventTypes
    .filter((et) => et.hidden !== true)
    .map((et) => {
      const locationKind =
        Array.isArray(et.locations) && et.locations.length > 0
          ? String(et.locations[0]?.type || '').trim() || null
          : null
      const locationLabel =
        Array.isArray(et.locations) && et.locations.length > 0
          ? String(et.locations[0]?.address || et.locations[0]?.link || '').trim() || null
          : null
      return {
        id: et.id,
        title: et.title,
        slug: et.slug || null,
        length: et.length || null,
        description: et.description || null,
        location_kind: locationKind,
        location_label: locationLabel,
      }
    })
}

export async function syncCalComWebhookForIntegration(
  integrationId: string,
  requestOrigin?: string | null,
  _userEmail?: string
) {
  const config = await loadCalComIntegrationConfig(integrationId)
  const client = new CalComApiClient(config)

  const baseUrl = String(
    resolveCalComWebhookBaseUrl() || resolvePublicBackendBaseUrl() || requestOrigin || ''
  )
    .trim()
    .replace(/\/+$/, '')

  if (!baseUrl || !baseUrl.startsWith('https://')) {
    throw new CalComWebhookSetupError(
      'Uma URL publica HTTPS e necessaria para registrar o webhook do Cal.com. Configure BACKEND_PUBLIC_URL no .env do servidor.'
    )
  }

  const callbackUrl = `${baseUrl}/calcom/webhook/${integrationId}`
  const secret = config.webhookSecret || generateWebhookSecret()

  // Remover webhook anterior se existir
  if (config.webhookSubscriptionId) {
    try {
      const numId = Number(config.webhookSubscriptionId)
      if (Number.isFinite(numId)) {
        await client.deleteWebhook(numId)
      }
    } catch {
      // Ignora erro de deleção — pode já não existir
    }
  }

  const webhook = await client.createWebhook({
    subscriberUrl: callbackUrl,
    triggers: ['BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED'],
    secret,
  })

  await logCalComWebhookSync(integrationId, {
    status: 'connected',
    webhookSubscriptionId: String(webhook.id),
    callbackUrl,
  })

  await updateCalComIntegrationMetadata(integrationId, {
    webhookSecret: secret,
    webhookSubscriptionId: String(webhook.id),
    webhookCallbackUrl: callbackUrl,
    status: 'connected',
    lastWebhookSyncAt: new Date().toISOString(),
  })

  return {
    success: true,
    callbackUrl,
    webhookSubscriptionId: String(webhook.id),
  }
}

export async function saveCalComMappingsForIntegration(
  integrationId: string,
  mappings: CalComEventTypeMapping[],
  _userEmail?: string
) {
  const updated = await updateCalComIntegrationMetadata(integrationId, {
    eventTypeMappings: mappings,
    lastSyncAt: new Date().toISOString(),
  })
  return buildCalComIntegrationResponse(updated)
}

export async function handleCalComWebhookEvent(params: {
  integrationId: string
  payload: Record<string, unknown>
}) {
  const payload = params.payload || {}
  const triggerEvent = String(payload.triggerEvent || '').trim() || 'unknown'
  const createdAt = new Date().toISOString()

  logger.info('[calcom.webhook] Evento recebido', {
    integrationId: params.integrationId,
    triggerEvent,
  })

  await updateCalComIntegrationMetadata(params.integrationId, {
    status: 'connected',
    lastWebhookSyncAt: createdAt,
  })

  return {
    success: true,
    event: triggerEvent,
    receivedAt: createdAt,
  }
}
