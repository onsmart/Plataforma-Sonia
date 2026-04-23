import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getAuthenticatedPlatformUserMock,
  listEmailIntegrationConfigsForUserMock,
  loadMailIntegrationConfigMock,
} = vi.hoisted(() => ({
  getAuthenticatedPlatformUserMock: vi.fn(),
  listEmailIntegrationConfigsForUserMock: vi.fn(),
  loadMailIntegrationConfigMock: vi.fn(),
}))

vi.mock('../services/integrations/mail/mail-integration.manager', () => ({
  getAuthenticatedPlatformUser: getAuthenticatedPlatformUserMock,
  listEmailIntegrationConfigsForUser: listEmailIntegrationConfigsForUserMock,
}))

vi.mock('../services/integrations/mail/mail-integration.repository', () => ({
  loadMailIntegrationConfig: loadMailIntegrationConfigMock,
}))

import {
  resolveMailIntegrationForRead,
  resolveMailIntegrationForSend,
} from '../services/integrations/mail/mail-integration.resolver'

describe('mail-integration.resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthenticatedPlatformUserMock.mockResolvedValue({
      id: 'user-1',
      email: 'mateus@empresa.com',
      companies_id: 'company-1',
    })
  })

  it('prioriza a integracao default ativa para envio', async () => {
    listEmailIntegrationConfigsForUserMock.mockResolvedValue({
      platformUser: { id: 'user-1', email: 'mateus@empresa.com', companies_id: 'company-1' },
      configs: [
        {
          integrationId: 'email-2',
          companyId: 'company-1',
          provider: 'email',
          providerFamily: 'generic_imap_smtp',
          authType: 'app_password',
          readMethod: 'imap',
          sendMethod: 'smtp',
          emailAddress: 'segundo@empresa.com',
          username: 'segundo@empresa.com',
          password: 'secret',
          status: 'connected',
          isActive: true,
          isDefault: false,
          canRead: true,
          canSend: true,
        },
        {
          integrationId: 'email-1',
          companyId: 'company-1',
          provider: 'email',
          providerFamily: 'generic_imap_smtp',
          authType: 'app_password',
          readMethod: 'imap',
          sendMethod: 'smtp',
          emailAddress: 'padrao@empresa.com',
          username: 'padrao@empresa.com',
          password: 'secret',
          status: 'connected',
          isActive: true,
          isDefault: true,
          canRead: true,
          canSend: true,
        },
      ],
    })

    const resolved = await resolveMailIntegrationForSend({ userEmail: 'mateus@empresa.com' })
    expect(resolved.integrationId).toBe('email-1')
  })

  it('ignora preferredIntegrationId invalido e cai para a default de leitura', async () => {
    loadMailIntegrationConfigMock.mockRejectedValue(new Error('nao encontrada'))
    listEmailIntegrationConfigsForUserMock.mockResolvedValue({
      platformUser: { id: 'user-1', email: 'mateus@empresa.com', companies_id: 'company-1' },
      configs: [
        {
          integrationId: 'email-3',
          companyId: 'company-1',
          provider: 'microsoft365',
          providerFamily: 'microsoft365',
          authType: 'oauth2',
          readMethod: 'graph',
          sendMethod: 'graph',
          emailAddress: 'graph@empresa.com',
          username: 'graph@empresa.com',
          accessToken: 'token',
          status: 'connected',
          isActive: true,
          isDefault: true,
          canRead: true,
          canSend: true,
        },
      ],
    })

    const resolved = await resolveMailIntegrationForRead({
      userEmail: 'mateus@empresa.com',
      preferredIntegrationId: 'whatsapp-123',
    })

    expect(resolved.integrationId).toBe('email-3')
  })
})
