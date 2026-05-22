import { ONSMART_WELCOME_MESSAGE } from '../../content/onsmart-faq-seed'
import {
  type AgentExtraFeaturesV2,
  type AgentSchedulingConfig,
  type AgentToolEntry,
  type AgentToolConfig,
  AGENT_EXTRA_FEATURES_VERSION,
  buildToolKey,
  parseAgentExtraFeatures,
  resolveWelcomeMessage,
  resolveSchedulingConfig,
  serializeAgentExtraFeatures,
  getEnabledTools,
  isToolEnabled,
} from './agent-extra-features'

export type { AgentExtraFeaturesV2 as OnsmartAgentExtraFeatures }
export type { AgentSchedulingConfig, AgentSchedulingConfig as OnsmartSchedulingConfig, AgentToolEntry }

export {
  parseAgentExtraFeatures,
  resolveWelcomeMessage,
  resolveSchedulingConfig,
  serializeAgentExtraFeatures,
  getEnabledTools,
  isToolEnabled,
  buildToolKey,
}

/** Somente para POST /agents/provision-onsmart-demo — não usado no runtime de outros agentes */
export function buildOnsmartExtraFeaturesJson(input: {
  calendlyIntegrationId: string
  specialty?: string
  welcomeMessage?: string
}): string {
  const specialty = input.specialty || 'reuniao_diagnostico'
  const integrationId = input.calendlyIntegrationId
  const config: AgentToolConfig = {
    specialty,
    meeting_label: 'reunião com a Onsmart',
  }

  return serializeAgentExtraFeatures({
    version: AGENT_EXTRA_FEATURES_VERSION,
    demo: 'onsmart_sonia',
    scheduling_engine: 'template',
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
      {
        toolKey: buildToolKey('calendly', 'cancel_appointment'),
        provider: 'calendly',
        toolName: 'cancel_appointment',
        enabled: true,
        integrationId,
        config,
      },
      {
        toolKey: buildToolKey('calendly', 'list_upcoming_appointments'),
        provider: 'calendly',
        toolName: 'list_upcoming_appointments',
        enabled: true,
        integrationId,
        config,
      },
    ],
  })
}

export function parseOnsmartExtraFeatures(raw: unknown): AgentExtraFeaturesV2 | null {
  return parseAgentExtraFeatures(raw)
}

export function resolveOnsmartWelcomeMessage(extra: AgentExtraFeaturesV2 | null): string {
  return resolveWelcomeMessage(extra)
}
