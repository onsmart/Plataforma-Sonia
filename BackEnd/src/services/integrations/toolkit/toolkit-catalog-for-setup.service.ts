import { listCalendlyIntegrationsForUser } from '../calendly'
import { listCRMIntegrationsForUserManager } from '../crm/crm-integration.manager'
import { listEmailIntegrationsForUser } from '../mail/mail-integration.manager'
import { supabase } from '../../../lib/supabase'
import { getCompanyIdByEmail } from '../../../utils/company-helper'
import { buildToolKey } from '../../agents/agent-extra-features'
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
}

const PROVIDER_LABELS: Record<string, string> = {
  calendly: 'Calendly',
  hubspot: 'HubSpot',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
}

export async function buildIntegrationToolsCatalogForSetup(userEmail: string) {
  const email = String(userEmail || '').trim()
  const companiesId = await getCompanyIdByEmail(email)

  const integrationsByProvider: Record<string, IntegrationInstanceOption[]> = {
    calendly: [],
    hubspot: [],
    whatsapp: [],
    email: [],
  }

  try {
    const calendly = await listCalendlyIntegrationsForUser(email)
    integrationsByProvider.calendly = (calendly.integrations || [])
      .filter((i: any) => i.is_active !== false)
      .map((i: any) => ({
        id: String(i.id),
        label: String(i.display_name || i.email_address || i.id),
        isActive: i.is_active !== false,
      }))
  } catch {
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

  if (companiesId) {
    const { data: waRows } = await supabase
      .from('tb_integrations')
      .select('id, phone_number, provider, email_address')
      .eq('companies_id', companiesId)
      .eq('provider', 'whatsapp')

    integrationsByProvider.whatsapp = (waRows || []).map((row) => ({
      id: String(row.id),
      label: String(row.phone_number || row.email_address || row.id),
      isActive: true,
    }))
  }

  try {
    const emailResult = await listEmailIntegrationsForUser(email)
    const rows = Array.isArray(emailResult?.integrations)
      ? emailResult.integrations
      : Array.isArray(emailResult)
        ? emailResult
        : []
    integrationsByProvider.email = rows.map((i: any) => ({
      id: String(i.id || i.integration_id),
      label: String(i.email_address || i.from_email || i.display_name || i.id),
      isActive: i.is_active !== false,
    }))
  } catch {
    integrationsByProvider.email = []
  }

  const availableProviders = (['calendly', 'hubspot', 'whatsapp', 'email'] as const).filter(
    (p) => (integrationsByProvider[p]?.length || 0) > 0
  )

  const allTools = listIntegrationToolkitCatalog()
  const tools = allTools
    .filter((t) => availableProviders.includes(t.provider as (typeof availableProviders)[number]))
    .map((t) => ({
      ...t,
      toolKey: t.toolKey || buildToolKey(t.provider, t.toolName),
      providerLabel: PROVIDER_LABELS[t.provider] || t.provider,
      requiresIntegrationId: ['calendly', 'whatsapp', 'email'].includes(t.provider),
      requiresCrmIntegrationId: t.provider === 'hubspot',
    }))

  const presets: ToolSetupPreset[] = []
  if (integrationsByProvider.calendly.length > 0) {
    presets.push({
      id: 'conversational_scheduling',
      name: 'Agendamento conversacional',
      description:
        'Consulta horários no Calendly e confirma a reunião no chat (sem enviar link externo).',
      toolKeys: [
        buildToolKey('calendly', 'check_availability'),
        buildToolKey('calendly', 'book_appointment'),
      ],
      provider: 'calendly',
      defaultIntegrationField: 'integrationId',
    })
  }

  return {
    tools,
    availableProviders,
    integrationsByProvider,
    providerLabels: PROVIDER_LABELS,
    presets,
  }
}

export function filterCatalogToolsForAgent(
  catalogTools: IntegrationToolDescriptor[],
  enabledToolKeys: string[]
): IntegrationToolDescriptor[] {
  const set = new Set(enabledToolKeys.map((k) => k.trim().toLowerCase()))
  return catalogTools.filter((t) => set.has((t.toolKey || buildToolKey(t.provider, t.toolName)).toLowerCase()))
}
