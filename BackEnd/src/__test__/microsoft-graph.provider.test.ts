import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getCurrentMailboxMock,
  refreshOutlookAccessTokenMock,
  persistMicrosoft365TokensMock,
  outlookClientConstructorMock,
} = vi.hoisted(() => ({
  getCurrentMailboxMock: vi.fn(),
  refreshOutlookAccessTokenMock: vi.fn(),
  persistMicrosoft365TokensMock: vi.fn(),
  outlookClientConstructorMock: vi.fn(),
}))

vi.mock('../services/integrations/email_reader/outlook/outlook.client', () => ({
  OutlookClient: function OutlookClient(accessToken: string) {
    outlookClientConstructorMock(accessToken)
    return {
      getCurrentMailbox: getCurrentMailboxMock,
      getInboxMessages: vi.fn(),
      getMessage: vi.fn(),
      sendMail: vi.fn(),
    }
  },
}))

vi.mock('../services/integrations/email_reader/outlook/outlook.oauth', () => ({
  refreshOutlookAccessToken: refreshOutlookAccessTokenMock,
}))

vi.mock('../services/integrations/mail/mail-integration.repository', () => ({
  persistMicrosoft365Tokens: persistMicrosoft365TokensMock,
}))

import { MicrosoftGraphMailProvider } from '../services/integrations/mail/providers/microsoft-graph.provider'

describe('microsoft-graph.provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renova token expirado antes de testar a conexao', async () => {
    refreshOutlookAccessTokenMock.mockResolvedValue({
      access_token: 'fresh-access-token',
      refresh_token: 'fresh-refresh-token',
      expires_in: 3600,
    })
    getCurrentMailboxMock.mockResolvedValue({
      mail: 'mailbox@empresa.com',
    })

    const provider = new MicrosoftGraphMailProvider({
      integrationId: 'integration-123',
      provider: 'microsoft365',
      providerFamily: 'microsoft365',
      authType: 'oauth2',
      readMethod: 'graph',
      sendMethod: 'graph',
      emailAddress: 'mailbox@empresa.com',
      username: 'mailbox@empresa.com',
      accessToken: 'expired-access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2020-01-01T00:00:00.000Z',
      canRead: true,
      canSend: true,
      rawIntegration: null,
      rawSettings: null,
    })

    const result = await provider.testConnection()

    expect(refreshOutlookAccessTokenMock).toHaveBeenCalledWith('refresh-token', {
      clientId: undefined,
      clientSecret: undefined,
      redirectUri: undefined,
      tenantId: undefined,
    })
    expect(persistMicrosoft365TokensMock).toHaveBeenCalledWith(
      'integration-123',
      expect.objectContaining({
        accessToken: 'fresh-access-token',
        refreshToken: 'fresh-refresh-token',
        emailAddress: 'mailbox@empresa.com',
      })
    )
    expect(outlookClientConstructorMock).toHaveBeenCalledWith('fresh-access-token')
    expect(result.success).toBe(true)
    expect(result.mailbox).toBe('mailbox@empresa.com')
  })
})
