export const AGENT_EXTRA_FEATURES_VERSION = 2

export type AgentToolConfig = {
  specialty?: string
  meeting_label?: string
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
  knowledge?: { scope?: string }
  /**
   * template (padrao): regras no papel do template + ferramentas listadas no prompt; sem motor fixo em codigo.
   * coordinator: motor passo a passo em codigo (legado/demo); use so se o template pedir fluxo automatico.
   */
  scheduling_engine?: SchedulingEngineMode
  tools: AgentToolEntry[]
  /** Legado — mantido na leitura, não escrito pela UI v2 */
  scheduling?: {
    enabled?: boolean
    calendly_integration_id?: string
    specialty?: string
  }
}

/** Config operacional derivada das ferramentas Calendly habilitadas no agente */
export type AgentSchedulingConfig = {
  enabled: boolean
  calendly_integration_id: string
  specialty: string
  /** Rótulo humano da reunião (ex.: "reunião com a Onsmart") — opcional, vem do template/contexto */
  meeting_label?: string
}

/** @deprecated use AgentSchedulingConfig */
export type OnsmartSchedulingConfig = AgentSchedulingConfig

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

export function resolveWelcomeMessage(features: AgentExtraFeaturesV2 | null): string {
  return String(features?.welcome_message || '').trim()
}

export function hasConversationalScheduling(features: AgentExtraFeaturesV2 | null): boolean {
  return resolveSchedulingConfig(features) !== null
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
): AgentSchedulingConfig | null {
  const legacy = features?.scheduling
  if (legacy?.enabled) {
    const calendlyIntegrationId = String(legacy.calendly_integration_id || '').trim()
    const specialty = String(legacy.specialty || '').trim()
    if (calendlyIntegrationId && specialty) {
      return { enabled: true, calendly_integration_id: calendlyIntegrationId, specialty }
    }
  }

  const tools = getEnabledTools(features)
  const check = tools.find((t) => t.toolKey === buildToolKey('calendly', 'check_availability'))
  const book = tools.find((t) => t.toolKey === buildToolKey('calendly', 'book_appointment'))

  if (!check?.enabled || !book?.enabled) return null

  const integrationId = String(check.integrationId || book.integrationId || '').trim()
  const specialty = String(check.config?.specialty || book.config?.specialty || '').trim()

  if (!integrationId || !specialty) return null

  const meetingLabel = String(
    check.config?.meeting_label || book.config?.meeting_label || ''
  ).trim()

  return {
    enabled: true,
    calendly_integration_id: integrationId,
    specialty,
    ...(meetingLabel ? { meeting_label: meetingLabel } : {}),
  }
}

/** Compat: mesmo contrato que parseOnsmartExtraFeatures legado */
export function parseOnsmartExtraFeatures(raw: unknown): AgentExtraFeaturesV2 | null {
  return parseAgentExtraFeatures(raw)
}

export function resolveOnsmartWelcomeMessage(extra: AgentExtraFeaturesV2 | null): string {
  return resolveWelcomeMessage(extra)
}

export type AgentToolSelectionInput = {
  toolKey: string
  provider: string
  toolName: string
  enabled?: boolean
  integrationId?: string | null
  crmIntegrationId?: string | null
  config?: AgentToolConfig
}

const RECEPTIVE_CALENDLY_TOOL_NAMES = [
  'check_availability',
  'book_appointment',
  'list_upcoming_appointments',
  'cancel_appointment',
] as const

const RECEPTIVE_HUBSPOT_TOOL_NAMES = ['lookup_contact', 'create_contact', 'update_contact'] as const

/** Presets de toolKeys por arquétipo (wizard Criar agente com IA). */
export function getDefaultToolKeysForAgentArchetype(
  archetype: 'faq' | 'receptive' | 'sdr',
  connectedProviders: string[]
): string[] {
  if (archetype === 'sdr') return []
  const has = (p: string) => connectedProviders.includes(p)
  const keys: string[] = []

  if (archetype === 'receptive') {
    if (has('calendly')) {
      for (const name of RECEPTIVE_CALENDLY_TOOL_NAMES) {
        keys.push(buildToolKey('calendly', name))
      }
    }
    if (has('hubspot')) {
      for (const name of RECEPTIVE_HUBSPOT_TOOL_NAMES) {
        keys.push(buildToolKey('hubspot', name))
      }
    }
    if (has('whatsapp')) {
      keys.push(buildToolKey('whatsapp', 'send_session_message'))
    }
    return keys
  }

  if (archetype === 'faq' && has('hubspot')) {
    keys.push(buildToolKey('hubspot', 'lookup_contact'))
  }

  return keys
}

export function buildExtraFeaturesFromSelection(params: {
  selectedTools: AgentToolSelectionInput[]
  welcomeMessage?: string
  schedulingEngine?: SchedulingEngineMode
  defaultCalendlySpecialty?: string
  defaultMeetingLabel?: string
}): string {
  const specialty =
    String(params.defaultCalendlySpecialty || 'reuniao_atendimento').trim() || 'reuniao_atendimento'
  const meetingLabel = String(params.defaultMeetingLabel || 'reunião').trim() || 'reunião'

  const tools: AgentToolEntry[] = []
  for (const row of params.selectedTools || []) {
    if (row.enabled === false) continue
    const provider = String(row.provider || '').trim().toLowerCase()
    const toolName = String(row.toolName || '').trim().toLowerCase()
    if (!provider || !toolName) continue

    const toolKey = String(row.toolKey || buildToolKey(provider, toolName)).trim()
    const integrationId = String(row.integrationId || '').trim() || undefined
    const crmIntegrationId = String(row.crmIntegrationId || '').trim() || undefined

    const config: AgentToolConfig =
      provider === 'calendly'
        ? { specialty, meeting_label: meetingLabel }
        : {}

    tools.push({
      toolKey,
      provider,
      toolName,
      enabled: true,
      ...(integrationId ? { integrationId } : {}),
      ...(crmIntegrationId ? { crmIntegrationId } : {}),
      ...(Object.keys(config).length ? { config } : {}),
    })
  }

  const hasCalendlyScheduling = tools.some(
    (t) =>
      t.provider === 'calendly' &&
      (t.toolName === 'check_availability' || t.toolName === 'book_appointment')
  )

  const features: AgentExtraFeaturesV2 = {
    version: AGENT_EXTRA_FEATURES_VERSION,
    welcome_message: params.welcomeMessage?.trim() || undefined,
    scheduling_engine: hasCalendlyScheduling
      ? params.schedulingEngine || 'template'
      : params.schedulingEngine,
    tools,
  }

  return serializeAgentExtraFeatures(features)
}
