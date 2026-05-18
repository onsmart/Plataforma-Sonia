import { supabase } from '../../../lib/supabase'
import { getUserIdAndCompanyIdByEmail } from '../../../utils/company-helper'
import logger from '../../../lib/logger'

export type CRMIntegrationRow = {
  id: string
  crm_id: string
  companies_id?: string | null
  user_id?: string | null
  api_key?: string | null
  access_token?: string | null
  config?: Record<string, unknown> | null
  is_active?: boolean | null
  tb_crms?:
    | {
        id?: string
        slug?: string
        name?: string
        type?: string
      }
    | Array<{
        id?: string
        slug?: string
        name?: string
        type?: string
      }>
    | null
}

export async function assertCRMIntegrationOwnedByUser(
  integrationId: string,
  userEmail: string
): Promise<CRMIntegrationRow> {
  const normalizedId = String(integrationId || '').trim()
  const normalizedEmail = String(userEmail || '').trim().toLowerCase()
  if (!normalizedId) {
    const error = new Error('integration_id nao informado.')
    ;(error as any).statusCode = 400
    throw error
  }
  if (!normalizedEmail) {
    const error = new Error('Usuario nao autenticado.')
    ;(error as any).statusCode = 401
    throw error
  }

  const { userId, companyId } = await getUserIdAndCompanyIdByEmail(normalizedEmail)
  if (!userId) {
    const error = new Error('Usuario nao encontrado.')
    ;(error as any).statusCode = 404
    throw error
  }

  let query = supabase
    .from('tb_crm_integrations')
    .select(
      `
        id,
        crm_id,
        companies_id,
        user_id,
        api_key,
        access_token,
        config,
        is_active,
        tb_crms (
          id,
          slug,
          name,
          type
        )
      `
    )
    .eq('id', normalizedId)
    .eq('is_active', true)

  query = companyId ? query.eq('companies_id', companyId) : query.eq('user_id', userId)

  const { data, error } = await query.maybeSingle()
  if (error) {
    logger.error('[crm-integration.repository] Falha ao carregar integracao CRM', {
      integrationId: normalizedId,
      error: error.message,
    })
    throw error
  }

  if (!data) {
    const notFound = new Error('Integracao CRM nao encontrada para este workspace.')
    ;(notFound as any).statusCode = 404
    throw notFound
  }

  return data as CRMIntegrationRow
}

export async function updateCRMIntegrationTestMetadata(
  integrationId: string,
  metadata: {
    success: boolean
    status: string
    message: string
    portalId?: string | number | null
  }
): Promise<void> {
  const { data: current, error: loadError } = await supabase
    .from('tb_crm_integrations')
    .select('config')
    .eq('id', integrationId)
    .maybeSingle()

  if (loadError) {
    logger.warn('[crm-integration.repository] Falha ao carregar config para atualizar teste', {
      integrationId,
      error: loadError.message,
    })
    return
  }

  const existingConfig =
    current?.config && typeof current.config === 'object' && !Array.isArray(current.config)
      ? (current.config as Record<string, unknown>)
      : {}

  const testedAt = new Date().toISOString()
  const nextConfig: Record<string, unknown> = {
    ...existingConfig,
    last_test_at: testedAt,
    last_test_status: metadata.status,
    last_test_success: metadata.success,
    last_test_message: metadata.message,
    ...(metadata.portalId !== undefined && metadata.portalId !== null
      ? { hubspot_portal_id: metadata.portalId }
      : {}),
    status: metadata.success ? 'connected' : 'test_failed',
  }

  const { error: updateError } = await supabase
    .from('tb_crm_integrations')
    .update({
      config: nextConfig,
      updated_at: testedAt,
    })
    .eq('id', integrationId)

  if (updateError) {
    logger.warn('[crm-integration.repository] Falha ao persistir resultado do teste CRM', {
      integrationId,
      error: updateError.message,
    })
  }
}
