import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock, chatWithAgentMock, executeFlowForChannelMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  chatWithAgentMock: vi.fn(),
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

vi.mock('../services/agents/chatwithAgent', () => ({
  chatWithAgent: chatWithAgentMock
}))

vi.mock('../services/flows/flow-channel-runtime', () => ({
  executeFlowForChannel: executeFlowForChannelMock
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
    chatWithAgentMock.mockResolvedValue('ok')

    const result = await routeWhatsAppAutomation({
      integrationId: 'integration-1',
      companiesId: 'company-1',
      userEmail: 'owner@example.com',
      messageText: 'Ola',
      phoneNumber: '5511999999999',
      from: '5511999999999@s.whatsapp.net',
      to: '15558991881',
      contactId: 'contact-1',
      messageDbId: 'message-1'
    })

    expect(chatWithAgentMock).toHaveBeenCalledWith(
      'owner@example.com',
      'agent-1',
      'Ola',
      expect.objectContaining({
        channel: 'whatsapp',
        integrations_id: 'integration-1',
        whatsapp_contact_id: 'contact-1'
      })
    )
    expect(executeFlowForChannelMock).not.toHaveBeenCalled()
    expect(result.mode).toBe('agent')
    expect(result.handled).toBe(true)
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
      to: '15558991881',
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
    expect(chatWithAgentMock).not.toHaveBeenCalled()
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
      to: '15558991881',
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
    chatWithAgentMock.mockResolvedValue('fallback-ok')

    const result = await routeWhatsAppAutomation({
      integrationId: 'integration-1',
      companiesId: 'company-1',
      userEmail: 'owner@example.com',
      messageText: 'Preciso de ajuda',
      phoneNumber: '5511999999999',
      from: '5511999999999@s.whatsapp.net',
      to: '15558991881',
      contactId: 'contact-1'
    })

    expect(executeFlowForChannelMock).toHaveBeenCalled()
    expect(chatWithAgentMock).toHaveBeenCalledWith(
      'owner@example.com',
      'agent-1',
      'Preciso de ajuda',
      expect.objectContaining({ channel: 'whatsapp' })
    )
    expect(result.mode).toBe('agent')
    expect(result.handled).toBe(true)
  })
})
