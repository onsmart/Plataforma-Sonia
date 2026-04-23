import { Request, Response } from 'express'
import logger from '../../lib/logger'
import {
  createEmailIntegrationForUser,
  deleteEmailIntegrationForUser,
  getDefaultEmailIntegrationForUser,
  listEmailIntegrationsForUser,
  setDefaultEmailIntegrationForUser,
  setEmailIntegrationActiveForUser,
  testEmailIntegrationForUser,
  updateEmailIntegrationForUser,
  upsertDefaultEmailIntegrationForUser,
} from '../../services/integrations/mail'
import {
  createOutlookAuthorizeUrl,
  createSignedOutlookState,
} from '../../services/integrations/email_reader/outlook/outlook.oauth'

function inferRequestOrigin(req: Request): string {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0]?.trim()
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0]?.trim()
  const protocol = forwardedProto || req.protocol || 'http'
  const host = forwardedHost || String(req.headers.host || '').trim()

  if (!host) {
    return ''
  }

  return `${protocol}://${host}`
}

function getAuthenticatedEmail(req: Request): string {
  return String(req.user?.email || '').trim()
}

function getAuthenticatedUserId(req: Request): string {
  return String(req.user?.userId || '').trim()
}

function getIntegrationId(req: Request): string {
  return String(req.params?.id || req.params?.integrationId || '').trim()
}

function handleControllerError(res: Response, scope: string, fallbackMessage: string, error: any) {
  logger.error(`[${scope}] ${fallbackMessage}`, {
    error: error?.message || error,
  })

  return res.status(500).json({
    error: fallbackMessage,
    details: error?.message || String(error),
  })
}

export async function listEmailIntegrations(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })

    const result = await listEmailIntegrationsForUser(authenticatedEmail)
    return res.json({
      success: true,
      integrations: result.integrations,
      defaultIntegration: result.defaultIntegration,
    })
  } catch (error: any) {
    return handleControllerError(
      res,
      'listEmailIntegrations',
      'Nao foi possivel listar as integracoes de email.',
      error
    )
  }
}

export async function getMicrosoft365AuthorizeUrl(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    const authenticatedUserId = getAuthenticatedUserId(req)

    if (!authenticatedEmail || !authenticatedUserId) {
      return res.status(401).json({ error: 'Usuario nao autenticado.' })
    }

    const signedState = createSignedOutlookState({
      userId: authenticatedUserId,
      userEmail: authenticatedEmail,
      integrationId: String(req.query?.integration_id || req.query?.integrationId || '').trim() || undefined,
    })

    const { authorizeUrl, redirectUri } = createOutlookAuthorizeUrl({
      state: signedState,
      requestOrigin: inferRequestOrigin(req),
    })

    return res.json({
      success: true,
      authorizeUrl,
      redirectUri,
    })
  } catch (error: any) {
    return handleControllerError(
      res,
      'getMicrosoft365AuthorizeUrl',
      'Nao foi possivel iniciar a autenticacao do Microsoft 365.',
      error
    )
  }
}

export async function getCurrentEmailIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })

    const integration = await getDefaultEmailIntegrationForUser(authenticatedEmail)
    return res.json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(
      res,
      'getCurrentEmailIntegration',
      'Nao foi possivel carregar a integracao de email atual.',
      error
    )
  }
}

export async function createEmailIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })

    const integration = await createEmailIntegrationForUser(authenticatedEmail, req.body || {})
    return res.status(201).json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(
      res,
      'createEmailIntegration',
      'Nao foi possivel criar a integracao de email.',
      error
    )
  }
}

export async function updateEmailIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    if (!integrationId) return res.status(400).json({ error: 'integration_id nao informado.' })

    const integration = await updateEmailIntegrationForUser(authenticatedEmail, integrationId, req.body || {})
    return res.json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(
      res,
      'updateEmailIntegration',
      'Nao foi possivel atualizar a integracao de email.',
      error
    )
  }
}

export async function upsertCurrentEmailIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })

    const integration = await upsertDefaultEmailIntegrationForUser(authenticatedEmail, req.body || {})
    return res.json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(
      res,
      'upsertCurrentEmailIntegration',
      'Nao foi possivel salvar a integracao de email.',
      error
    )
  }
}

export async function testEmailIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    if (!integrationId) return res.status(400).json({ error: 'integration_id nao informado.' })

    const result = await testEmailIntegrationForUser(authenticatedEmail, integrationId)
    return res.json({ success: result.success, result })
  } catch (error: any) {
    return handleControllerError(
      res,
      'testEmailIntegration',
      'Nao foi possivel testar a integracao de email.',
      error
    )
  }
}

export async function testCurrentEmailIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })

    const integration = await getDefaultEmailIntegrationForUser(authenticatedEmail)
    if (!integration?.id) {
      return res.status(404).json({ error: 'Nenhuma integracao de email encontrada para testar.' })
    }

    const result = await testEmailIntegrationForUser(authenticatedEmail, integration.id)
    return res.json({ success: result.success, result })
  } catch (error: any) {
    return handleControllerError(
      res,
      'testCurrentEmailIntegration',
      'Nao foi possivel testar a integracao de email.',
      error
    )
  }
}

export async function setDefaultEmailIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    if (!integrationId) return res.status(400).json({ error: 'integration_id nao informado.' })

    const integration = await setDefaultEmailIntegrationForUser(authenticatedEmail, integrationId)
    return res.json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(
      res,
      'setDefaultEmailIntegration',
      'Nao foi possivel definir a integracao de email padrao.',
      error
    )
  }
}

export async function activateEmailIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    if (!integrationId) return res.status(400).json({ error: 'integration_id nao informado.' })

    const integration = await setEmailIntegrationActiveForUser(authenticatedEmail, integrationId, true)
    return res.json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(
      res,
      'activateEmailIntegration',
      'Nao foi possivel ativar a integracao de email.',
      error
    )
  }
}

export async function deactivateEmailIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    if (!integrationId) return res.status(400).json({ error: 'integration_id nao informado.' })

    const integration = await setEmailIntegrationActiveForUser(authenticatedEmail, integrationId, false)
    return res.json({ success: true, integration })
  } catch (error: any) {
    return handleControllerError(
      res,
      'deactivateEmailIntegration',
      'Nao foi possivel desativar a integracao de email.',
      error
    )
  }
}

export async function deleteEmailIntegration(req: Request, res: Response) {
  try {
    const authenticatedEmail = getAuthenticatedEmail(req)
    const integrationId = getIntegrationId(req)
    if (!authenticatedEmail) return res.status(401).json({ error: 'Usuario nao autenticado.' })
    if (!integrationId) return res.status(400).json({ error: 'integration_id nao informado.' })

    const result = await deleteEmailIntegrationForUser(authenticatedEmail, integrationId)
    return res.json({ success: true, result })
  } catch (error: any) {
    return handleControllerError(
      res,
      'deleteEmailIntegration',
      'Nao foi possivel remover a integracao de email.',
      error
    )
  }
}
