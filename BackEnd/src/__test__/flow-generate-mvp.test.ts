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
  })

  it('deve chamar refino + plano LLM e criar RPCs (template + agente) por papel', async () => {
    const planJson = {
      suggestedFlowName: 'Fluxo teste',
      structureSummary: 'Classifica e roteia.',
      classifier: {
        agentName: 'Classificador',
        bio: 'Classifica intenção',
        rolePrompt: 'Você classifica mensagens em intents.',
      },
      branches: [
        {
          intent: 'vendas',
          agentName: 'Vendas',
          bio: 'Comercial',
          rolePrompt: 'Você é comercial.',
        },
      ],
      fallback: {
        agentName: 'Geral',
        bio: 'Fallback',
        rolePrompt: 'Você ajuda quando nada encaixa.',
      },
    }

    chatTextMock
      .mockResolvedValueOnce({
        success: true,
        content: 'Descrição refinada para o fluxo de atendimento.',
      })
      .mockResolvedValueOnce({
        success: true,
        content: JSON.stringify(planJson),
      })

    const { generateMvpFlowFromDescription } = await import('../services/flows/flow-generate-mvp.service')
    const result = await generateMvpFlowFromDescription('user@test.com', 'Quero vendas e suporte no WhatsApp', 'pt-BR')

    expect(chatTextMock).toHaveBeenCalledTimes(2)
    expect(result.generationMode).toBe('structured')
    expect(result.flow.startNodeId).toBe('n-start')
    expect(result.flow.nodes.length).toBeGreaterThan(4)
    expect(result.flow.edges.some((e) => e.sourceHandle === 'true')).toBe(true)
    expect(result.createdResources?.agentNames.length).toBe(3)
    expect(result.createdResources?.roleTemplateNames.length).toBe(3)

    const { supabase } = await import('../lib/supabase')
    expect(vi.mocked(supabase.rpc).mock.calls.length).toBe(6)
  })

  it('deve falhar quando o plano LLM retornar inválido', async () => {
    chatTextMock
      .mockResolvedValueOnce({ success: true, content: 'Refinado.' })
      .mockResolvedValueOnce({ success: true, content: '{}' })

    const { generateMvpFlowFromDescription } = await import('../services/flows/flow-generate-mvp.service')
    await expect(
      generateMvpFlowFromDescription('user@test.com', 'Descrição', 'pt-BR')
    ).rejects.toThrow(/planejar o fluxo/)
  })
})
