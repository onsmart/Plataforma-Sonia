import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  listStoredTemplatesMock,
  sendWhatsAppMock,
  sendWhatsAppTemplateMock,
  getCustomerCareWindowStateMock
} = vi.hoisted(() => ({
  listStoredTemplatesMock: vi.fn(),
  sendWhatsAppMock: vi.fn(),
  sendWhatsAppTemplateMock: vi.fn(),
  getCustomerCareWindowStateMock: vi.fn()
}))

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock('../services/integrations/whatsapp/whatsapp-template-catalog.service', () => ({
  listStoredTemplates: listStoredTemplatesMock
}))

vi.mock('../services/integrations/whatsapp/whatsapp.dispatcher', () => ({
  sendWhatsApp: sendWhatsAppMock,
  sendWhatsAppTemplate: sendWhatsAppTemplateMock
}))

vi.mock('../services/integrations/whatsapp/whatsapp-session-window.service', () => ({
  getCustomerCareWindowState: getCustomerCareWindowStateMock
}))

import { sendFlowWhatsAppMessage } from '../services/integrations/whatsapp/whatsapp-flow-message.service'

describe('whatsapp-flow-message.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('usa template configurado manualmente fora da janela mesmo sem catálogo sincronizado', async () => {
    getCustomerCareWindowStateMock.mockResolvedValue({
      insideWindow: false,
      conservativeUnknown: true,
      expiresAt: null,
      lastInboundAt: null
    })
    listStoredTemplatesMock.mockResolvedValue([])
    sendWhatsAppTemplateMock.mockResolvedValue({
      success: true,
      messageId: 'wamid-1'
    })

    const result = await sendFlowWhatsAppMessage({
      integrationsId: 'integration-1',
      to: '5511999999999',
      flowId: 'flow-1',
      nodeId: 'node-3',
      messageType: 'link',
      messageText: 'Olá! Temos um horário disponível.',
      linkUrl: 'https://calendly.com/teste',
      fallbackTemplateName: 'envio_link_agendamento',
      fallbackTemplateLanguage: 'pt-br'
    })

    expect(sendWhatsAppTemplateMock).toHaveBeenCalledWith(
      'integration-1',
      expect.objectContaining({
        to: '5511999999999',
        templateName: 'envio_link_agendamento',
        languageCode: 'pt_BR'
      })
    )
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        sendMode: 'automatic_template',
        templateName: 'envio_link_agendamento',
        languageCode: 'pt_BR'
      })
    )
  })

  it('expõe mensagem mais precisa quando a Meta rejeita o template automático', async () => {
    getCustomerCareWindowStateMock.mockResolvedValue({
      insideWindow: false,
      conservativeUnknown: true,
      expiresAt: null,
      lastInboundAt: null
    })
    listStoredTemplatesMock.mockResolvedValue([])
    sendWhatsAppTemplateMock.mockResolvedValue({
      success: false,
      error: 'Meta Cloud API: (#132012) Parameter format does not match format in the created template'
    })

    const result = await sendFlowWhatsAppMessage({
      integrationsId: 'integration-1',
      to: '5511999999999',
      flowId: 'flow-1',
      nodeId: 'node-3',
      messageType: 'link',
      messageText: 'Olá! Temos um horário disponível.',
      linkUrl: 'https://calendly.com/teste',
      fallbackTemplateName: 'envio_link_agendamento',
      fallbackTemplateLanguage: 'pt-br'
    })

    expect(result.success).toBe(false)
    expect(result.userMessage).toContain('Meta rejeitou o template configurado')
    expect(result.userMessage).toContain('Template Meta com components')
  })
})
