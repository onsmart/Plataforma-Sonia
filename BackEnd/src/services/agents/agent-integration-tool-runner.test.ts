import { describe, expect, it, vi, beforeEach } from 'vitest'
import { buildToolKey, serializeAgentExtraFeatures } from './agent-extra-features'
import { runAgentIntegrationToolFromLlm } from './agent-integration-tool-runner'

vi.mock('../integrations/toolkit/toolkit.service', () => ({
  executeIntegrationTool: vi.fn(),
}))

import { executeIntegrationTool } from '../integrations/toolkit/toolkit.service'

const calendlyId = 'e81f647d-d2b6-45b7-94bb-40701255c9b1'

function extraWithCalendlyTools() {
  return serializeAgentExtraFeatures({
    version: 2,
    scheduling_engine: 'template',
    tools: [
      {
        toolKey: buildToolKey('calendly', 'check_availability'),
        provider: 'calendly',
        toolName: 'check_availability',
        enabled: true,
        integrationId: calendlyId,
        config: { specialty: 'reuniao_diagnostico' },
      },
    ],
  })
}

describe('runAgentIntegrationToolFromLlm', () => {
  beforeEach(() => {
    vi.mocked(executeIntegrationTool).mockReset()
  })

  it('rejeita ferramenta nao habilitada no agente', async () => {
    const result = await runAgentIntegrationToolFromLlm({
      agentExtraFeatures: extraWithCalendlyTools(),
      toolKey: 'calendly.book_appointment',
      toolPayload: '{}',
    })
    expect(result.ok).toBe(false)
    expect(result.reply).toMatch(/não está ativa/i)
  })

  it('executa check_availability e formata slots', async () => {
    vi.mocked(executeIntegrationTool).mockResolvedValue({
      success: true,
      provider: 'calendly',
      toolName: 'check_availability',
      status: 'success',
      userSafeMessage: 'ok',
      data: {
        slots: [{ slotId: 's1', startsAt: '2026-05-26T14:00:00.000Z' }],
      },
    })

    const result = await runAgentIntegrationToolFromLlm({
      agentExtraFeatures: extraWithCalendlyTools(),
      toolKey: 'calendly.check_availability',
      toolPayload: JSON.stringify({ preferredDate: '2026-05-26' }),
      userMessage: 'Verificando horarios...',
    })

    expect(result.ok).toBe(true)
    expect(executeIntegrationTool).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'calendly',
        toolName: 'check_availability',
        payload: expect.objectContaining({
          integrationId: calendlyId,
          specialty: 'reuniao_diagnostico',
        }),
      })
    )
    expect(result.reply).toMatch(/Horários disponíveis/i)
  })
})
