import logger from '../../../lib/logger'
import { supabase } from '../../../lib/supabase'
type IntegrationInstanceOption = {
  id: string
  label: string
  isActive?: boolean
}

type WhatsappIntegrationRow = {
  id: string
  phone_number?: string | null
  app_key?: string | null
  provider?: string | null
  email?: string | null
  user_id?: string | null
  companies_id?: string | null
}

export async function getPlatformUserByEmail(
  email: string
): Promise<{ id: string; companies_id: string | null } | null> {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return null

  const { data: userData, error: userError } = await supabase
    .from('tb_users')
    .select('id')
    .ilike('email', normalized)
    .limit(1)
    .maybeSingle()

  if (userError || !userData?.id) {
    return null
  }

  const { data: companyUser, error: companyUserError } = await supabase
    .from('tb_company_users')
    .select('companies_id')
    .eq('user_id', userData.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (companyUserError) {
    logger.warn('[whatsapp-integration-list] Falha ao resolver companies_id', {
      error: companyUserError.message,
    })
  }

  return {
    id: String(userData.id),
    companies_id: companyUser?.companies_id ? String(companyUser.companies_id) : null,
  }
}

export function isOwnedWhatsAppIntegrationRow(
  row: Pick<WhatsappIntegrationRow, 'user_id' | 'companies_id'>,
  userId: string | null,
  companyIds: Set<string>
): boolean {
  if (userId && String(row.user_id || '') === String(userId)) return true
  const rowCompanyId = String(row.companies_id || '').trim()
  if (rowCompanyId && companyIds.has(rowCompanyId)) return true
  return false
}

/**
 * Lista integrações WhatsApp do workspace — mesma regra de ownership do controller WhatsApp,
 * aceitando também o companies_id do JWT (requireWorkspace / RPC), que pode diferir da primeira
 * linha em tb_company_users.
 */
export async function listOwnedWhatsappIntegrationOptions(input: {
  userEmail: string
  workspaceUserId?: string | null
  workspaceCompanyId?: string | null
}): Promise<IntegrationInstanceOption[]> {
  const platformUser = await getPlatformUserByEmail(input.userEmail)
  const userId = String(input.workspaceUserId || platformUser?.id || '').trim() || null

  const companyIds = new Set<string>()
  if (platformUser?.companies_id) companyIds.add(platformUser.companies_id)
  if (input.workspaceCompanyId) companyIds.add(String(input.workspaceCompanyId).trim())

  if (!userId && companyIds.size === 0) {
    return []
  }

  const { data: waRows, error } = await supabase
    .from('tb_integrations')
    .select('id, phone_number, app_key, provider, email, user_id, companies_id')
    .eq('provider', 'whatsapp')
    .order('created_at', { ascending: false })

  if (error) {
    logger.warn('[whatsapp-integration-list] Falha ao listar WhatsApp', {
      error: error.message,
    })
    return []
  }

  const owned = (waRows || []).filter((row) =>
    isOwnedWhatsAppIntegrationRow(row as WhatsappIntegrationRow, userId, companyIds)
  )

  if ((waRows?.length || 0) > 0 && owned.length === 0) {
    logger.warn('[whatsapp-integration-list] Integracoes WhatsApp existem mas nao batem com o workspace', {
      totalRows: waRows?.length,
      userId,
      companyIds: [...companyIds],
      samples: (waRows || []).slice(0, 3).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        companies_id: row.companies_id,
      })),
    })
  }

  return owned.map((row) => ({
    id: String(row.id),
    label: String(row.phone_number || row.app_key || row.email || row.id),
    isActive: true,
  }))
}
