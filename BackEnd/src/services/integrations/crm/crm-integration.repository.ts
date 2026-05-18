import { supabase } from '../../../lib/supabase'
import { getUserIdAndCompanyIdByEmail } from '../../../utils/company-helper'
import logger from '../../../lib/logger'
import { normalizeHubSpotToken } from './hubspot.service'

const SUPPORTED_CRM_SLUGS = ['hubspot', 'mailchimp'] as const
type SupportedCRMSlug = (typeof SUPPORTED_CRM_SLUGS)[number]

const CRM_CATALOG_META: Record<
  SupportedCRMSlug,
  { name: string; type: string; description: string; authMode: string; storedCredentialLabel: string }
> = {
  hubspot: {
    name: 'HubSpot',
    type: 'api_key',
    description: 'CRM, marketing e vendas via Private App token.',
    authMode: 'private_app_token',
    storedCredentialLabel: 'private_app_token',
  },
  mailchimp: {
    name: 'Mailchimp',
    type: 'api_key',
    description: 'Audiencias, campanhas e automacoes de marketing.',
    authMode: 'api_key',
    storedCredentialLabel: 'api_key',
  },
}

export type CRMIntegrationSummary = {
  id: string
  crm_id: string
  is_active: boolean
  created_at: string | null
  config: Record<string, unknown>
  credential_present: boolean
  tb_crms: {
    id: string
    slug: string
    name: string
    type: string
    description?: string | null
  } | null
}

export type PersistCRMIntegrationInput = {
  integrationId?: string | null
  providerSlug: string
  providerName?: string | null
  providerType?: string | null
  description?: string | null
  credential?: string | null
  mailchimpListId?: string | null
}

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

function normalizeSlug(slug: string): SupportedCRMSlug | null {
  const normalized = String(slug || '').trim().toLowerCase()
  return SUPPORTED_CRM_SLUGS.includes(normalized as SupportedCRMSlug)
    ? (normalized as SupportedCRMSlug)
    : null
}

function extractMailchimpDataCenter(apiKey: string): string | null {
  const match = apiKey.trim().match(/-([a-z]{2,}\d+)$/i)
  return match?.[1]?.toLowerCase() || null
}

function mapIntegrationSummary(row: CRMIntegrationRow): CRMIntegrationSummary {
  const config =
    row.config && typeof row.config === 'object' && !Array.isArray(row.config)
      ? (row.config as Record<string, unknown>)
      : {}
  const crmRaw = row.tb_crms
  const crm = Array.isArray(crmRaw) ? crmRaw[0] : crmRaw
  const credentialPresent = !!(
    String(row.api_key || '').trim() ||
    String(row.access_token || '').trim() ||
    String(config.private_app_token || config.api_key || config.access_token || config.token || '').trim() ||
    config.credential_present === true
  )

  return {
    id: String(row.id),
    crm_id: String(row.crm_id),
    is_active: row.is_active !== false,
    created_at: (row as { created_at?: string | null }).created_at ?? null,
    config,
    credential_present: credentialPresent,
    tb_crms: crm?.id
      ? {
          id: String(crm.id),
          slug: String(crm.slug || ''),
          name: String(crm.name || ''),
          type: String(crm.type || 'api_key'),
          description: (crm as { description?: string | null }).description ?? null,
        }
      : null,
  }
}

async function ensureCrmCatalogRow(
  slug: SupportedCRMSlug,
  overrides?: { name?: string | null; type?: string | null; description?: string | null }
): Promise<string> {
  const { data: existing, error: lookupError } = await supabase
    .from('tb_crms')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (lookupError) throw lookupError
  if (existing?.id) return String(existing.id)

  const meta = CRM_CATALOG_META[slug]
  const { data: created, error: createError } = await supabase
    .from('tb_crms')
    .insert({
      slug,
      name: String(overrides?.name || meta.name).trim(),
      type: String(overrides?.type || meta.type).trim(),
      description: String(overrides?.description || meta.description).trim(),
      is_active: true,
    })
    .select('id')
    .single()

  if (createError || !created?.id) {
    throw createError || new Error(`Nao foi possivel registrar o CRM ${slug} no catalogo.`)
  }

  return String(created.id)
}

export async function listCRMIntegrationsForUser(
  userEmail: string,
  providerSlug?: string | null
): Promise<CRMIntegrationSummary[]> {
  const normalizedEmail = String(userEmail || '').trim().toLowerCase()
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
        created_at,
        tb_crms (
          id,
          slug,
          name,
          type,
          description
        )
      `
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  query = companyId ? query.eq('companies_id', companyId) : query.eq('user_id', userId)

  const { data, error } = await query
  if (error) throw error

  const slugFilter = normalizeSlug(String(providerSlug || ''))
  return (data || [])
    .map((row) => mapIntegrationSummary(row as CRMIntegrationRow))
    .filter((integration) => {
      const slug = integration.tb_crms?.slug || String(integration.config?.provider_slug || '')
      if (!SUPPORTED_CRM_SLUGS.includes(slug as SupportedCRMSlug)) return false
      if (!slugFilter) return true
      return slug === slugFilter
    })
}

export async function persistCRMIntegrationForUser(
  userEmail: string,
  body: PersistCRMIntegrationInput
): Promise<CRMIntegrationSummary> {
  const normalizedEmail = String(userEmail || '').trim().toLowerCase()
  if (!normalizedEmail) {
    const error = new Error('Usuario nao autenticado.')
    ;(error as any).statusCode = 401
    throw error
  }

  const providerSlug = normalizeSlug(body.providerSlug)
  if (!providerSlug) {
    const error = new Error('Provedor CRM invalido. Use hubspot ou mailchimp.')
    ;(error as any).statusCode = 400
    throw error
  }

  const { userId, companyId } = await getUserIdAndCompanyIdByEmail(normalizedEmail)
  if (!userId) {
    const error = new Error('Usuario nao encontrado.')
    ;(error as any).statusCode = 404
    throw error
  }

  const catalogMeta = CRM_CATALOG_META[providerSlug]
  const crmId = await ensureCrmCatalogRow(providerSlug, {
    name: body.providerName,
    type: body.providerType,
    description: body.description,
  })

  const rawCredential = String(body.credential || '').trim()
  const credential =
    providerSlug === 'hubspot' ? normalizeHubSpotToken(rawCredential) : rawCredential
  const integrationId = String(body.integrationId || '').trim()
  let existingRow: CRMIntegrationRow | null = null

  if (integrationId) {
    existingRow = await assertCRMIntegrationOwnedByUser(integrationId, normalizedEmail)
    if (String(existingRow.crm_id) !== crmId) {
      const error = new Error('Integracao informada nao corresponde ao provedor selecionado.')
      ;(error as any).statusCode = 400
      throw error
    }
  } else {
    let existingQuery = supabase
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
      .eq('crm_id', crmId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    existingQuery = companyId
      ? existingQuery.eq('companies_id', companyId)
      : existingQuery.eq('user_id', userId)

    const { data: existing, error: existingError } = await existingQuery.maybeSingle()
    if (existingError) throw existingError
    existingRow = existing ? (existing as CRMIntegrationRow) : null
  }

  const existingConfig =
    existingRow?.config && typeof existingRow.config === 'object' && !Array.isArray(existingRow.config)
      ? (existingRow.config as Record<string, unknown>)
      : {}

  const hasStoredCredential = !!(
    String(existingRow?.api_key || '').trim() ||
    String(existingRow?.access_token || '').trim() ||
    existingConfig.credential_present === true
  )

  if (!credential && !hasStoredCredential) {
    const error = new Error(
      providerSlug === 'hubspot'
        ? 'Informe o token privado do HubSpot.'
        : 'Informe a API Key do Mailchimp.'
    )
    ;(error as any).statusCode = 400
    throw error
  }

  const trimmedMailchimpListId = String(body.mailchimpListId || '').trim()
  const mailchimpDataCenter = providerSlug === 'mailchimp' && credential ? extractMailchimpDataCenter(credential) : null
  const connectedAt = new Date().toISOString()
  const providerName = String(body.providerName || catalogMeta.name).trim()
  const nextConfig: Record<string, unknown> = {
    ...existingConfig,
    provider_slug: providerSlug,
    provider_name: providerName,
    auth_mode: catalogMeta.authMode,
    status: 'connected',
    connected_at: connectedAt,
    last_saved_at: connectedAt,
    credential_present: true,
    credential_label: catalogMeta.storedCredentialLabel,
    supported_in_ui: true,
    backend_supported: providerSlug === 'hubspot',
    ...(trimmedMailchimpListId ? { default_list_id: trimmedMailchimpListId } : {}),
    ...(mailchimpDataCenter ? { data_center: mailchimpDataCenter } : {}),
  }

  const payload: Record<string, unknown> = {
    user_id: userId,
    companies_id: companyId,
    crm_id: crmId,
    is_active: true,
    config: nextConfig,
    updated_at: connectedAt,
  }

  if (credential) {
    payload.api_key = credential
    nextConfig.token_hint = `${credential.slice(0, 6)}...`
    if (providerSlug === 'hubspot') {
      payload.access_token = credential
      nextConfig.private_app_token = credential
    }
    payload.config = nextConfig
  }

  if (existingRow?.id) {
    const { error } = await supabase.from('tb_crm_integrations').update(payload).eq('id', existingRow.id)
    if (error) throw error
    const [integration] = await listCRMIntegrationsForUser(normalizedEmail, providerSlug)
    if (!integration) {
      throw new Error('Integracao CRM salva, mas nao foi possivel recarregar os dados.')
    }
    return integration
  }

  const { data: created, error: insertError } = await supabase
    .from('tb_crm_integrations')
    .insert(payload)
    .select('id')
    .single()

  if (insertError || !created?.id) {
    throw insertError || new Error('Nao foi possivel criar a integracao de CRM.')
  }

  const [integration] = await listCRMIntegrationsForUser(normalizedEmail, providerSlug)
  if (!integration) {
    throw new Error('Integracao CRM criada, mas nao foi possivel recarregar os dados.')
  }
  return integration
}

export async function findActiveHubSpotIntegrationIdForCompany(companyId: string): Promise<string | null> {
  const normalizedCompanyId = String(companyId || '').trim()
  if (!normalizedCompanyId) return null

  const { data, error } = await supabase
    .from('tb_crm_integrations')
    .select(
      `
        id,
        tb_crms (
          slug
        )
      `
    )
    .eq('companies_id', normalizedCompanyId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    logger.warn('[crm-integration.repository] Falha ao buscar integracao HubSpot da empresa', {
      companyId: normalizedCompanyId,
      error: error.message,
    })
    return null
  }

  for (const row of data || []) {
    const crm = (row as { tb_crms?: { slug?: string } | Array<{ slug?: string }> }).tb_crms
    const slug = Array.isArray(crm) ? String(crm[0]?.slug || '') : String(crm?.slug || '')
    if (slug === 'hubspot' && row.id) {
      return String(row.id)
    }
  }

  return null
}

export async function resolveCRMIntegrationIdForFlow(
  configuredId: string,
  companyId?: string | null
): Promise<string> {
  const normalizedId = String(configuredId || '').trim()
  if (normalizedId) {
    const { data, error } = await supabase
      .from('tb_crm_integrations')
      .select('id')
      .eq('id', normalizedId)
      .eq('is_active', true)
      .maybeSingle()

    if (!error && data?.id) {
      return String(data.id)
    }
  }

  const fallbackId = await findActiveHubSpotIntegrationIdForCompany(String(companyId || ''))
  if (fallbackId) {
    logger.info('[crm-integration.repository] Usando integracao HubSpot ativa da empresa', {
      configuredId: normalizedId || null,
      resolvedId: fallbackId,
      companyId: companyId || null,
    })
    return fallbackId
  }

  return normalizedId
}

export async function deleteCRMIntegrationForUser(userEmail: string, integrationId: string): Promise<void> {
  const normalizedEmail = String(userEmail || '').trim().toLowerCase()
  const normalizedId = String(integrationId || '').trim()
  if (!normalizedEmail) {
    const error = new Error('Usuario nao autenticado.')
    ;(error as any).statusCode = 401
    throw error
  }
  if (!normalizedId) {
    const error = new Error('integration_id nao informado.')
    ;(error as any).statusCode = 400
    throw error
  }

  await assertCRMIntegrationOwnedByUser(normalizedId, normalizedEmail)

  const { error } = await supabase.from('tb_crm_integrations').delete().eq('id', normalizedId)
  if (error) throw error
}
