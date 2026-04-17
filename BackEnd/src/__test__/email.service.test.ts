import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sendMailFromIntegrationMock } = vi.hoisted(() => ({
  sendMailFromIntegrationMock: vi.fn(),
}))

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }
}))

vi.mock('../services/integrations/mail/mail-send.service', () => ({
  sendMailFromIntegration: sendMailFromIntegrationMock,
}))

import { sendEmail } from '../services/integrations/email/email.service'

describe('email.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('usa exclusivamente o provider da integracao ao enviar email', async () => {
    sendMailFromIntegrationMock.mockResolvedValue({
      provider: 'microsoft365_graph',
    })

    const result = await sendEmail('integration-123', {
      to: 'destinatario@empresa.com',
      subject: 'Teste',
      text: 'Mensagem',
    })

    expect(sendMailFromIntegrationMock).toHaveBeenCalledWith('integration-123', {
      to: 'destinatario@empresa.com',
      subject: 'Teste',
      text: 'Mensagem',
    })
    expect(result).toEqual({ provider: 'microsoft365_graph' })
  })

  it('retorna erro orientando revisar a integracao da conta quando o provider falha', async () => {
    sendMailFromIntegrationMock.mockRejectedValue(new Error('SMTP auth failed'))

    await expect(
      sendEmail('integration-123', {
        to: 'destinatario@empresa.com',
        subject: 'Teste',
        text: 'Mensagem',
      })
    ).rejects.toThrow(/revise as credenciais salvas para esta conta/i)
  })
})
