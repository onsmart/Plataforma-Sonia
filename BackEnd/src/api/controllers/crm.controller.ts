import { Request, Response } from 'express'
import logger from '../../lib/logger'
import {
  listCRMIntegrationsForUserManager,
  removeCRMIntegrationForUser,
  testCRMDraftConnectionForUser,
  testCRMIntegrationForUser,
  upsertCRMIntegrationForUser,
} from '../../services/integrations/crm/crm-integration.manager'

function getAuthenticatedEmail(req: Request): string {
  return String(req.user?.email || '').trim()
}

function getIntegrationId(req: Request): string {
  return String(req.params?.id || req.params?.integrationId || '').trim()
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

export async function listCRMIntegrations(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })

    const providerSlug = String(req.query?.slug || req.query?.providerSlug || '').trim() || null
    const result = await listCRMIntegrationsForUserManager(authenticatedEmail, providerSlug)
    return res.json({ success: true, ...result })
  } catch (error: any) {
    return handleControllerError(
      res,
      'listCRMIntegrations',
      'Nao foi possivel listar as integracoes de CRM.',
      error
    )
  }
}

export async function upsertCRMIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })

    const integration = await upsertCRMIntegrationForUser(authenticatedEmail, {
      integrationId: req.body?.integrationId ?? req.body?.integration_id ?? null,
      providerSlug: String(req.body?.providerSlug || req.body?.provider_slug || '').trim(),
      providerName: req.body?.providerName ?? req.body?.provider_name ?? null,
      providerType: req.body?.providerType ?? req.body?.provider_type ?? null,
      description: req.body?.description ?? null,
      credential: req.body?.credential ?? req.body?.token ?? null,
      mailchimpListId: req.body?.mailchimpListId ?? req.body?.mailchimp_list_id ?? null,
    })

    return res.json({ success: true, ...integration })
  } catch (error: any) {
    return handleControllerError(
      res,
      'upsertCRMIntegration',
      'Nao foi possivel salvar a integracao de CRM.',
      error
    )
  }
}

export async function deleteCRMIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    if (!integrationId) return res.status(400).json({ error: 'integration_id nao informado.' })

    const result = await removeCRMIntegrationForUser(authenticatedEmail, integrationId)
    return res.json(result)
  } catch (error: any) {
    return handleControllerError(
      res,
      'deleteCRMIntegration',
      'Nao foi possivel excluir a integracao de CRM.',
      error
    )
  }
}

export async function testCRMIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    if (!integrationId) return res.status(400).json({ error: 'integration_id nao informado.' })

    const result = await testCRMIntegrationForUser(authenticatedEmail, integrationId)
    return res.json({ success: result.success, result })
  } catch (error: any) {
    return handleControllerError(
      res,
      'testCRMIntegration',
      'Nao foi possivel testar a integracao de CRM.',
      error
    )
  }
}

export async function testCRMDraftConnection(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })

    const provider = String(req.body?.provider || 'hubspot').trim()
    const token = String(req.body?.token || '').trim()

    const result = await testCRMDraftConnectionForUser(authenticatedEmail, { provider, token })
    return res.json({ success: result.success, result })
  } catch (error: any) {
    return handleControllerError(
      res,
      'testCRMDraftConnection',
      'Nao foi possivel testar o token informado.',
      error
    )
  }
}
