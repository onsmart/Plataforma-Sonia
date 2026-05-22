import { ONSMART_WELCOME_MESSAGE } from '../../content/onsmart-faq-seed'

export const AGENT_EXTRA_FEATURES_VERSION = 2

export type AgentToolConfig = {
  specialty?: string
}

export type AgentToolEntry = {
  toolKey: string
  provider: string
  toolName: string
  enabled: boolean
  integrationId?: string
  crmIntegrationId?: string
  config?: AgentToolConfig
}

export type AgentExtraFeaturesV2 = {
  version: number
  welcome_message?: string
  demo?: string
  knowledge?: { scope?: string }
  tools: AgentToolEntry[]
  /** Legado — mantido na leitura, não escrito pela UI v2 */
  scheduling?: {
    enabled?: boolean
    calendly_integration_id?: string
    specialty?: string
  }
}

export type OnsmartSchedulingConfig = {
  enabled: boolean
  calendly_integration_id: string
  specialty: string
}

export function buildToolKey(provider: string, toolName: string): string {
  return `${String(provider || '').trim().toLowerCase()}.${String(toolName || '').trim().toLowerCase()}`
}

export function parseToolKey(toolKey: string): { provider: string; toolName: string } | null {
  const parts = String(toolKey || '').trim().toLowerCase().split('.')
  if (parts.length < 2) return null
  const provider = parts[0]
  const toolName = parts.slice(1).join('.')
  if (!provider || !toolName) return null
  return { provider, toolName }
}

function legacySchedulingToTools(scheduling: AgentExtraFeaturesV2['scheduling']): AgentToolEntry[] {
  if (!scheduling?.enabled) return []
  const integrationId = String(scheduling.calendly_integration_id || '').trim()
  const specialty = String(scheduling.specialty || 'reuniao_diagnostico').trim()
  if (!integrationId) return []

  const config: AgentToolConfig = { specialty }
  return [
    {
      toolKey: buildToolKey('calendly', 'check_availability'),
      provider: 'calendly',
      toolName: 'check_availability',
      enabled: true,
      integrationId,
      config,
    },
    {
      toolKey: buildToolKey('calendly', 'book_appointment'),
      provider: 'calendly',
      toolName: 'book_appointment',
      enabled: true,
      integrationId,
      config,
    },
  ]
}

export function parseAgentExtraFeatures(raw: unknown): AgentExtraFeaturesV2 | null {
  if (!raw) return null
  try {
    const value =
      typeof raw === 'string'
        ? JSON.parse(raw.trim())
        : typeof raw === 'object'
          ? raw
          : null
    if (!value || typeof value !== 'object') return null

    const obj = value as Record<string, unknown>
    const version = Number(obj.version) || (Array.isArray(obj.tools) ? AGENT_EXTRA_FEATURES_VERSION : 1)

    let tools: AgentToolEntry[] = Array.isArray(obj.tools)
      ? (obj.tools as AgentToolEntry[])
          .map((t) => normalizeToolEntry(t))
          .filter((t): t is AgentToolEntry => t !== null)
      : []

    if (tools.length === 0 && obj.scheduling) {
      tools = legacySchedulingToTools(obj.scheduling as AgentExtraFeaturesV2['scheduling'])
    }

    return {
      version,
      welcome_message:
        typeof obj.welcome_message === 'string' ? obj.welcome_message : undefined,
      demo: typeof obj.demo === 'string' ? obj.demo : undefined,
      knowledge:
        obj.knowledge && typeof obj.knowledge === 'object'
          ? (obj.knowledge as { scope?: string })
          : undefined,
      tools,
      scheduling: obj.scheduling as AgentExtraFeaturesV2['scheduling'],
    }
  } catch {
    return null
  }
}

function normalizeToolEntry(raw: unknown): AgentToolEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Record<string, unknown>
  const provider = String(t.provider || '').trim().toLowerCase()
  const toolName = String(t.toolName || t.tool_name || '').trim().toLowerCase()
  if (!provider || !toolName) return null
  const toolKey = String(t.toolKey || t.tool_key || buildToolKey(provider, toolName)).trim()

  return {
    toolKey,
    provider,
    toolName,
    enabled: t.enabled !== false,
    integrationId: String(t.integrationId || t.integration_id || '').trim() || undefined,
    crmIntegrationId:
      String(t.crmIntegrationId || t.crm_integration_id || '').trim() || undefined,
    config:
      t.config && typeof t.config === 'object'
        ? { specialty: String((t.config as AgentToolConfig).specialty || '').trim() || undefined }
        : undefined,
  }
}

export function serializeAgentExtraFeatures(features: AgentExtraFeaturesV2): string {
  const payload: AgentExtraFeaturesV2 = {
    version: AGENT_EXTRA_FEATURES_VERSION,
    welcome_message: features.welcome_message,
    demo: features.demo,
    knowledge: features.knowledge,
    tools: features.tools.map((t) => ({
      toolKey: t.toolKey,
      provider: t.provider,
      toolName: t.toolName,
      enabled: t.enabled,
      ...(t.integrationId ? { integrationId: t.integrationId } : {}),
      ...(t.crmIntegrationId ? { crmIntegrationId: t.crmIntegrationId } : {}),
      ...(t.config?.specialty ? { config: { specialty: t.config.specialty } } : {}),
    })),
  }
  return JSON.stringify(payload)
}

export function resolveWelcomeMessage(features: AgentExtraFeaturesV2 | null): string {
  const custom = String(features?.welcome_message || '').trim()
  return custom || ONSMART_WELCOME_MESSAGE
}

export function getEnabledTools(features: AgentExtraFeaturesV2 | null): AgentToolEntry[] {
  if (!features?.tools?.length) return []
  return features.tools.filter((t) => t.enabled)
}

export function isToolEnabled(
  features: AgentExtraFeaturesV2 | null,
  toolKey: string
): boolean {
  return getEnabledTools(features).some((t) => t.toolKey === toolKey)
}

export function resolveSchedulingConfig(
  features: AgentExtraFeaturesV2 | null
): OnsmartSchedulingConfig | null {
  const legacy = features?.scheduling
  if (legacy?.enabled) {
    const calendlyIntegrationId = String(legacy.calendly_integration_id || '').trim()
    const specialty = String(legacy.specialty || 'reuniao_diagnostico').trim()
    if (calendlyIntegrationId && specialty) {
      return { enabled: true, calendly_integration_id: calendlyIntegrationId, specialty }
    }
  }

  const tools = getEnabledTools(features)
  const check = tools.find((t) => t.toolKey === buildToolKey('calendly', 'check_availability'))
  const book = tools.find((t) => t.toolKey === buildToolKey('calendly', 'book_appointment'))

  if (!check?.enabled || !book?.enabled) return null

  const integrationId = String(check.integrationId || book.integrationId || '').trim()
  const specialty = String(
    check.config?.specialty || book.config?.specialty || 'reuniao_diagnostico'
  ).trim()

  if (!integrationId || !specialty) return null

  return {
    enabled: true,
    calendly_integration_id: integrationId,
    specialty,
  }
}

export function buildOnsmartExtraFeaturesJson(input: {
  calendlyIntegrationId: string
  specialty?: string
  welcomeMessage?: string
}): string {
  const specialty = input.specialty || 'reuniao_diagnostico'
  const integrationId = input.calendlyIntegrationId
  const config: AgentToolConfig = { specialty }

  return serializeAgentExtraFeatures({
    version: AGENT_EXTRA_FEATURES_VERSION,
    demo: 'onsmart_sonia',
    welcome_message: input.welcomeMessage || ONSMART_WELCOME_MESSAGE,
    knowledge: { scope: 'onsmart_ai_only' },
    tools: [
      {
        toolKey: buildToolKey('calendly', 'check_availability'),
        provider: 'calendly',
        toolName: 'check_availability',
        enabled: true,
        integrationId,
        config,
      },
      {
        toolKey: buildToolKey('calendly', 'book_appointment'),
        provider: 'calendly',
        toolName: 'book_appointment',
        enabled: true,
        integrationId,
        config,
      },
    ],
  })
}

/** Compat: mesmo contrato que parseOnsmartExtraFeatures legado */
export function parseOnsmartExtraFeatures(raw: unknown): AgentExtraFeaturesV2 | null {
  return parseAgentExtraFeatures(raw)
}

export function resolveOnsmartWelcomeMessage(extra: AgentExtraFeaturesV2 | null): string {
  return resolveWelcomeMessage(extra)
}
