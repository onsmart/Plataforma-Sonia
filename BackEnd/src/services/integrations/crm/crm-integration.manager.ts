import logger from '../../../lib/logger'
import { testHubSpotConnection } from './hubspot.service'
import {
  assertCRMIntegrationOwnedByUser,
  deleteCRMIntegrationForUser,
  listCRMIntegrationsForUser,
  persistCRMIntegrationForUser,
  type PersistCRMIntegrationInput,
  updateCRMIntegrationTestMetadata,
} from './crm-integration.repository'

export async function listCRMIntegrationsForUserManager(userEmail: string, providerSlug?: string | null) {
  const integrations = await listCRMIntegrationsForUser(userEmail, providerSlug)
  return { integrations }
}

export async function upsertCRMIntegrationForUser(userEmail: string, body: PersistCRMIntegrationInput) {
  const integration = await persistCRMIntegrationForUser(userEmail, body)
  return { integration }
}

export async function removeCRMIntegrationForUser(userEmail: string, integrationId: string) {
  await deleteCRMIntegrationForUser(userEmail, integrationId)
  return { success: true }
}

export async function testCRMIntegrationForUser(userEmail: string, integrationId: string) {
  const integration = await assertCRMIntegrationOwnedByUser(integrationId, userEmail)
  const crm = integration.tb_crms as { slug?: string } | Array<{ slug?: string }> | null | undefined
  const slug = Array.isArray(crm) ? String(crm[0]?.slug || '').trim() : String(crm?.slug || '').trim()

  if (slug !== 'hubspot') {
    const error = new Error('Teste de conexao disponivel apenas para HubSpot nesta versao.')
    ;(error as any).statusCode = 400
    throw error
  }

  const result = await testHubSpotConnection({ crmIntegrationId: integrationId })

  await updateCRMIntegrationTestMetadata(integrationId, {
    success: result.success,
    status: result.status,
    message: result.message,
    portalId: result.portalId ?? null,
  })

  logger.info('[testCRMIntegrationForUser] Teste CRM concluido', {
    integrationId,
    provider: result.provider,
    success: result.success,
    status: result.status,
    portalId: result.portalId ?? null,
  })

  return result
}

export async function testCRMDraftConnectionForUser(
  userEmail: string,
  params: { provider?: string; token?: string }
) {
  const normalizedEmail = String(userEmail || '').trim().toLowerCase()
  if (!normalizedEmail) {
    const error = new Error('Usuario nao autenticado.')
    ;(error as any).statusCode = 401
    throw error
  }

  const provider = String(params.provider || 'hubspot').trim().toLowerCase()
  const token = String(params.token || '').trim()

  if (provider !== 'hubspot') {
    const error = new Error('Teste de rascunho disponivel apenas para HubSpot nesta versao.')
    ;(error as any).statusCode = 400
    throw error
  }

  if (!token) {
    const error = new Error('Informe o token do HubSpot para testar antes de salvar.')
    ;(error as any).statusCode = 400
    throw error
  }

  const result = await testHubSpotConnection({ token })

  logger.info('[testCRMDraftConnectionForUser] Teste CRM de rascunho concluido', {
    provider,
    success: result.success,
    status: result.status,
    portalId: result.portalId ?? null,
  })

  return result
}
