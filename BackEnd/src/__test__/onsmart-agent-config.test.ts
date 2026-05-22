import { describe, expect, it } from 'vitest'
import {
  buildOnsmartExtraFeaturesJson,
  parseOnsmartExtraFeatures,
  resolveSchedulingConfig,
} from '../services/agents/onsmart-agent-config'

describe('onsmart-agent-config', () => {
  it('parseia extra_features JSON', () => {
    const json = buildOnsmartExtraFeaturesJson({
      calendlyIntegrationId: 'cal-1',
      specialty: 'reuniao_diagnostico',
    })
    const parsed = parseOnsmartExtraFeatures(json)
    expect(parsed?.demo).toBe('onsmart_sonia')
    const scheduling = resolveSchedulingConfig(parsed)
    expect(scheduling?.calendly_integration_id).toBe('cal-1')
    expect(scheduling?.specialty).toBe('reuniao_diagnostico')
  })
})
