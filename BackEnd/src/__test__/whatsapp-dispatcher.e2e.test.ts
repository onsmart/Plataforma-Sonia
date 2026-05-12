import { beforeEach, describe, expect, it, vi } from 'vitest'

const META_TEST_BUSINESS_NUMBER = '0000000000'

const {
  axiosPostMock,
  fromMock,
  getContactNumberForSendingMock,
  saveWhatsAppMessageMock,
  markMessagesAsReadMock,
  createOrUpdateContactMock,
  getContactByPhoneNumberMock,
  getHistoryFromRedisMock,
  saveMessageToHistoryMock,
  saveSystemLogMock
} = vi.hoisted(() => ({
  axiosPostMock: vi.fn(),
  fromMock: vi.fn(),
  getContactNumberForSendingMock: vi.fn(),
  saveWhatsAppMessageMock: vi.fn(),
  markMessagesAsReadMock: vi.fn(),
  createOrUpdateContactMock: vi.fn(),
  getContactByPhoneNumberMock: vi.fn(),
  getHistoryFromRedisMock: vi.fn(),
  saveMessageToHistoryMock: vi.fn(),
  saveSystemLogMock: vi.fn()
}))

vi.mock('axios', () => ({
  default: {
    post: axiosPostMock
  }
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

vi.mock('../services/integrations/whatsapp/whatsapp.service', () => ({
  getContactNumberForSending: getContactNumberForSendingMock,
  markMessagesAsRead: markMessagesAsReadMock,
  saveWhatsAppMessage: saveWhatsAppMessageMock
}))

vi.mock('../services/integrations/whatsapp/whatsapp.contacts', () => ({
  createOrUpdateContact: createOrUpdateContactMock,
  getContactByPhoneNumber: getContactByPhoneNumberMock
}))

vi.mock('../services/integrations/whatsapp/whatsapp.redis', () => ({
  getHistoryFromRedis: getHistoryFromRedisMock,
  saveMessageToHistory: saveMessageToHistoryMock
}))

vi.mock('../services/integrations/whatsapp/whatsapp-template-payload', () => ({
  buildCloudApiTemplateMessageBody: vi.fn()
}))

vi.mock('../services/integrations/whatsapp/whatsapp-feature-flags', () => ({
  isTemplatesEnabledForIntegration: vi.fn()
}))

vi.mock('../services/integrations/whatsapp/whatsapp-message-events.service', () => ({
  recordWhatsappMessageEvent: vi.fn()
}))

vi.mock('../services/system-logs', () => ({
  saveSystemLog: saveSystemLogMock
}))

import { sendWhatsApp } from '../services/integrations/whatsapp/whatsapp.dispatcher'

type QueryResult = { data: any; error: any }

function createQueryBuilder(table: string, resolver: (table: string, filters: Record<string, any>) => QueryResult) {
  const filters: Record<string, any> = {}

  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: any) => {
      filters[column] = value
      return builder
    }),
    maybeSingle: vi.fn().mockImplementation(async () => resolver(table, filters)),
    then: (resolve: any, reject: any) => Promise.resolve(resolver(table, filters)).then(resolve, reject)
  }

  return builder
}

function mockSupabase(resolver: (table: string, filters: Record<string, any>) => QueryResult) {
  fromMock.mockImplementation((table: string) => createQueryBuilder(table, resolver))
}

describe('WhatsApp dispatcher E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockSupabase((table, filters) => {
      if (table === 'tb_integrations' && filters.id === 'integration-1') {
        return {
          data: {
            id: 'integration-1',
            user_id: 'user-1',
            companies_id: 'company-1',
            phone_number: META_TEST_BUSINESS_NUMBER,
            provider: 'whatsapp',
            access_token: 'meta-token',
            app_key: '1234567890',
            auth_token: 'verify-token'
          },
          error: null
        }
      }

      if (table === 'tb_users' && filters.id === 'user-1') {
        return {
          data: {
            email: 'owner@example.com'
          },
          error: null
        }
      }

      return { data: null, error: null }
    })

    axiosPostMock.mockResolvedValue({
      data: {
        messages: [{ id: 'wamid.outbound.1' }]
      }
    })
    getContactNumberForSendingMock.mockResolvedValue({
      success: true,
      number: '5511999999999'
    })
    getHistoryFromRedisMock.mockResolvedValue([{ role: 'user', content: 'Ola' }])
    getContactByPhoneNumberMock.mockResolvedValue({
      success: true,
      contact: { id: 'contact-1' }
    })
    createOrUpdateContactMock.mockResolvedValue({
      success: true,
      contact: { id: 'contact-1' }
    })
    saveWhatsAppMessageMock.mockResolvedValue({
      success: true,
      id: 'message-db-outbound-1'
    })
    markMessagesAsReadMock.mockResolvedValue(undefined)
    saveSystemLogMock.mockResolvedValue(undefined)
  })

  it('deve enviar outbound via Meta e persistir a resposta no historico e no banco', async () => {
    const result = await sendWhatsApp('integration-1', {
      to: '5511999999999',
      message: 'Resposta automatica',
      agentId: 'agent-1',
      context: {
        request_started_at: '2026-05-12T12:00:00.000Z',
        automation_source: 'webhook'
      }
    })

    expect(result).toMatchObject({
      success: true,
      messageId: 'wamid.outbound.1'
    })
    expect(axiosPostMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v23.0/1234567890/messages',
      expect.objectContaining({
        messaging_product: 'whatsapp',
        to: '5511999999999',
        type: 'text'
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer meta-token'
        })
      })
    )
    expect(saveMessageToHistoryMock).toHaveBeenCalledWith(
      'integration-1',
      '5511999999999@s.whatsapp.net',
      'assistant',
      'Resposta automatica'
    )
    expect(saveWhatsAppMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsapp_contact_id: 'contact-1',
        message: 'Resposta automatica',
        message_id: 'wamid.outbound.1',
        direction: 'outbound',
        integrations_id: 'integration-1',
        agent_id: 'agent-1',
        metadata: expect.objectContaining({
          whatsapp_status: 'accepted',
          request_started_at: '2026-05-12T12:00:00.000Z',
          automation_source: 'webhook'
        })
      })
    )
    expect(markMessagesAsReadMock).toHaveBeenCalledWith('contact-1', 'integration-1')
    expect(saveSystemLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        log_type: 'whatsapp_outbound',
        user_email: 'owner@example.com'
      })
    )
  })
})
