import { describe, expect, it } from 'vitest'
import { shouldFailOnMissingIntegration } from '../services/flows/flow-integration-policy'

describe('flow-integration-policy', () => {
  it('deve exigir integracao em live quando requireLiveIntegration=true', () => {
    expect(
      shouldFailOnMissingIntegration(
        { __flow_execution_mode: 'live' },
        { requireLiveIntegration: true }
      )
    ).toBe(true)
  })

  it('nao deve exigir integracao em modo test', () => {
    expect(
      shouldFailOnMissingIntegration(
        { __flow_execution_mode: 'test' },
        { requireLiveIntegration: true }
      )
    ).toBe(false)
  })
})
