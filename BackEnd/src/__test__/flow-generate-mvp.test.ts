import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('../utils/company-helper', () => ({
  getCompanyIdByEmail: vi.fn().mockResolvedValue('company-test-1'),
}))

vi.mock('../utils/plan-helper', () => ({
  canCreateAgent: vi.fn().mockResolvedValue({ allowed: true }),
  getPlanInfo: vi.fn().mockResolvedValue({
    plan: 'pro',
    status: 'active',
    limits: { agents: 5, messages: null, hasRAG: true, hasSSO: false, hasGovernance: false, hasCustomDeployment: false },
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
    })),
  },
}))

const chatTextMock = vi.fn()
vi.mock('../services/llm/openai', () => ({
  chatText: (...args: unknown[]) => chatTextMock(...args),
}))

describe('generateMvpFlowFromDescription (Criar fluxo com IA)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpcSeq.n = 0
    chatTextMock.mockReset()
    process.env.FLOW_DESCRIPTION_REFINER = 'none'
  })

  it('deve chamar refino + plano LLM e criar 1 modelo principal + classificador (template+agente)', async () => {
    const planJson = {
      suggestedFlowName: 'Fluxo teste',
      structureSummary: 'Um modelo de atendimento compartilhado; ramos só roteiam o tema.',
      brainPrompt:
        'Voce e o assistente da empresa. Responda com clareza em portugues. Evite menus numerados longos. ' +
        'Seja breve. Ajude o cliente com produtos e duvidas. Tom profissional e acolhedor. ' +
        'Nao invente precos. Ofereca agendamento quando fizer sentido. ' +
        'Use historico da conversa. Nao repita saudacao inicial varias vezes. ',
      intents: [{ intent: 'vendas', label: 'Vendas e orcamento' }],
      classifierHints: 'Loja online simples',
    }

    chatTextMock.mockResolvedValueOnce({
      success: true,
      content: JSON.stringify(planJson),
    })

    const { generateMvpFlowFromDescription } = await import('../services/flows/flow-generate-mvp.service')
    const result = await generateMvpFlowFromDescription('user@test.com', 'Quero vendas e suporte no WhatsApp', 'pt-BR')

    expect(chatTextMock).toHaveBeenCalledTimes(1)
    expect(result.generationMode).toBe('structured')
    expect(result.flow.startNodeId).toBe('n-start')
    expect(result.flow.nodes.length).toBeGreaterThan(4)
    expect(result.flow.edges.some((e) => e.sourceHandle === 'true')).toBe(true)
    expect(result.createdResources?.agentNames.length).toBe(1)
    expect(result.createdResources?.roleTemplateNames.length).toBe(2)
    expect(result.resourceChoice.executionMode).toBe('template')

    const branchReply = result.flow.nodes.find((n) => (n as { id?: string }).id === 'n-branch-1') as
      | { data?: { executionMode?: string } }
      | undefined
    expect(branchReply?.data?.executionMode).toBe('template')

    const { supabase } = await import('../lib/supabase')
    expect(vi.mocked(supabase.rpc).mock.calls.length).toBe(3)
  })

  it('deve falhar quando o plano LLM retornar inválido', async () => {
    chatTextMock.mockResolvedValueOnce({ success: true, content: '{}' })

    const { generateMvpFlowFromDescription } = await import('../services/flows/flow-generate-mvp.service')
    await expect(
      generateMvpFlowFromDescription('user@test.com', 'Descrição', 'pt-BR')
    ).rejects.toThrow(/planejar o fluxo/)
  })
})
