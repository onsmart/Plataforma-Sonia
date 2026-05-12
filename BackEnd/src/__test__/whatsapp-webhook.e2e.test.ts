import { beforeEach, describe, expect, it, vi } from 'vitest'

const META_TEST_BUSINESS_NUMBER = '0000000000'
const META_TEST_BUSINESS_DISPLAY_NUMBER = '+00 0000-0000'

const {
  fromMock,
  createOrUpdateContactMock,
  saveMessageToHistoryMock,
  saveWhatsAppMessageMock,
  updateWhatsAppMessageStatusMock,
  routeWhatsAppAutomationMock,
  recordWhatsappMessageEventMock,
  saveSystemLogMock
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  createOrUpdateContactMock: vi.fn(),
  saveMessageToHistoryMock: vi.fn(),
  saveWhatsAppMessageMock: vi.fn(),
  updateWhatsAppMessageStatusMock: vi.fn(),
  routeWhatsAppAutomationMock: vi.fn(),
  recordWhatsappMessageEventMock: vi.fn(),
  saveSystemLogMock: vi.fn()
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

vi.mock('../services/integrations/whatsapp', () => ({
  checkConnectionStatus: vi.fn()
}))

vi.mock('../services/integrations/whatsapp/whatsapp.redis', () => ({
  clearHistory: vi.fn(),
  getHistoryFromRedis: vi.fn(),
  getUnreadConversations: vi.fn(),
  saveMessageToHistory: saveMessageToHistoryMock
}))

vi.mock('../services/integrations/whatsapp/whatsapp.contacts', () => ({
  createOrUpdateContact: createOrUpdateContactMock
}))

vi.mock('../services/integrations/whatsapp/whatsapp.service', () => ({
  getWhatsAppHistory: vi.fn(),
  saveWhatsAppMessage: saveWhatsAppMessageMock,
  updateWhatsAppMessageStatus: updateWhatsAppMessageStatusMock
}))

vi.mock('../services/automation/automation-router', () => ({
  routeWhatsAppAutomation: routeWhatsAppAutomationMock
}))

vi.mock('../services/integrations/whatsapp/whatsapp-message-events.service', () => ({
  recordWhatsappMessageEvent: recordWhatsappMessageEventMock
}))

vi.mock('../services/integrations/whatsapp/whatsapp-template-catalog.service', () => ({
  listStoredTemplates: vi.fn(),
  syncTemplatesFromMetaForIntegration: vi.fn()
}))

vi.mock('../services/integrations/whatsapp/whatsapp.dispatcher', () => ({
  acceptWhatsAppCall: vi.fn(),
  preAcceptWhatsAppCall: vi.fn(),
  rejectWhatsAppCall: vi.fn(),
  sendWhatsAppTemplate: vi.fn()
}))

vi.mock('../services/integrations/whatsapp/whatsapp-campaign.service', () => ({
  createCampaignRecord: vi.fn(),
  enqueueCampaignContacts: vi.fn(),
  processCampaignJobsOnce: vi.fn()
}))

vi.mock('../modules/voice/services/voiceProfile.service', () => ({
  getStoredAgentVoiceProfile: vi.fn()
}))

vi.mock('../modules/voice/services/voiceRuntime.service', () => ({
  getRealtimeVoiceAgentService: vi.fn(() => ({}))
}))

vi.mock('../modules/voice/services/voiceCallSession.service', () => ({
  upsertVoiceCallSession: vi.fn()
}))

vi.mock('../services/governance/governance-postprocessing', () => ({
  applyDLP: vi.fn()
}))

vi.mock('../services/governance/governance.service', () => ({
  FALLBACK_GOVERNANCE_FOR_PREPROCESS: {},
  getGovernanceConfig: vi.fn()
}))

vi.mock('../services/system-logs', () => ({
  saveSystemLog: saveSystemLogMock
}))

import { receiveWhatsAppWebhook } from '../api/controllers/whatsapp.controller'

type QueryResult = { data: any; error: any }
type TableHandler = (state: {
  table: string
  filters: Record<string, any>
  select?: string
  order?: { column: string; options?: any }
}) => QueryResult

function createQueryBuilder(table: string, handler: TableHandler) {
  const state: {
    table: string
    filters: Record<string, any>
    select?: string
    order?: { column: string; options?: any }
  } = {
    table,
    filters: {}
  }

  const builder: any = {
    select: vi.fn((value: string) => {
      state.select = value
      return builder
    }),
    eq: vi.fn((column: string, value: any) => {
      state.filters[column] = value
      return builder
    }),
    order: vi.fn((column: string, options?: any) => {
      state.order = { column, options }
      return builder
    }),
    maybeSingle: vi.fn().mockImplementation(async () => handler(state)),
    then: (resolve: any, reject: any) => Promise.resolve(handler(state)).then(resolve, reject)
  }

  return builder
}

function mockSupabase(handlers: Record<string, TableHandler>) {
  fromMock.mockImplementation((table: string) => {
    const handler = handlers[table]

    if (!handler) {
      throw new Error(`Tabela mockada ausente: ${table}`)
    }

    return createQueryBuilder(table, handler)
  })
}

function createMockReq(body: any) {
  return { body } as any
}

function createMockRes() {
  const response: any = {
    statusCode: 200,
    body: undefined,
    status: vi.fn((code: number) => {
      response.statusCode = code
      return response
    }),
    json: vi.fn((payload: any) => {
      response.body = payload
      return response
    })
  }

  return response
}

function buildMetaTextPayload() {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: META_TEST_BUSINESS_DISPLAY_NUMBER,
                phone_number_id: '1234567890'
              },
              messages: [
                {
                  from: '5511999999999',
                  id: 'wamid.abc',
                  timestamp: '1710000000',
                  type: 'text',
                  text: {
                    body: 'Teste oficial Meta'
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  }
}

describe('WhatsApp webhook E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createOrUpdateContactMock.mockResolvedValue({
      success: true,
      contact: { id: 'contact-1' }
    })
    saveWhatsAppMessageMock.mockResolvedValue({
      success: true,
      id: 'message-db-1'
    })
    updateWhatsAppMessageStatusMock.mockResolvedValue({
      success: true,
      updatedCount: 1
    })
    routeWhatsAppAutomationMock.mockResolvedValue({
      handled: true,
      mode: 'agent',
      agentId: 'agent-1'
    })
    recordWhatsappMessageEventMock.mockResolvedValue(undefined)
    saveSystemLogMock.mockResolvedValue(undefined)
  })

  it('deve receber webhook, salvar inbound e disparar a automacao do agente', async () => {
    mockSupabase({
      tb_integrations: ({ filters, select }) => {
        if (filters.provider === 'whatsapp' && filters.app_key === '1234567890') {
          return {
            data: {
              id: 'integration-1',
              user_id: 'user-1',
              companies_id: 'company-1',
              phone_number: META_TEST_BUSINESS_NUMBER,
              app_key: '1234567890',
              provider: 'whatsapp',
              created_at: '2026-05-11T10:00:00.000Z'
            },
            error: null
          }
        }

        if (filters.id === 'integration-1' && String(select || '').includes('tb_users!inner(email)')) {
          return {
            data: {
              user_id: 'user-1',
              phone_number: META_TEST_BUSINESS_NUMBER,
              tb_users: { email: 'owner@example.com' }
            },
            error: null
          }
        }

        return { data: null, error: null }
      },
      tb_agents: () => ({
        data: [{ id: 'agent-1', nome: 'Agente oficial', status_id: 1 }],
        error: null
      })
    })

    const req = createMockReq(buildMetaTextPayload())
    const res = createMockRes()

    await receiveWhatsAppWebhook(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.body).toMatchObject({
      received: true,
      processed: 1
    })
    expect(createOrUpdateContactMock).toHaveBeenCalledWith({
      lid: '5511999999999',
      phone_number: '5511999999999',
      status: 'active'
    })
    expect(saveMessageToHistoryMock).toHaveBeenCalledWith(
      'integration-1',
      '5511999999999',
      'user',
      'Teste oficial Meta'
    )
    expect(saveWhatsAppMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsapp_contact_id: 'contact-1',
        message: 'Teste oficial Meta',
        message_id: 'wamid.abc',
        direction: 'inbound',
        integrations_id: 'integration-1',
        agent_id: 'agent-1'
      })
    )
    expect(routeWhatsAppAutomationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationId: 'integration-1',
        userEmail: 'owner@example.com',
        messageText: 'Teste oficial Meta',
        phoneNumber: '5511999999999',
        from: '5511999999999@s.whatsapp.net',
        to: META_TEST_BUSINESS_NUMBER,
        contactId: 'contact-1',
        messageDbId: 'message-db-1'
      })
    )
    expect(saveSystemLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        log_type: 'whatsapp_inbound',
        user_email: 'owner@example.com'
      })
    )
    expect(recordWhatsappMessageEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        integrations_id: 'integration-1',
        whatsapp_contact_id: 'contact-1',
        wamid: 'wamid.abc',
        event_type: 'received'
      })
    )
  })

  it('deve ignorar a mensagem quando nao encontrar a integracao oficial', async () => {
    mockSupabase({
      tb_integrations: () => ({
        data: null,
        error: null
      }),
      tb_agents: () => ({
        data: [],
        error: null
      })
    })

    const req = createMockReq(buildMetaTextPayload())
    const res = createMockRes()

    await receiveWhatsAppWebhook(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.body).toMatchObject({
      received: true,
      processed: 0
    })
    expect(createOrUpdateContactMock).not.toHaveBeenCalled()
    expect(saveWhatsAppMessageMock).not.toHaveBeenCalled()
    expect(routeWhatsAppAutomationMock).not.toHaveBeenCalled()
  })
})
