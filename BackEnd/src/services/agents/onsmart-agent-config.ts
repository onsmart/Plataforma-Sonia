import { ONSMART_WELCOME_MESSAGE } from '../../content/onsmart-faq-seed'

export type OnsmartSchedulingConfig = {
  enabled: boolean
  calendly_integration_id: string
  specialty: string
}

export type OnsmartAgentExtraFeatures = {
  demo?: string
  welcome_message?: string
  scheduling?: OnsmartSchedulingConfig
  knowledge?: { scope?: string }
}

export function parseOnsmartExtraFeatures(raw: unknown): OnsmartAgentExtraFeatures | null {
  if (!raw) return null
  try {
    const value =
      typeof raw === 'string'
        ? JSON.parse(raw.trim())
        : typeof raw === 'object'
          ? raw
          : null
    if (!value || typeof value !== 'object') return null
    return value as OnsmartAgentExtraFeatures
  } catch {
    return null
  }
}

export function resolveOnsmartWelcomeMessage(extra: OnsmartAgentExtraFeatures | null): string {
  const custom = String(extra?.welcome_message || '').trim()
  return custom || ONSMART_WELCOME_MESSAGE
}

export function resolveSchedulingConfig(
  extra: OnsmartAgentExtraFeatures | null
): OnsmartSchedulingConfig | null {
  const scheduling = extra?.scheduling
  if (!scheduling?.enabled) return null
  const calendlyIntegrationId = String(scheduling.calendly_integration_id || '').trim()
  const specialty = String(scheduling.specialty || 'reuniao_diagnostico').trim()
  if (!calendlyIntegrationId || !specialty) return null
  return {
    enabled: true,
    calendly_integration_id: calendlyIntegrationId,
    specialty,
  }
}

export function buildOnsmartExtraFeaturesJson(input: {
  calendlyIntegrationId: string
  specialty?: string
  welcomeMessage?: string
}): string {
  const payload: OnsmartAgentExtraFeatures = {
    demo: 'onsmart_sonia',
    welcome_message: input.welcomeMessage || ONSMART_WELCOME_MESSAGE,
    scheduling: {
      enabled: true,
      calendly_integration_id: input.calendlyIntegrationId,
      specialty: input.specialty || 'reuniao_diagnostico',
    },
    knowledge: { scope: 'onsmart_ai_only' },
  }
  return JSON.stringify(payload)
}
