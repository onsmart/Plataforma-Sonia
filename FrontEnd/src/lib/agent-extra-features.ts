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

export type SchedulingEngineMode = 'template' | 'coordinator'

export type AgentExtraFeaturesV2 = {
  version: number
  welcome_message?: string
  demo?: string
  scheduling_engine?: SchedulingEngineMode
  knowledge?: { scope?: string }
  tools: AgentToolEntry[]
  scheduling?: {
    enabled?: boolean
    calendly_integration_id?: string
    specialty?: string
  }
}

export function buildToolKey(provider: string, toolName: string): string {
  return `${String(provider || '').trim().toLowerCase()}.${String(toolName || '').trim().toLowerCase()}`
}

function legacySchedulingToTools(scheduling: AgentExtraFeaturesV2['scheduling']): AgentToolEntry[] {
  if (!scheduling?.enabled) return []
  const integrationId = String(scheduling.calendly_integration_id || '').trim()
  const specialty = String(scheduling.specialty || '').trim()
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

function normalizeToolEntry(raw: unknown): AgentToolEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Record<string, unknown>
  const provider = String(t.provider || '').trim().toLowerCase()
  const toolName = String(t.toolName || t.tool_name || '').trim().toLowerCase()
  if (!provider || !toolName) return null
  return {
    toolKey: String(t.toolKey || t.tool_key || buildToolKey(provider, toolName)).trim(),
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

export function parseAgentExtraFeatures(raw: unknown): AgentExtraFeaturesV2 {
  const empty: AgentExtraFeaturesV2 = { version: AGENT_EXTRA_FEATURES_VERSION, tools: [] }
  if (!raw) return empty
  try {
    const value =
      typeof raw === 'string'
        ? JSON.parse(raw.trim() || '{}')
        : typeof raw === 'object'
          ? raw
          : null
    if (!value || typeof value !== 'object') return empty

    const obj = value as Record<string, unknown>
    let tools: AgentToolEntry[] = Array.isArray(obj.tools)
      ? (obj.tools as unknown[]).map(normalizeToolEntry).filter((t): t is AgentToolEntry => t !== null)
      : []

    if (tools.length === 0 && obj.scheduling) {
      tools = legacySchedulingToTools(obj.scheduling as AgentExtraFeaturesV2['scheduling'])
    }

    return {
      version: Number(obj.version) || AGENT_EXTRA_FEATURES_VERSION,
      welcome_message: typeof obj.welcome_message === 'string' ? obj.welcome_message : undefined,
      demo: typeof obj.demo === 'string' ? obj.demo : undefined,
      scheduling_engine:
        obj.scheduling_engine === 'coordinator' || obj.scheduling_engine === 'template'
          ? obj.scheduling_engine
          : undefined,
      knowledge:
        obj.knowledge && typeof obj.knowledge === 'object'
          ? (obj.knowledge as { scope?: string })
          : undefined,
      tools,
      scheduling: obj.scheduling as AgentExtraFeaturesV2['scheduling'],
    }
  } catch {
    return empty
  }
}

export function serializeAgentExtraFeatures(features: AgentExtraFeaturesV2): string {
  const payload: AgentExtraFeaturesV2 = {
    version: AGENT_EXTRA_FEATURES_VERSION,
    welcome_message: features.welcome_message,
    demo: features.demo,
    scheduling_engine: features.scheduling_engine,
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

export function mergeWelcomeIntoSerialized(
  extraFeaturesJson: string,
  welcomeMessage: string
): string {
  const parsed = parseAgentExtraFeatures(extraFeaturesJson)
  parsed.welcome_message = welcomeMessage.trim() || undefined
  return serializeAgentExtraFeatures(parsed)
}

export function getWelcomeFromExtraFeatures(raw: unknown): string {
  return String(parseAgentExtraFeatures(raw).welcome_message || '').trim()
}
