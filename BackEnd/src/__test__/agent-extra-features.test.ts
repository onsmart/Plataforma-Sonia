import { describe, expect, it } from 'vitest'
import {
  buildToolKey,
  parseAgentExtraFeatures,
  resolveSchedulingConfig,
  serializeAgentExtraFeatures,
} from '../services/agents/agent-extra-features'
import { buildOnsmartExtraFeaturesJson } from '../services/agents/onsmart-agent-config'

describe('agent-extra-features', () => {
  it('parse legado scheduling vira tools', () => {
    const raw = JSON.stringify({
      scheduling: {
        enabled: true,
        calendly_integration_id: 'cal-uuid',
        specialty: 'reuniao_diagnostico',
      },
    })
    const parsed = parseAgentExtraFeatures(raw)
    expect(parsed?.tools.length).toBe(2)
    expect(parsed?.tools[0].toolKey).toBe(buildToolKey('calendly', 'check_availability'))
    expect(resolveSchedulingConfig(parsed)?.calendly_integration_id).toBe('cal-uuid')
  })

  it('resolveSchedulingConfig a partir de tools v2', () => {
    const json = buildOnsmartExtraFeaturesJson({
      calendlyIntegrationId: 'id-1',
      specialty: 'reuniao_diagnostico',
    })
    const parsed = parseAgentExtraFeatures(json)
    expect(parsed?.version).toBe(2)
    const scheduling = resolveSchedulingConfig(parsed)
    expect(scheduling?.enabled).toBe(true)
    expect(scheduling?.specialty).toBe('reuniao_diagnostico')
  })

  it('serialize preserva welcome_message', () => {
    const parsed = parseAgentExtraFeatures(
      serializeAgentExtraFeatures({
        version: 2,
        welcome_message: 'Oi!',
        tools: [],
      })
    )
    expect(parsed?.welcome_message).toBe('Oi!')
  })
})
