import { Request, Response } from 'express'
import logger from '../../lib/logger'
import {
  createCalendlyIntegrationForUser,
  handleCalendlyWebhookEvent,
  listCalendlyEventTypesForIntegration,
  listCalendlyIntegrationsForUser,
  removeCalendlyIntegrationForUser,
  saveCalendlyMappingsForIntegration,
  setCalendlyIntegrationEnabledForUser,
  setDefaultCalendlyIntegrationForUser,
  syncCalendlyWebhookForIntegration,
  testCalendlyIntegrationForUser,
  updateCalendlyIntegrationForUser,
} from '../../services/integrations/calendly'
import { resolveCalendlyWebhookBaseUrl } from '../../services/integrations/calendly/calendly.repository'
import {
  isDuplicateWebhookEvent,
  markWebhookEventProcessed,
} from '../../services/security/webhook-idempotency.service'
import { recordSecurityAuditEvent } from '../../services/security/audit-log.service'
import { resolvePublicBackendBaseUrl } from '../../utils/public-backend-url'

function getAuthenticatedEmail(req: Request): string {
  return String(req.user?.email || '').trim()
}

function getIntegrationId(req: Request): string {
  return String(req.params?.id || req.params?.integrationId || '').trim()
}

function inferRequestOrigin(req: Request): string {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0]?.trim()
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0]?.trim()
  const protocol = forwardedProto || req.protocol || 'http'
  const host = forwardedHost || String(req.headers.host || '').trim()
  return host ? `${protocol}://${host}` : ''
}

function handleControllerError(res: Response, scope: string, fallbackMessage: string, error: any) {
  logger.error(`[${scope}] ${fallbackMessage}`, {
    error: error?.message || error,
  })
  const statusCode = Number(error?.statusCode || error?.status || 500)
  return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    error: fallbackMessage,
    details: error?.message || String(error),
  })
}

export async function getCalendlyPublicConfig(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })

    const publicWebhookBaseUrl =
      resolveCalendlyWebhookBaseUrl() || resolvePublicBackendBaseUrl() || null

    return res.json({
      success: true,
      publicWebhookBaseUrl,
      webhookCallbackPattern: '/calendar/webhook/:integrationId',
    })
  } catch (error: any) {
    return handleControllerError(res, 'getCalendlyPublicConfig', 'Nao foi possivel carregar config do Calendly.', error)
  }
}

export async function listCalendlyIntegrations(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    const result = await listCalendlyIntegrationsForUser(authenticatedEmail)
    return res.json({ success: true, ...result })
  } catch (error: any) {
    return handleControllerError(res, 'listCalendlyIntegrations', 'Nao foi possivel listar as integracoes do Calendly.', error)
  }
}

export async function createCalendlyIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    const integration = await createCalendlyIntegrationForUser(authenticatedEmail, req.body || {})
    return res.status(201).json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(res, 'createCalendlyIntegration', 'Nao foi possivel criar a integracao do Calendly.', error)
  }
}

export async function updateCalendlyIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    if (!integrationId) return res.status(400).json({ error: 'integration_id nao informado.' })
    const integration = await updateCalendlyIntegrationForUser(authenticatedEmail, integrationId, req.body || {})
    return res.json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(res, 'updateCalendlyIntegration', 'Nao foi possivel atualizar a integracao do Calendly.', error)
  }
}

export async function testCalendlyIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    if (!integrationId) return res.status(400).json({ error: 'integration_id nao informado.' })
    const result = await testCalendlyIntegrationForUser(authenticatedEmail, integrationId)
    return res.json({ success: true, result })
  } catch (error: any) {
    return handleControllerError(res, 'testCalendlyIntegration', 'Nao foi possivel testar a integracao do Calendly.', error)
  }
}

export async function setDefaultCalendlyIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    if (!integrationId) return res.status(400).json({ error: 'integration_id nao informado.' })
    const integration = await setDefaultCalendlyIntegrationForUser(authenticatedEmail, integrationId)
    return res.json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(res, 'setDefaultCalendlyIntegration', 'Nao foi possivel definir a integracao padrao do Calendly.', error)
  }
}

export async function activateCalendlyIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    if (!integrationId) return res.status(400).json({ error: 'integration_id nao informado.' })
    const integration = await setCalendlyIntegrationEnabledForUser(authenticatedEmail, integrationId, true)
    return res.json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(res, 'activateCalendlyIntegration', 'Nao foi possivel ativar a integracao do Calendly.', error)
  }
}

export async function deactivateCalendlyIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    if (!integrationId) return res.status(400).json({ error: 'integration_id nao informado.' })
    const integration = await setCalendlyIntegrationEnabledForUser(authenticatedEmail, integrationId, false)
    return res.json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(res, 'deactivateCalendlyIntegration', 'Nao foi possivel desativar a integracao do Calendly.', error)
  }
}

export async function deleteCalendlyIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    if (!integrationId) return res.status(400).json({ error: 'integration_id nao informado.' })
    const result = await removeCalendlyIntegrationForUser(authenticatedEmail, integrationId)
    return res.json({ success: true, result })
  } catch (error: any) {
    return handleControllerError(res, 'deleteCalendlyIntegration', 'Nao foi possivel remover a integracao do Calendly.', error)
  }
}

export async function listCalendlyEventTypes(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    if (!integrationId) return res.status(400).json({ error: 'integration_id nao informado.' })
    const eventTypes = await listCalendlyEventTypesForIntegration(integrationId, authenticatedEmail)
    return res.json({ success: true, eventTypes })
  } catch (error: any) {
    return handleControllerError(res, 'listCalendlyEventTypes', 'Nao foi possivel carregar os event types do Calendly.', error)
  }
}

export async function saveCalendlyMappings(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    if (!integrationId) return res.status(400).json({ error: 'integration_id nao informado.' })
    const integration = await saveCalendlyMappingsForIntegration(
      integrationId,
      Array.isArray(req.body?.eventTypeMappings) ? req.body.eventTypeMappings : [],
      authenticatedEmail
    )
    return res.json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(res, 'saveCalendlyMappings', 'Nao foi possivel salvar os mapeamentos do Calendly.', error)
  }
}

export async function syncCalendlyWebhook(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    if (!integrationId) return res.status(400).json({ error: 'integration_id nao informado.' })
    const result = await syncCalendlyWebhookForIntegration(integrationId, inferRequestOrigin(req), authenticatedEmail)
    return res.json({ success: true, result })
  } catch (error: any) {
    return handleControllerError(res, 'syncCalendlyWebhook', 'Nao foi possivel registrar o webhook do Calendly.', error)
  }
}

export async function receiveCalendlyWebhook(req: Request, res: Response) {
  try {
    const integrationId = getIntegrationId(req)
    if (!integrationId) return res.status(400).json({ error: 'integration_id nao informado.' })

    const payload = (req.body || {}) as Record<string, unknown>
    const eventKey = String(payload.event || payload.created_at || JSON.stringify(payload).slice(0, 120))
    if (isDuplicateWebhookEvent('calendly', `${integrationId}:${eventKey}`)) {
      return res.json({ success: true, duplicate: true })
    }

    const result = await handleCalendlyWebhookEvent({
      integrationId,
      payload,
    })
    markWebhookEventProcessed('calendly', `${integrationId}:${eventKey}`)

    void recordSecurityAuditEvent({
      action: 'webhook.calendly.received',
      resourceType: 'calendly_integration',
      resourceId: integrationId,
      ipAddress: String(req.ip || ''),
      metadata: { event: String(payload.event || 'unknown') },
    })

    return res.json({ success: true, result })
  } catch (error: any) {
    void recordSecurityAuditEvent({
      action: 'webhook.calendly.error',
      resourceType: 'calendly_integration',
      resourceId: getIntegrationId(req),
      ipAddress: String(req.ip || ''),
      metadata: { message: error?.message || 'unknown' },
    })
    return handleControllerError(res, 'receiveCalendlyWebhook', 'Nao foi possivel processar o webhook do Calendly.', error)
  }
}
