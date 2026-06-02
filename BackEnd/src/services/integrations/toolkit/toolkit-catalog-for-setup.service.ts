import logger from '../../../lib/logger'
import { listCalendlyIntegrationsForUser } from '../calendly'
import { listCRMIntegrationsForUserManager } from '../crm/crm-integration.manager'
import { supabase } from '../../../lib/supabase'
import { getUserIdAndCompanyIdByEmail } from '../../../utils/company-helper'
import { buildToolKey } from '../../agents/agent-extra-features'
import { PLATFORM_TEMPLATE_INTEGRATION_TOOLS_SECTION } from '../../agents/agent-integration-tools-prompt'
import { listIntegrationToolkitCatalog } from './toolkit.service'
import type { IntegrationToolDescriptor } from './toolkit.types'

export type IntegrationInstanceOption = {
  id: string
  label: string
  isActive?: boolean
}

export type ToolSetupPreset = {
  id: string
  name: string
  description: string
  toolKeys: string[]
  provider: string
  defaultIntegrationField?: 'integrationId' | 'crmIntegrationId'
  /** Texto para colar no papel (role) do template do agente */
  templateRoleAppendix?: string
}

const PROVIDER_LABELS: Record<string, string> = {
  calendly: 'Calendly',
  hubspot: 'HubSpot',
  whatsapp: 'WhatsApp',
}

/** Sempre listados na UI do agente; ferramentas só habilitam com conta conectada */
export const AGENT_SETUP_PROVIDER_ORDER = ['calendly', 'hubspot', 'whatsapp'] as const

function isOwnedWhatsAppIntegrationRow(
  row: { user_id?: string | null; companies_id?: string | null },
  userId: string | null,
  companyId: string | null
): boolean {
  if (userId && String(row.user_id || '') === userId) return true
  if (companyId && String(row.companies_id || '') === companyId) return true
  return false
}

async function listWhatsappIntegrationsForSetup(
  userEmail: string
): Promise<IntegrationInstanceOption[]> {
  const { userId, companyId } = await getUserIdAndCompanyIdByEmail(userEmail)
  if (!userId && !companyId) return []

  const { data: waRows, error } = await supabase
    .from('tb_integrations')
    .select('id, phone_number, provider, email_address, user_id, companies_id')
    .eq('provider', 'whatsapp')
    .order('created_at', { ascending: false })

  if (error) {
    logger.warn('[toolkit-catalog-for-setup] Falha ao listar WhatsApp', {
      error: error.message,
    })
    return []
  }

  return (waRows || [])
    .filter((row) => isOwnedWhatsAppIntegrationRow(row, userId, companyId))
    .map((row) => ({
      id: String(row.id),
      label: String(row.phone_number || row.email_address || row.id),
      isActive: true,
    }))
}

export async function buildIntegrationToolsCatalogForSetup(userEmail: string) {
  const email = String(userEmail || '').trim()

  const integrationsByProvider: Record<string, IntegrationInstanceOption[]> = {
    calendly: [],
    hubspot: [],
    whatsapp: [],
  }

  try {
    const calendly = await listCalendlyIntegrationsForUser(email)
    integrationsByProvider.calendly = (calendly.integrations || []).map((i: any) => ({
      id: String(i.id),
      label: String(i.display_name || i.email_address || i.id),
      isActive: i.is_active !== false && i.isActive !== false,
    }))
  } catch (err: any) {
    logger.warn('[toolkit-catalog-for-setup] Falha ao listar Calendly', {
      error: err?.message || err,
    })
    integrationsByProvider.calendly = []
  }

  try {
    const crm = await listCRMIntegrationsForUserManager(email, 'hubspot')
    integrationsByProvider.hubspot = (crm.integrations || []).map((i: any) => ({
      id: String(i.id),
      label: String(i.name || i.display_name || 'HubSpot'),
      isActive: i.is_active !== false,
    }))
  } catch {
    integrationsByProvider.hubspot = []
  }

  try {
    integrationsByProvider.whatsapp = await listWhatsappIntegrationsForSetup(email)
  } catch (err: any) {
    logger.warn('[toolkit-catalog-for-setup] Falha ao listar WhatsApp', {
      error: err?.message || err,
    })
    integrationsByProvider.whatsapp = []
  }

  const connectedProviders = AGENT_SETUP_PROVIDER_ORDER.filter(
    (p) => (integrationsByProvider[p]?.length || 0) > 0
  )

  const allTools = listIntegrationToolkitCatalog()
  const tools = allTools
    .filter((t) => t.provider !== 'email')
    .filter((t) => connectedProviders.includes(t.provider as (typeof connectedProviders)[number]))
    .map((t) => ({
      ...t,
      toolKey: t.toolKey || buildToolKey(t.provider, t.toolName),
      providerLabel: PROVIDER_LABELS[t.provider] || t.provider,
      requiresIntegrationId: ['calendly', 'whatsapp'].includes(t.provider),
      requiresCrmIntegrationId: t.provider === 'hubspot',
    }))

  const presets: ToolSetupPreset[] = []
  if (integrationsByProvider.calendly.length > 0) {
    presets.push({
      id: 'conversational_scheduling',
      name: 'Agendamento conversacional',
      description:
        'Consulta horários no Calendly e confirma a reunião no chat (sem enviar link externo). Cole o bloco templateRoleAppendix no papel do template do agente.',
      templateRoleAppendix: PLATFORM_TEMPLATE_INTEGRATION_TOOLS_SECTION,
      toolKeys: [
        buildToolKey('calendly', 'check_availability'),
        buildToolKey('calendly', 'book_appointment'),
        buildToolKey('calendly', 'cancel_appointment'),
        buildToolKey('calendly', 'list_upcoming_appointments'),
      ],
      provider: 'calendly',
      defaultIntegrationField: 'integrationId',
    })
  }

  return {
    tools,
    /** Provedores com pelo menos uma conta (ferramentas listadas) */
    availableProviders: connectedProviders,
    /** Todos os provedores que a UI do agente deve exibir (com ou sem conta) */
    setupProviders: [...AGENT_SETUP_PROVIDER_ORDER],
    integrationsByProvider,
    providerLabels: PROVIDER_LABELS,
    presets,
    platformTemplateIntegrationSection: PLATFORM_TEMPLATE_INTEGRATION_TOOLS_SECTION,
  }
}

export function filterCatalogToolsForAgent(
  catalogTools: IntegrationToolDescriptor[],
  enabledToolKeys: string[]
): IntegrationToolDescriptor[] {
  const set = new Set(enabledToolKeys.map((k) => k.trim().toLowerCase()))
  return catalogTools.filter((t) => set.has((t.toolKey || buildToolKey(t.provider, t.toolName)).toLowerCase()))
}
