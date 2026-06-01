import { supabase } from '../lib/supabase'
import { getUserIdAndCompanyIdByEmail } from './company-helper'
import { assertCRMIntegrationOwnedByUser } from '../services/integrations/crm/crm-integration.repository'

export class TenantOwnershipError extends Error {
  statusCode: number
  code: string

  constructor(message: string, statusCode = 403, code = 'TENANT_FORBIDDEN') {
    super(message)
    this.statusCode = statusCode
    this.code = code
  }
}

export async function assertResourceOwnedByCompany(
  table: string,
  resourceId: string,
  companiesId: string,
  options?: { idColumn?: string; companyColumn?: string }
): Promise<void> {
  const idColumn = options?.idColumn || 'id'
  const companyColumn = options?.companyColumn || 'companies_id'
  const normalizedId = String(resourceId || '').trim()
  const normalizedCompany = String(companiesId || '').trim()

  if (!normalizedId || !normalizedCompany) {
    throw new TenantOwnershipError('Recurso ou workspace inválido.', 400, 'INVALID_SCOPE')
  }

  const { data, error } = await supabase
    .from(table)
    .select(`${idColumn}, ${companyColumn}`)
    .eq(idColumn, normalizedId)
    .eq(companyColumn, normalizedCompany)
    .maybeSingle()

  if (error) {
    throw new TenantOwnershipError('Erro ao validar propriedade do recurso.', 500, 'OWNERSHIP_CHECK_ERROR')
  }

  if (!data) {
    throw new TenantOwnershipError('Recurso não encontrado ou não pertence ao seu workspace.', 404, 'RESOURCE_NOT_FOUND')
  }
}

export async function assertAgentDecisionOwnedByCompany(
  decisionId: string,
  companiesId: string
): Promise<{ id: string; agent_id: string; status: string; companies_id?: string | null; [key: string]: unknown }> {
  const normalizedId = String(decisionId || '').trim()
  if (!normalizedId) {
    throw new TenantOwnershipError('ID da decisão é obrigatório.', 400, 'DECISION_ID_REQUIRED')
  }

  const { data: decision, error } = await supabase
    .from('tb_agent_decisions')
    .select('*')
    .eq('id', normalizedId)
    .maybeSingle()

  if (error || !decision) {
    throw new TenantOwnershipError('Decisão não encontrada.', 404, 'DECISION_NOT_FOUND')
  }

  const { data: agent, error: agentError } = await supabase
    .from('tb_agents')
    .select('id, companies_id')
    .eq('id', decision.agent_id)
    .eq('companies_id', companiesId)
    .maybeSingle()

  if (agentError || !agent) {
    throw new TenantOwnershipError('Decisão não pertence ao seu workspace.', 403, 'DECISION_FORBIDDEN')
  }

  return decision as typeof decision & { agent_id: string; status: string }
}

export async function assertWhatsAppMessageOwnedByCompany(
  messageId: string,
  companiesId: string
): Promise<{ id: string; integrations_id: string }> {
  const normalizedId = String(messageId || '').trim()
  if (!normalizedId) {
    throw new TenantOwnershipError('message_id é obrigatório.', 400, 'MESSAGE_ID_REQUIRED')
  }

  const { data: message, error } = await supabase
    .from('tb_whatsapp_messages')
    .select('id, integrations_id')
    .eq('id', normalizedId)
    .maybeSingle()

  if (error || !message?.integrations_id) {
    throw new TenantOwnershipError('Mensagem não encontrada.', 404, 'MESSAGE_NOT_FOUND')
  }

  const { data: integration, error: integrationError } = await supabase
    .from('tb_integrations')
    .select('id, companies_id')
    .eq('id', message.integrations_id)
    .eq('companies_id', companiesId)
    .maybeSingle()

  if (integrationError || !integration) {
    throw new TenantOwnershipError('Mensagem não pertence ao seu workspace.', 403, 'MESSAGE_FORBIDDEN')
  }

  return { id: message.id, integrations_id: message.integrations_id }
}

export async function assertCalendlyIntegrationOwnedByUser(
  integrationId: string,
  userEmail: string
): Promise<void> {
  const normalizedId = String(integrationId || '').trim()
  const normalizedEmail = String(userEmail || '').trim().toLowerCase()
  if (!normalizedId) {
    throw new TenantOwnershipError('integration_id não informado.', 400, 'INTEGRATION_ID_REQUIRED')
  }
  if (!normalizedEmail) {
    throw new TenantOwnershipError('Usuário não autenticado.', 401, 'AUTH_REQUIRED')
  }

  const { userId, companyId } = await getUserIdAndCompanyIdByEmail(normalizedEmail)
  if (!userId) {
    throw new TenantOwnershipError('Usuário não encontrado.', 404, 'USER_NOT_FOUND')
  }

  let query = supabase
    .from('tb_integrations')
    .select('id, provider, companies_id')
    .eq('id', normalizedId)
    .eq('provider', 'calendly')

  query = companyId ? query.eq('companies_id', companyId) : query.eq('user_id', userId)

  const { data, error } = await query.maybeSingle()
  if (error) {
    throw new TenantOwnershipError('Erro ao validar integração Calendly.', 500, 'OWNERSHIP_CHECK_ERROR')
  }
  if (!data) {
    throw new TenantOwnershipError('Integração Calendly não encontrada para este workspace.', 404, 'INTEGRATION_NOT_FOUND')
  }
}

export async function assertWhatsAppIntegrationOwnedByCompany(
  integrationId: string,
  companiesId: string
): Promise<void> {
  await assertResourceOwnedByCompany('tb_integrations', integrationId, companiesId)
}

/** Valida IDs sensíveis no payload de ferramentas de integração antes da execução. */
export async function assertIntegrationToolPayloadOwned(
  userEmail: string,
  provider: string,
  payload: Record<string, unknown>
): Promise<void> {
  const integrationId = String(payload.integrationId || '').trim()
  const crmIntegrationId = String(payload.crmIntegrationId || '').trim()

  if (integrationId) {
    if (provider === 'calendly' || provider === 'whatsapp') {
      if (provider === 'calendly') {
        await assertCalendlyIntegrationOwnedByUser(integrationId, userEmail)
      } else {
        const { companyId } = await getUserIdAndCompanyIdByEmail(userEmail)
        if (!companyId) {
          throw new TenantOwnershipError('Workspace não configurado.', 403, 'WORKSPACE_REQUIRED')
        }
        await assertWhatsAppIntegrationOwnedByCompany(integrationId, companyId)
      }
    }
  }

  if (crmIntegrationId) {
    await assertCRMIntegrationOwnedByUser(crmIntegrationId, userEmail)
  }
}
