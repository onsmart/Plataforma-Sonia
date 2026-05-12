import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  connectMock,
  logoutMock,
  verifyMock,
  createTransportMock,
} = vi.hoisted(() => ({
  connectMock: vi.fn(),
  logoutMock: vi.fn(),
  verifyMock: vi.fn(),
  createTransportMock: vi.fn(),
}))

vi.mock('../lib/tls-ca', () => ({
  loadOptionalMailTlsCaBundle: vi.fn(() => null)
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: createTransportMock
  }
}))

vi.mock('imapflow', () => ({
  ImapFlow: class {
    async connect() {
      return connectMock()
    }

    async logout() {
      return logoutMock()
    }
  }
}))

import { ImapSmtpMailProvider } from '../services/integrations/mail/providers/imap-smtp.provider'

describe('imap-smtp.provider testConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createTransportMock.mockReturnValue({
      verify: verifyMock
    })
    connectMock.mockResolvedValue(undefined)
    logoutMock.mockResolvedValue(undefined)
    verifyMock.mockResolvedValue(true)
  })

  it('retorna sucesso parcial quando IMAP falha mas SMTP responde', async () => {
    connectMock.mockRejectedValueOnce(new Error('invalid login'))

    const provider = new ImapSmtpMailProvider({
      integrationId: 'email-1',
      provider: 'email',
      providerFamily: 'generic_imap_smtp',
      authType: 'app_password',
      readMethod: 'imap',
      sendMethod: 'smtp',
      emailAddress: 'contato@empresa.com',
      username: 'contato@empresa.com',
      password: 'secret',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpSecure: false,
      imapHost: 'imap.gmail.com',
      imapPort: 993,
      imapSecure: true,
      canRead: true,
      canSend: true,
    })

    const result = await provider.testConnection()

    expect(result.success).toBe(true)
    expect(result.capabilities).toEqual({
      canRead: false,
      canSend: true,
    })
    expect(result.details).toContain('IMAP falhou:')
    expect(result.details).toContain('SMTP OK')
  })

  it('retorna falha controlada quando IMAP e SMTP falham', async () => {
    connectMock.mockRejectedValueOnce(new Error('IMAP auth failed'))
    verifyMock.mockRejectedValueOnce(new Error('SMTP auth failed'))

    const provider = new ImapSmtpMailProvider({
      integrationId: 'email-1',
      provider: 'email',
      providerFamily: 'generic_imap_smtp',
      authType: 'app_password',
      readMethod: 'imap',
      sendMethod: 'smtp',
      emailAddress: 'contato@empresa.com',
      username: 'contato@empresa.com',
      password: 'secret',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpSecure: false,
      imapHost: 'imap.gmail.com',
      imapPort: 993,
      imapSecure: true,
      canRead: true,
      canSend: true,
    })

    const result = await provider.testConnection()

    expect(result.success).toBe(false)
    expect(result.capabilities).toEqual({
      canRead: false,
      canSend: false,
    })
    expect(result.details).toContain('IMAP falhou:')
    expect(result.details).toContain('SMTP falhou:')
  })
})
