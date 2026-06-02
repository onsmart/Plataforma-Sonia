import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/agents/agent-setup-health.service', () => ({
  getAgentSetupHealth: vi.fn().mockResolvedValue({
    ok: true,
    agentId: 'agent-1',
    checks: [{ id: 'agent_active', label: 'Ativo', status: 'ok', message: 'ok' }],
  }),
}))

const turnMock = vi.fn()
vi.mock('../services/agents/agent-turn.service', () => ({
  runAgentConversationTurn: (...args: unknown[]) => turnMock(...args),
}))

const executeMock = vi.fn()
vi.mock('../services/integrations/toolkit/toolkit.service', () => ({
  executeIntegrationTool: (...args: unknown[]) => executeMock(...args),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { companies_id: 'co-1', access_token: 'tok', app_key: 'key' },
            error: null,
          }),
        })),
      })),
    })),
  },
}))

describe('runAgentGenerateSmokeTest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    turnMock.mockResolvedValue({
      reply: JSON.stringify({ action: 'reply', message: 'Olá! Como posso ajudar?' }),
      mode: 'llm',
    })
    executeMock.mockResolvedValue({
      success: true,
      userSafeMessage: 'OK',
    })
  })

  it('executa ping Calendly e turno de chat', async () => {
    const { runAgentGenerateSmokeTest } = await import(
      '../services/agents/agent-generate-smoke-test.service'
    )

    const report = await runAgentGenerateSmokeTest({
      agentId: 'agent-1',
      userEmail: 'user@test.com',
      archetype: 'receptive',
      selectedTools: [
        {
          toolKey: 'calendly.list_event_types',
          provider: 'calendly',
          toolName: 'list_event_types',
          enabled: true,
          integrationId: 'cal-1',
        },
      ],
    })

    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'calendly', toolName: 'list_event_types' })
    )
    expect(turnMock).toHaveBeenCalled()
    expect(report.chatTurn?.userMessage).toContain('reunião')
  })
})
