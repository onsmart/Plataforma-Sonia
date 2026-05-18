import { Request, Response } from 'express'
import logger from '../../lib/logger'
import {
  testCRMDraftConnectionForUser,
  testCRMIntegrationForUser,
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
