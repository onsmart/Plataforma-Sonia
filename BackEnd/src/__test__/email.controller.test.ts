import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createSignedOutlookStateMock,
  createOutlookAuthorizeUrlMock,
  getDefaultEmailIntegrationForUserMock,
  listEmailIntegrationConfigsForUserMock,
  listEmailIntegrationsForUserMock,
  testEmailIntegrationForUserMock,
  upsertDefaultEmailIntegrationForUserMock,
} = vi.hoisted(() => ({
  createSignedOutlookStateMock: vi.fn(),
  createOutlookAuthorizeUrlMock: vi.fn(),
  getDefaultEmailIntegrationForUserMock: vi.fn(),
  listEmailIntegrationConfigsForUserMock: vi.fn(),
  listEmailIntegrationsForUserMock: vi.fn(),
  testEmailIntegrationForUserMock: vi.fn(),
  upsertDefaultEmailIntegrationForUserMock: vi.fn(),
}))

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }
}))

vi.mock('../services/integrations/email_reader/outlook/outlook.oauth', () => ({
  createSignedOutlookState: createSignedOutlookStateMock,
  createOutlookAuthorizeUrl: createOutlookAuthorizeUrlMock,
}))

vi.mock('../services/integrations/mail', () => ({
  activateEmailIntegration: vi.fn(),
  buildEmailIntegrationResponse: vi.fn(),
  createEmailIntegrationForUser: vi.fn(),
  deleteEmailIntegrationForUser: vi.fn(),
  getDefaultEmailIntegrationForUser: getDefaultEmailIntegrationForUserMock,
  listEmailIntegrationConfigsForUser: listEmailIntegrationConfigsForUserMock,
  listEmailIntegrationsForUser: listEmailIntegrationsForUserMock,
  setDefaultEmailIntegrationForUser: vi.fn(),
  setEmailIntegrationActiveForUser: vi.fn(),
  testEmailIntegrationForUser: testEmailIntegrationForUserMock,
  updateEmailIntegrationForUser: vi.fn(),
  upsertDefaultEmailIntegrationForUser: upsertDefaultEmailIntegrationForUserMock,
}))

import {
  getMicrosoft365AuthorizeUrl,
  listEmailIntegrations,
  testCurrentEmailIntegration,
  upsertCurrentEmailIntegration,
} from '../api/controllers/email.controller'

function createResponseMock() {
  const response: any = {
    status: vi.fn(() => response),
    json: vi.fn(() => response),
  }

  return response
}

describe('email.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('gera URL segura do Microsoft 365 para usuario autenticado', async () => {
    createSignedOutlookStateMock.mockReturnValue('signed-state')
    listEmailIntegrationConfigsForUserMock.mockResolvedValue({
      configs: [],
    })
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
      query: {},
    }
    const res = createResponseMock()

    await getMicrosoft365AuthorizeUrl(req, res)

    expect(createSignedOutlookStateMock).toHaveBeenCalledWith({
      userId: 'user-123',
      userEmail: 'mateus.mantovani@onsmart.com.br',
      integrationId: undefined,
    })
    expect(createOutlookAuthorizeUrlMock).toHaveBeenCalledWith({
      state: 'signed-state',
      requestOrigin: 'http://localhost:3333',
      clientId: undefined,
      redirectUri: undefined,
      tenantId: undefined,
    })
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        authorizeUrl: 'https://login.microsoftonline.com/mock',
      })
    )
  })

  it('lista integracoes pelo manager sem acessar Supabase diretamente', async () => {
    listEmailIntegrationsForUserMock.mockResolvedValue({
      integrations: [{ id: 'email-1', provider_preset: 'gmail' }],
      defaultIntegration: { id: 'email-1', is_default: true },
    })

    const req: any = {
      user: { email: 'mateus.mantovani@onsmart.com.br' },
    }
    const res = createResponseMock()

    await listEmailIntegrations(req, res)

    expect(listEmailIntegrationsForUserMock).toHaveBeenCalledWith('mateus.mantovani@onsmart.com.br')
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      integrations: [{ id: 'email-1', provider_preset: 'gmail' }],
      defaultIntegration: { id: 'email-1', is_default: true },
    })
  })

  it('mantem POST current como compatibilidade para a integracao default', async () => {
    upsertDefaultEmailIntegrationForUserMock.mockResolvedValue({
      id: 'integration-123',
      status: 'pending',
      has_access_token: false,
    })

    const req: any = {
      user: {
        email: 'mateus.mantovani@onsmart.com.br',
      },
      body: {
        provider_family: 'microsoft365',
        provider_preset: 'microsoft365',
        email_address: 'mateus.mantovani@onsmart.com.br',
      },
    }
    const res = createResponseMock()

    await upsertCurrentEmailIntegration(req, res)

    expect(upsertDefaultEmailIntegrationForUserMock).toHaveBeenCalledWith(
      'mateus.mantovani@onsmart.com.br',
      req.body
    )
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

  it('retorna 401 ao listar integracoes sem usuario autenticado', async () => {
    const req: any = { user: {} }
    const res = createResponseMock()

    await listEmailIntegrations(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuario nao autenticado.' })
  })

  it('retorna 404 ao testar integracao atual quando nao existe default', async () => {
    getDefaultEmailIntegrationForUserMock.mockResolvedValue(null)

    const req: any = {
      user: { email: 'mateus.mantovani@onsmart.com.br' },
    }
    const res = createResponseMock()

    await testCurrentEmailIntegration(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Nenhuma integracao de email encontrada para testar.'
    })
  })

  it('testa a integracao default atual quando ela existe', async () => {
    getDefaultEmailIntegrationForUserMock.mockResolvedValue({ id: 'email-77' })
    testEmailIntegrationForUserMock.mockResolvedValue({ success: true, provider: 'smtp' })

    const req: any = {
      user: { email: 'mateus.mantovani@onsmart.com.br' },
    }
    const res = createResponseMock()

    await testCurrentEmailIntegration(req, res)

    expect(testEmailIntegrationForUserMock).toHaveBeenCalledWith(
      'mateus.mantovani@onsmart.com.br',
      'email-77'
    )
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      result: { success: true, provider: 'smtp' }
    })
  })
})
