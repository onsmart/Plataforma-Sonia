import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  fromMock,
  createSignedOutlookStateMock,
  createOutlookAuthorizeUrlMock,
  loadMailIntegrationConfigMock,
  testMailIntegrationConnectionMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  createSignedOutlookStateMock: vi.fn(),
  createOutlookAuthorizeUrlMock: vi.fn(),
  loadMailIntegrationConfigMock: vi.fn(),
  testMailIntegrationConnectionMock: vi.fn(),
}))

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  }
}))

vi.mock('../services/integrations/email_reader/outlook/outlook.oauth', () => ({
  createSignedOutlookState: createSignedOutlookStateMock,
  createOutlookAuthorizeUrl: createOutlookAuthorizeUrlMock,
}))

vi.mock('../services/integrations/mail', () => ({
  loadMailIntegrationConfig: loadMailIntegrationConfigMock,
  normalizeMailProviderFamily: vi.fn((provider: string) =>
    ['microsoft365', 'outlook', 'office365'].includes(String(provider || '').toLowerCase())
      ? 'microsoft365'
      : 'generic_imap_smtp'
  ),
  testMailIntegrationConnection: testMailIntegrationConnectionMock,
}))

import {
  getMicrosoft365AuthorizeUrl,
  upsertCurrentEmailIntegration,
} from '../api/controllers/email.controller'

function createResponseMock() {
  const response: any = {
    status: vi.fn(() => response),
    json: vi.fn(() => response),
  }

  return response
}

function createBuilder(result: { data?: any; error?: any }) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
    update: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  }

  return builder
}

describe('email.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('gera URL segura do Microsoft 365 para usuario autenticado', async () => {
    createSignedOutlookStateMock.mockReturnValue('signed-state')
    createOutlookAuthorizeUrlMock.mockReturnValue({
      authorizeUrl: 'https://login.microsoftonline.com/mock',
      redirectUri: 'http://localhost:3333/auth/outlook/callback',
    })

    const req: any = {
      user: {
        email: 'mateus.mantovani@onsmart.com.br',
        userId: 'user-123',
      },
      protocol: 'http',
      headers: {
        host: 'localhost:3333',
      },
    }
    const res = createResponseMock()

    await getMicrosoft365AuthorizeUrl(req, res)

    expect(createSignedOutlookStateMock).toHaveBeenCalledWith({
      userId: 'user-123',
      userEmail: 'mateus.mantovani@onsmart.com.br',
    })
    expect(createOutlookAuthorizeUrlMock).toHaveBeenCalledWith({
      state: 'signed-state',
      requestOrigin: 'http://localhost:3333',
    })
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        authorizeUrl: 'https://login.microsoftonline.com/mock',
      })
    )
  })

  it('salva integracao microsoft365 nova com status pending antes do OAuth concluir', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'tb_users') {
        return createBuilder({ data: { id: 'user-123' }, error: null })
      }

      if (table === 'tb_company_users') {
        return createBuilder({ data: { companies_id: 'company-123' }, error: null })
      }

      if (table === 'tb_integrations') {
        return createBuilder({ data: { id: 'integration-123' }, error: null })
      }

      if (table === 'tb_email_integration_settings') {
        return createBuilder({ data: null, error: null })
      }

      throw new Error(`Tabela nao mockada: ${table}`)
    })

    loadMailIntegrationConfigMock.mockResolvedValue({
      integrationId: 'integration-123',
      provider: 'microsoft365',
      providerFamily: 'microsoft365',
      authType: 'oauth2',
      readMethod: 'none',
      sendMethod: 'none',
      emailAddress: 'mateus.mantovani@onsmart.com.br',
      username: 'mateus.mantovani@onsmart.com.br',
      password: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      smtpHost: 'smtp.office365.com',
      smtpPort: 587,
      smtpSecure: false,
      imapHost: null,
      imapPort: null,
      imapSecure: null,
      scopes: [],
      status: 'pending',
      lastSyncAt: null,
      syncCursor: null,
      syncCheckpoint: null,
      canRead: false,
      canSend: false,
      rawIntegration: null,
      rawSettings: null,
    })

    const req: any = {
      user: {
        email: 'mateus.mantovani@onsmart.com.br',
      },
      body: {
        provider_family: 'microsoft365',
        email_address: 'mateus.mantovani@onsmart.com.br',
      },
    }
    const res = createResponseMock()

    await upsertCurrentEmailIntegration(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        integration: expect.objectContaining({
          id: 'integration-123',
          status: 'pending',
          has_access_token: false,
        })
      })
    )
  })
})
