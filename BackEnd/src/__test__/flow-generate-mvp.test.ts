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

  it('deve chamar plano LLM e criar 1 template + 1 agente em fluxo linear', async () => {
    const longTemplate =
      '1. NOME DO AGENTE\nTeste\n2. FUNCAO\nAtendimento\n3. MISSAO\nAjudar\n4. CONTEXTO\nWhatsApp\n' +
      '5. TOM\nCordial\n6. REGRAS\nNao inventar\n7. FLUXO\nSaudacao depois ajuda\n8. DECISOES\nPor intencao\n' +
      '9. FORA DO FLUXO\nAclarar\n10. MENSAGENS\nUse https://exemplo.com/agenda\n11. EXEMPLOS\nU: oi / A: ola\n' +
      '12. QUALIDADE\nCurto e claro\n' +
      'Texto extra para ultrapassar o minimo de caracteres do gerador e validar o fluxo linear sem ramos.'

    const planJson = {
      suggestedFlowName: 'Fluxo teste',
      structureSummary: 'Fluxo linear com template unico.',
      conversationTemplate: longTemplate,
      agentDisplayName: 'Assistente Demo',
    }

    chatTextMock.mockResolvedValueOnce({
      success: true,
      content: JSON.stringify(planJson),
    })

    const { generateMvpFlowFromDescription } = await import('../services/flows/flow-generate-mvp.service')
    const result = await generateMvpFlowFromDescription('user@test.com', 'Quero vendas e suporte no WhatsApp', 'pt-BR')

    expect(chatTextMock).toHaveBeenCalledTimes(1)
    expect(result.generationMode).toBe('single_agent')
    expect(result.flow.startNodeId).toBe('n-start')
    expect(result.flow.nodes.length).toBe(3)
    expect(result.flow.edges.length).toBe(2)
    expect(result.createdResources?.agentNames.length).toBe(1)
    expect(result.createdResources?.roleTemplateNames.length).toBe(1)
    expect(result.resourceChoice.executionMode).toBe('template')
    expect(result.resourceChoice.agentId).toBeTruthy()
    expect(result.resourceChoice.templateId).toBeTruthy()

    const agentNode = result.flow.nodes.find((n) => (n as { id?: string }).id === 'n-agent') as
      | { data?: { executionMode?: string; agentId?: string; templateId?: string } }
      | undefined
    expect(agentNode?.data?.executionMode).toBe('template')
    expect(agentNode?.data?.agentId).toBeTruthy()
    expect(agentNode?.data?.templateId).toBeTruthy()
    expect((agentNode?.data as { primaryLanguage?: string } | undefined)?.primaryLanguage).toBe('pt-BR')

    const { supabase } = await import('../lib/supabase')
    expect(vi.mocked(supabase.rpc).mock.calls.length).toBe(2)
  })

  it('deve falhar quando o plano LLM retornar inválido', async () => {
    chatTextMock.mockResolvedValueOnce({ success: true, content: '{}' })

    const { generateMvpFlowFromDescription } = await import('../services/flows/flow-generate-mvp.service')
    await expect(
      generateMvpFlowFromDescription('user@test.com', 'Descrição', 'pt-BR')
    ).rejects.toThrow(/template conversacional/)
  })
})
