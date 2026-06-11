import { Request, Response } from 'express'
import logger from '../../lib/logger'
import {
  createCalComIntegrationForUser,
  handleCalComWebhookEvent,
  listCalComEventTypesForIntegration,
  listCalComIntegrationsForUser,
  removeCalComIntegrationForUser,
  saveCalComMappingsForIntegration,
  setCalComIntegrationEnabledForUser,
  setDefaultCalComIntegrationForUser,
  syncCalComWebhookForIntegration,
  testCalComIntegrationForUser,
  updateCalComIntegrationForUser,
} from '../../services/integrations/calcom'
import {
  isDuplicateWebhookEvent,
  markWebhookEventProcessed,
} from '../../services/security/webhook-idempotency.service'

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
  logger.error(`[${scope}] ${fallbackMessage}`, { error: error?.message || error })
  const statusCode = Number(error?.statusCode || error?.status || 500)
  return res
    .status(statusCode >= 400 && statusCode < 600 ? statusCode : 500)
    .json({ error: fallbackMessage, details: error?.message || String(error) })
}

export async function listCalComIntegrations(req: Request, res: Response) {
  try {
    const email = getAuthenticatedEmail(req)
    if (!email) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    const result = await listCalComIntegrationsForUser(email)
    return res.json({ success: true, ...result })
  } catch (error: any) {
    return handleControllerError(res, 'listCalComIntegrations', 'Erro ao listar integrações Cal.com', error)
  }
}

export async function createCalComIntegration(req: Request, res: Response) {
  try {
    const email = getAuthenticatedEmail(req)
    if (!email) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    const integration = await createCalComIntegrationForUser(email, req.body || {})
    return res.status(201).json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(res, 'createCalComIntegration', 'Erro ao criar integração Cal.com', error)
  }
}

export async function updateCalComIntegration(req: Request, res: Response) {
  try {
    const email = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!email) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    const integration = await updateCalComIntegrationForUser(email, integrationId, req.body || {})
    return res.json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(res, 'updateCalComIntegration', 'Erro ao atualizar integração Cal.com', error)
  }
}

export async function testCalComIntegration(req: Request, res: Response) {
  try {
    const email = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!email) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    const result = await testCalComIntegrationForUser(email, integrationId)
    return res.json(result)
  } catch (error: any) {
    return handleControllerError(res, 'testCalComIntegration', 'Erro ao testar integração Cal.com', error)
  }
}

export async function setDefaultCalComIntegration(req: Request, res: Response) {
  try {
    const email = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!email) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    const integration = await setDefaultCalComIntegrationForUser(email, integrationId)
    return res.json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(res, 'setDefaultCalComIntegration', 'Erro ao definir padrão Cal.com', error)
  }
}

export async function activateCalComIntegration(req: Request, res: Response) {
  try {
    const email = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!email) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    const integration = await setCalComIntegrationEnabledForUser(email, integrationId, true)
    return res.json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(res, 'activateCalComIntegration', 'Erro ao ativar integração Cal.com', error)
  }
}

export async function deactivateCalComIntegration(req: Request, res: Response) {
  try {
    const email = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!email) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    const integration = await setCalComIntegrationEnabledForUser(email, integrationId, false)
    return res.json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(res, 'deactivateCalComIntegration', 'Erro ao desativar integração Cal.com', error)
  }
}

export async function deleteCalComIntegration(req: Request, res: Response) {
  try {
    const email = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!email) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    await removeCalComIntegrationForUser(email, integrationId)
    return res.json({ success: true, deleted: true })
  } catch (error: any) {
    return handleControllerError(res, 'deleteCalComIntegration', 'Erro ao remover integração Cal.com', error)
  }
}

export async function listCalComEventTypes(req: Request, res: Response) {
  try {
    const email = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!email) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    const eventTypes = await listCalComEventTypesForIntegration(integrationId, email)
    return res.json({ success: true, eventTypes })
  } catch (error: any) {
    return handleControllerError(res, 'listCalComEventTypes', 'Erro ao listar event types Cal.com', error)
  }
}

export async function saveCalComMappings(req: Request, res: Response) {
  try {
    const email = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!email) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    const mappings = Array.isArray(req.body?.mappings) ? req.body.mappings : []
    const integration = await saveCalComMappingsForIntegration(integrationId, mappings, email)
    return res.json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(res, 'saveCalComMappings', 'Erro ao salvar mapeamentos Cal.com', error)
  }
}

export async function syncCalComWebhook(req: Request, res: Response) {
  try {
    const email = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!email) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    const result = await syncCalComWebhookForIntegration(
      integrationId,
      inferRequestOrigin(req),
      email
    )
    return res.json(result)
  } catch (error: any) {
    return handleControllerError(res, 'syncCalComWebhook', 'Erro ao sincronizar webhook Cal.com', error)
  }
}

export async function receiveCalComWebhook(req: Request, res: Response) {
  try {
    const integrationId = String(req.params?.id || '').trim()
    if (!integrationId) return res.status(400).json({ error: 'integration_id obrigatório' })

    const payload = req.body || {}
    const triggerEvent = String(payload.triggerEvent || '').trim()
    const bookingUid = String(payload.payload?.uid || payload.uid || '').trim()
    if (bookingUid) {
      const eventId = `${integrationId}:${triggerEvent}:${bookingUid}`
      if (isDuplicateWebhookEvent('calcom', eventId)) {
        logger.info('[calcom.webhook] Evento duplicado ignorado', { integrationId, triggerEvent, bookingUid })
        return res.json({ success: true, duplicate: true })
      }
    }

    const result = await handleCalComWebhookEvent({ integrationId, payload })

    if (bookingUid) {
      markWebhookEventProcessed('calcom', `${integrationId}:${triggerEvent}:${bookingUid}`)
    }

    return res.json(result)
  } catch (error: any) {
    logger.error('[receiveCalComWebhook] Erro:', { error: error?.message || error })
    return res.status(500).json({ error: 'Erro ao processar webhook Cal.com' })
  }
}
