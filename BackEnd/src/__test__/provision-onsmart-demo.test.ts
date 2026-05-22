import { describe, expect, it } from 'vitest'
import { buildOnsmartExtraFeaturesJson } from '../services/agents/onsmart-agent-config'
import { __test__ } from '../services/agents/provision-onsmart-demo.service'

describe('provision-onsmart-demo', () => {
  it('expoe nomes fixos da demo', () => {
    expect(__test__.AGENT_NAME).toContain('Onsmart')
    expect(__test__.DEFAULT_SPECIALTY).toBe('reuniao_diagnostico')
  })

  it('gera extra_features v2 com ferramentas de agendamento', () => {
    const json = buildOnsmartExtraFeaturesJson({
      calendlyIntegrationId: 'uuid-cal',
    })
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(2)
    expect(parsed.tools.length).toBe(2)
    expect(parsed.tools[0].integrationId).toBe('uuid-cal')
    expect(parsed.demo).toBe('onsmart_sonia')
  })
})
