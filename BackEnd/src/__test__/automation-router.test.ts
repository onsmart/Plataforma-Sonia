import { beforeEach, describe, expect, it, vi } from 'vitest'

const META_TEST_BUSINESS_NUMBER = '0000000000'

const { fromMock, runAgentWhatsAppTurnMock, executeFlowForChannelMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  runAgentWhatsAppTurnMock: vi.fn(),
  executeFlowForChannelMock: vi.fn()
}))

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock
  }
}))

vi.mock('../services/agents/agent-whatsapp-automation', () => ({
  runAgentWhatsAppTurn: runAgentWhatsAppTurnMock
}))

vi.mock('../services/flows/flow-channel-runtime', () => ({
  executeFlowForChannel: executeFlowForChannelMock
}))

vi.mock('../services/flows/flow-inbound-idempotency.service', () => ({
  claimInboundMessageProcessing: vi.fn().mockResolvedValue({ status: 'skipped', reason: 'test' })
}))

import { routeWhatsAppAutomation } from '../services/automation/automation-router'

function createQueryBuilder(result: { data: any; error: any }) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    or: vi.fn(() => builder),
    is: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
  }

  return builder
}

function mockSupabaseTables(tables: Record<string, { data: any; error: any }>) {
  fromMock.mockImplementation((table: string) => {
    const result = tables[table]

    if (!result) {
      throw new Error(`Tabela mockada ausente: ${table}`)
    }

    return createQueryBuilder(result)
  })
}

describe('WhatsApp automation router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve manter o caminho legado quando a integracao estiver em modo agent', async () => {
    mockSupabaseTables({
      tb_integrations: {
        data: {
          id: 'integration-1',
          companies_id: 'company-1',
          phone_number: '5511999999999',
          automation_mode: 'agent',
          linked_flow_id: null
        },
        error: null
      },
      tb_agents: {
        data: [{ id: 'agent-1', nome: 'Agente legado', status_id: 1 }],
        error: null
      },
      tb_flows: {
        data: null,
        error: null
      }
    })
    runAgentWhatsAppTurnMock.mockResolvedValue({ handled: true, agentResult: { reply: 'ok' } })

    const result = await routeWhatsAppAutomation({
      integrationId: 'integration-1',
      companiesId: 'company-1',
      userEmail: 'owner@example.com',
      messageText: 'Ola',
      phoneNumber: '5511999999999',
      from: '5511999999999@s.whatsapp.net',
      to: META_TEST_BUSINESS_NUMBER,
      contactId: 'contact-1',
      messageDbId: 'message-1'
    })

    expect(runAgentWhatsAppTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationId: 'integration-1',
        agentId: 'agent-1',
        userEmail: 'owner@example.com',
        messageText: 'Ola',
        contactId: 'contact-1'
      })
    )
    expect(executeFlowForChannelMock).not.toHaveBeenCalled()
    expect(result.mode).toBe('agent')
    expect(result.handled).toBe(true)
  })

  it('deve retornar integracao nao encontrada quando o registro nao existir', async () => {
    mockSupabaseTables({
      tb_integrations: {
        data: null,
        error: null
      },
      tb_agents: {
        data: [],
        error: null
      },
      tb_flows: {
        data: null,
        error: null
      }
    })

    const result = await routeWhatsAppAutomation({
      integrationId: 'integration-missing',
      companiesId: 'company-1',
      userEmail: 'owner@example.com',
      messageText: 'Ola',
      phoneNumber: '5511999999999',
      from: '5511999999999@s.whatsapp.net',
      to: META_TEST_BUSINESS_NUMBER,
      contactId: 'contact-1'
    })

    expect(runAgentWhatsAppTurnMock).not.toHaveBeenCalled()
    expect(executeFlowForChannelMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      handled: false,
      mode: 'none',
      reason: 'Integracao nao encontrada'
    })
  })

  it('deve executar o flow quando a integracao estiver em modo flow', async () => {
    mockSupabaseTables({
      tb_integrations: {
        data: {
          id: 'integration-1',
          companies_id: 'company-1',
          phone_number: '5511999999999',
          automation_mode: 'flow',
          linked_flow_id: 'flow-1'
        },
        error: null
      },
      tb_agents: {
        data: [],
        error: null
      },
      tb_flows: {
        data: {
          id: 'flow-1',
          name: 'Flow principal',
          companies_id: 'company-1'
        },
        error: null
      }
    })
    executeFlowForChannelMock.mockResolvedValue({
      context: { executionHistory: [], data: {}, flowId: 'flow-1', userId: 'user-1', userEmail: 'owner@example.com' },
      outboundMessage: 'Resposta do flow',
      delivery: { attempted: true, success: true }
    })

    const result = await routeWhatsAppAutomation({
      integrationId: 'integration-1',
      companiesId: 'company-1',
      userEmail: 'owner@example.com',
      messageText: 'Quero agendar',
      phoneNumber: '5511999999999',
      from: '5511999999999@s.whatsapp.net',
      to: META_TEST_BUSINESS_NUMBER,
      contactId: 'contact-1',
      messageDbId: 'message-1'
    })

    expect(executeFlowForChannelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        flowId: 'flow-1',
        deliveryChannel: 'whatsapp',
        integrationsId: 'integration-1',
        recipientId: 'contact-1'
      })
    )
    expect(runAgentWhatsAppTurnMock).not.toHaveBeenCalled()
    expect(result.mode).toBe('flow')
    expect(result.handled).toBe(true)
  })

  it('deve retornar de forma segura quando estiver em modo flow sem flow vinculado', async () => {
    mockSupabaseTables({
      tb_integrations: {
        data: {
          id: 'integration-1',
          companies_id: 'company-1',
          phone_number: '5511999999999',
          automation_mode: 'flow',
          linked_flow_id: null
        },
        error: null
      },
      tb_agents: {
        data: [],
        error: null
      },
      tb_flows: {
        data: null,
        error: null
      }
    })

    const result = await routeWhatsAppAutomation({
      integrationId: 'integration-1',
      companiesId: 'company-1',
      userEmail: 'owner@example.com',
      messageText: 'Oi',
      phoneNumber: '5511999999999',
      from: '5511999999999@s.whatsapp.net',
      to: META_TEST_BUSINESS_NUMBER,
      contactId: 'contact-1'
    })

    expect(result.handled).toBe(false)
    expect(result.mode).toBe('flow')
    expect(result.reason).toContain('linked_flow_id')
  })

  it('deve fazer fallback para agente quando estiver em modo hybrid e o flow nao entregar resposta', async () => {
    mockSupabaseTables({
      tb_integrations: {
        data: {
          id: 'integration-1',
          companies_id: 'company-1',
          phone_number: '5511999999999',
          automation_mode: 'hybrid',
          linked_flow_id: 'flow-1'
        },
        error: null
      },
      tb_agents: {
        data: [{ id: 'agent-1', nome: 'Fallback', status_id: 1 }],
        error: null
      },
      tb_flows: {
        data: {
          id: 'flow-1',
          name: 'Flow principal',
          companies_id: 'company-1'
        },
        error: null
      }
    })
    executeFlowForChannelMock.mockResolvedValue({
      context: { executionHistory: [], data: {}, flowId: 'flow-1', userId: 'user-1', userEmail: 'owner@example.com' },
      outboundMessage: null,
      delivery: { attempted: false, success: false, error: 'Sem resposta' }
    })
    runAgentWhatsAppTurnMock.mockResolvedValue({ handled: true, agentResult: { reply: 'fallback-ok' } })

    const result = await routeWhatsAppAutomation({
      integrationId: 'integration-1',
      companiesId: 'company-1',
      userEmail: 'owner@example.com',
      messageText: 'Preciso de ajuda',
      phoneNumber: '5511999999999',
      from: '5511999999999@s.whatsapp.net',
      to: META_TEST_BUSINESS_NUMBER,
      contactId: 'contact-1'
    })

    expect(executeFlowForChannelMock).toHaveBeenCalled()
    expect(runAgentWhatsAppTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationId: 'integration-1',
        agentId: 'agent-1',
        userEmail: 'owner@example.com',
        messageText: 'Preciso de ajuda'
      })
    )
    expect(result.mode).toBe('agent')
    expect(result.handled).toBe(true)
  })

  it('deve bloquear automacao quando o unico agente vinculado estiver pausado', async () => {
    mockSupabaseTables({
      tb_integrations: {
        data: {
          id: 'integration-1',
          companies_id: 'company-1',
          phone_number: '5511999999999',
          automation_mode: 'agent',
          linked_flow_id: null
        },
        error: null
      },
      tb_agents: {
        data: [{ id: 'agent-1', nome: 'Agente pausado', status_id: 3 }],
        error: null
      },
      tb_flows: {
        data: null,
        error: null
      }
    })

    const result = await routeWhatsAppAutomation({
      integrationId: 'integration-1',
      companiesId: 'company-1',
      userEmail: 'owner@example.com',
      messageText: 'Preciso de ajuda',
      phoneNumber: '5511999999999',
      from: '5511999999999@s.whatsapp.net',
      to: META_TEST_BUSINESS_NUMBER,
      contactId: 'contact-1'
    })

    expect(runAgentWhatsAppTurnMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      handled: false,
      mode: 'agent',
      agentId: 'agent-1',
      reason: 'Agente vinculado esta inativo'
    })
  })
})
