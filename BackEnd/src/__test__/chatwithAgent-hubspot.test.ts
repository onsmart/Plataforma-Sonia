import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  chatTextMock,
  getAgentsByEmailMock,
  getAgentFromCacheMock,
  getUserIdAndCompanyIdByEmailMock,
  getCompanyIdByEmailMock,
  getGovernanceConfigMock,
  fromMock,
  getHubSpotContactsMock,
  searchHubSpotContactsMock,
  createHubSpotContactMock,
  updateHubSpotContactMock,
} = vi.hoisted(() => ({
  chatTextMock: vi.fn(),
  getAgentsByEmailMock: vi.fn(),
  getAgentFromCacheMock: vi.fn(),
  getUserIdAndCompanyIdByEmailMock: vi.fn(),
  getCompanyIdByEmailMock: vi.fn(),
  getGovernanceConfigMock: vi.fn(),
  fromMock: vi.fn(),
  getHubSpotContactsMock: vi.fn(),
  searchHubSpotContactsMock: vi.fn(),
  createHubSpotContactMock: vi.fn(),
  updateHubSpotContactMock: vi.fn(),
}))

vi.mock('../lib/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
  }
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock
  }
}))

vi.mock('../services/llm/openai', () => ({
  chatText: chatTextMock
}))

vi.mock('../services/agents/index', () => ({
  getAgentsByEmail: getAgentsByEmailMock
}))

vi.mock('../services/agents/getagentfromcache', () => ({
  getAgentFromCache: getAgentFromCacheMock
}))

vi.mock('../utils/company-helper', () => ({
  getCompanyIdByEmail: getCompanyIdByEmailMock,
  getUserIdAndCompanyIdByEmail: getUserIdAndCompanyIdByEmailMock
}))

vi.mock('../services/governance', async () => {
  const actual = await vi.importActual('../services/governance')
  return {
    ...(actual as Record<string, unknown>),
    getGovernanceConfig: getGovernanceConfigMock
  }
})

vi.mock('../services/agents/confidence-calculator', () => ({
  calculateConfidence: vi.fn(() => ({
    confidence_score: 0.95,
    reason: 'ok',
    should_block: false
  })),
  getConfidenceApprovalThreshold: vi.fn(() => 0.7)
}))

vi.mock('../services/agents/prompt-builder', () => ({
  buildAgentSystemPrompt: vi.fn(() => 'prompt')
}))

vi.mock('../services/agents/consultarArquivos', () => ({
  consultarArquivos: vi.fn()
}))

vi.mock('../services/agents/save-decision', () => ({
  saveBlockedDecision: vi.fn()
}))

vi.mock('../services/flows/fallback-events', () => ({
  saveFallbackEvent: vi.fn()
}))

vi.mock('../services/system-logs', () => ({
  saveSystemLog: vi.fn()
}))

vi.mock('../services/integrations/email/email.service', () => ({
  sendEmailForUser: vi.fn()
}))

vi.mock('../services/agents/readEmailsWithAgent', () => ({
  readEmailsWithAgent: vi.fn()
}))

vi.mock('../services/integrations/whatsapp/whatsapp.service', () => ({
  markMessagesAsRead: vi.fn()
}))

vi.mock('../services/integrations/whatsapp/whatsapp.dispatcher', () => ({
  sendWhatsApp: vi.fn()
}))

vi.mock('../services/integrations/whatsapp/whatsapp.redis', () => ({
  getHistoryFromRedis: vi.fn(),
  getUnreadConversations: vi.fn(),
  saveMessageToHistory: vi.fn()
}))

vi.mock('../modules/voice/services/voiceRuntime.service', () => ({
  sendAgentWhatsAppResponseWithVoiceFallback: vi.fn()
}))

vi.mock('../services/integrations/crm/hubspot.service', () => ({
  getHubSpotContacts: getHubSpotContactsMock,
  searchHubSpotContacts: searchHubSpotContactsMock,
  getHubSpotDeals: vi.fn(),
  createHubSpotContact: createHubSpotContactMock,
  updateHubSpotContact: updateHubSpotContactMock,
}))

import { chatWithAgent } from '../services/agents/chatwithAgent'
import { FALLBACK_GOVERNANCE_FOR_PREPROCESS } from '../services/governance/governance.service'

function createQueryBuilder(table: string) {
  const state: Record<string, any> = { table, filters: {} }
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: any) => {
      state.filters[column] = value
      return builder
    }),
    single: vi.fn().mockImplementation(async () => {
      if (table === 'tb_crm_integrations') {
        return {
          data: {
            id: 'crm-int-1',
            tb_crms: { id: 'crm-1', slug: 'hubspot', name: 'HubSpot' }
          },
          error: null
        }
      }

      if (table === 'tb_agents') {
        return {
          data: {
            crm_integration_id: 'crm-int-1'
          },
          error: null
        }
      }

      if (table === 'tb_users') {
        return {
          data: { id: 'user-1' },
          error: null
        }
      }

      return { data: null, error: null }
    }),
    maybeSingle: vi.fn().mockImplementation(async () => ({ data: null, error: null })),
    then: (resolve: any, reject: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject)
  }
  return builder
}

describe('chatWithAgent hubspot actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fromMock.mockImplementation((table: string) => createQueryBuilder(table))
    getUserIdAndCompanyIdByEmailMock.mockResolvedValue({
      userId: 'user-1',
      companyId: 'company-1'
    })
    getCompanyIdByEmailMock.mockResolvedValue('company-1')
    getGovernanceConfigMock.mockResolvedValue(FALLBACK_GOVERNANCE_FOR_PREPROCESS)
    getAgentsByEmailMock.mockResolvedValue([
      {
        id: 'agent-1',
        nome: 'Sonia CRM',
        status_id: 1,
        role: 'CRM agent',
        personality_prompt: 'Seja útil',
        primary_language: 'pt-BR',
        extra_features: null,
        crm_integration_id: 'crm-int-1'
      }
    ])
    getAgentFromCacheMock.mockReturnValue({
      id: 'agent-1',
      nome: 'Sonia CRM',
      status_id: 1,
      role: 'CRM agent',
      personality_prompt: 'Seja útil',
      primary_language: 'pt-BR',
      extra_features: null,
      crm_integration_id: 'crm-int-1'
    })
  })

  it('lê contatos do HubSpot via action read_crm com filtros estruturados', async () => {
    chatTextMock.mockResolvedValueOnce({
      success: true,
      content: JSON.stringify({
        action: 'read_crm',
        entity_type: 'contacts',
        limit: 5,
        filters: [
          { field: 'firstname', operator: 'starts_with', value: 'Mat' }
        ]
      })
    })
    searchHubSpotContactsMock.mockResolvedValueOnce([
      { id: 'hs-1', firstname: 'Mateus', email: 'mateus@example.com', properties: { firstname: 'Mateus' } }
    ])

    const reply = await chatWithAgent('owner@example.com', 'agent-1', 'Buscar contatos no CRM', { channel: 'webchat' })
    const parsed = JSON.parse(String(reply))

    expect(searchHubSpotContactsMock).toHaveBeenCalledWith(
      'crm-int-1',
      5,
      { firstnameStartsWith: 'Mat' },
      ['firstname', 'lastname', 'email', 'phone', 'company', 'lifecyclestage'],
      [{ field: 'firstname', operator: 'starts_with', value: 'Mat' }]
    )
    expect(parsed).toMatchObject({
      action: 'read_crm'
    })
    expect(parsed.data).toHaveLength(1)
  })

  it('cria contato no HubSpot via action crm_capture_lead', async () => {
    chatTextMock.mockResolvedValueOnce({
      success: true,
      content: JSON.stringify({
        action: 'crm_capture_lead',
        firstname: 'Ana',
        lastname: 'Silva',
        email: 'ana@example.com',
        phone: '5511999999999',
        company: 'OnSmart'
      })
    })
    createHubSpotContactMock.mockResolvedValueOnce({
      id: 'hs-new-1',
      firstname: 'Ana',
      email: 'ana@example.com'
    })

    const reply = await chatWithAgent('owner@example.com', 'agent-1', 'Criar lead no CRM', { channel: 'webchat' })
    const parsed = JSON.parse(String(reply))

    expect(createHubSpotContactMock).toHaveBeenCalledWith(
      'crm-int-1',
      expect.objectContaining({
        firstname: 'Ana',
        lastname: 'Silva',
        email: 'ana@example.com',
        phone: '5511999999999',
        company: 'OnSmart'
      })
    )
    expect(parsed).toMatchObject({
      action: 'create_crm_contact',
      success: true,
      crm: 'hubspot'
    })
  })

  it('atualiza contato no HubSpot via action update_crm_contact', async () => {
    chatTextMock.mockResolvedValueOnce({
      success: true,
      content: JSON.stringify({
        action: 'update_crm_contact',
        contact_id: 'hs-77',
        email: 'atualizado@example.com',
        phone: '5511888888888'
      })
    })
    updateHubSpotContactMock.mockResolvedValueOnce({
      id: 'hs-77',
      email: 'atualizado@example.com'
    })

    const reply = await chatWithAgent('owner@example.com', 'agent-1', 'Atualizar lead no CRM', { channel: 'webchat' })
    const parsed = JSON.parse(String(reply))

    expect(updateHubSpotContactMock).toHaveBeenCalledWith(
      'crm-int-1',
      'hs-77',
      expect.objectContaining({
        email: 'atualizado@example.com',
        phone: '5511888888888'
      })
    )
    expect(parsed).toMatchObject({
      action: 'update_crm_contact',
      success: true,
      crm: 'hubspot'
    })
  })
})
