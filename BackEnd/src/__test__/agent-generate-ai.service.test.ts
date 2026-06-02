import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/logger', () => ({
  default: { info: vi.fn(), log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../utils/company-helper', () => ({
  getCompanyIdByEmail: vi.fn().mockResolvedValue('company-test-1'),
}))

vi.mock('../utils/plan-helper', () => ({
  canCreateAgent: vi.fn().mockResolvedValue({ allowed: true }),
  getPlanInfo: vi.fn().mockResolvedValue({
    plan: 'rec_start',
    status: 'active',
    limits: { agents: 5 },
  }),
}))

vi.mock('../services/usage-tracker.service', () => ({
  getActiveAgentCount: vi.fn().mockResolvedValue(0),
}))

const rpcSeq = vi.hoisted(() => ({ n: 0 }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(() => {
      rpcSeq.n += 1
      return Promise.resolve({ data: `rpc-id-${rpcSeq.n}`, error: null })
    }),
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { companies_id: 'company-test-1' }, error: null }),
        })),
      })),
    })),
  },
}))

const chatTextMock = vi.fn()
vi.mock('../services/llm/openai', () => ({
  chatText: (...args: unknown[]) => chatTextMock(...args),
}))

const claudeMock = vi.fn()
const planMock = vi.fn()
vi.mock('../services/agents/agent-ai-generation.shared', () => ({
  buildAgentDesignBriefWithClaude: (...args: unknown[]) => claudeMock(...args),
  generateSingleAgentConversationPlanWithOpenAI: (...args: unknown[]) => planMock(...args),
  rpcCreateAgentTemplate: vi.fn().mockResolvedValue('tpl-1'),
  rpcCreateAgent: vi.fn().mockResolvedValue('ag-1'),
  patchAgentRecord: vi.fn().mockResolvedValue(undefined),
  appendUserProvidedUrlsBlock: (body: string) => body,
  appendSingleAgentTemplateFooter: (body: string) => body,
  makeIaRunTag: () => 'test',
  buildIaAgentName: (_p: string, n: string) => `[AGENTE IA] ${n}`,
  buildIaTemplateName: (_p: string, a: string) => `[AGENTE IA] ${a}`,
  MIN_CONVERSATION_TEMPLATE_CHARS: 400,
}))

const smokeMock = vi.fn()
vi.mock('../services/agents/agent-generate-smoke-test.service', () => ({
  runAgentGenerateSmokeTest: (...args: unknown[]) => smokeMock(...args),
}))

describe('generateAgentWithAi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpcSeq.n = 0
    claudeMock.mockResolvedValue({ ok: true, text: 'Brief estruturado para teste de agente receptivo.' })
    planMock.mockResolvedValue(null)
    smokeMock.mockResolvedValue({
      ok: true,
      checks: [{ id: 'health', label: 'OK', status: 'ok', message: 'ok' }],
    })
  })

  it('rejeita arquétipo SDR', async () => {
    const { generateAgentWithAi } = await import('../services/agents/agent-generate-ai.service')
    await expect(
      generateAgentWithAi('user@test.com', {
        description: 'Teste',
        language: 'pt-BR',
        archetype: 'sdr',
        selectedTools: [],
      })
    ).rejects.toThrow(/SDR em desenvolvimento/)
  })

  it('exige ferramentas para receptivo', async () => {
    const { generateAgentWithAi } = await import('../services/agents/agent-generate-ai.service')
    await expect(
      generateAgentWithAi('user@test.com', {
        description: 'Atendimento WhatsApp',
        language: 'pt-BR',
        archetype: 'receptive',
        selectedTools: [],
      })
    ).rejects.toThrow(/ao menos uma integração/)
  })

  it('monta extra_features e cria agente receptivo com Calendly', async () => {
    const longTemplate =
      '1. NOME\nAgente\n2. FUNCAO\nAtender\n3. MISSAO\nAjudar\n4. CONTEXTO\nWA\n5. TOM\nPro\n6. REGRAS\nOk\n7. FLUXO\nSaudacao\n8. DECISAO\nSim\n9. FORA\nOk\n10. MSG\nOk\n11. EX\nU/A\n12. Q\nBom\n' +
      'Texto extra para passar no minimo de caracteres exigido pelo gerador de template profissional.'

    planMock.mockResolvedValueOnce({
      conversationTemplate: longTemplate,
      personalityPrompt: 'Cordial',
      welcomeMessage: 'Olá!',
      templateDescription: 'Agente teste',
      agentDisplayName: 'Assistente Teste',
    })

    const { generateAgentWithAi } = await import('../services/agents/agent-generate-ai.service')
    const result = await generateAgentWithAi('user@test.com', {
      description: 'Clínica de testes com agenda',
      language: 'pt-BR',
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
      integrations: { calendlyIntegrationId: 'cal-1' },
    })

    expect(result.agent.id).toBeTruthy()
    expect(result.refinedBrief).toContain('Brief')
    expect(smokeMock).toHaveBeenCalled()
    expect(claudeMock).toHaveBeenCalled()
  })
})
