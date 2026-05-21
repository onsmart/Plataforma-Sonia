import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock, checkConnectionStatusMock, getHistoryFromRedisMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  checkConnectionStatusMock: vi.fn(),
  getHistoryFromRedisMock: vi.fn(),
}))

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}))

vi.mock('../services/integrations/whatsapp', () => ({
  checkConnectionStatus: checkConnectionStatusMock,
}))

vi.mock('../services/integrations/whatsapp/whatsapp.redis', () => ({
  getHistoryFromRedis: getHistoryFromRedisMock,
  getUnreadConversations: vi.fn().mockResolvedValue([]),
}))

import {
  getWhatsAppHistoryEndpoint,
  getWhatsAppStatus,
  listWhatsAppIntegrations,
} from '../api/controllers/whatsapp.controller'

function createRes() {
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
    }),
  }
  return response
}

function mockPlatformUser() {
  const usersChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'user-a' }, error: null }),
  }
  const companyChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { companies_id: 'company-a' }, error: null }),
  }
  return { usersChain, companyChain }
}

function mockIntegrationLookup(
  row: Record<string, unknown> | null,
  options?: { accessDenied?: boolean }
) {
  const integrationChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: row,
      error: row ? null : { message: 'not found' },
    }),
  }

  fromMock.mockImplementation((table: string) => {
    if (table === 'tb_users') return mockPlatformUser().usersChain
    if (table === 'tb_company_users') return mockPlatformUser().companyChain
    if (table === 'tb_integrations') return integrationChain
    return integrationChain
  })

  if (options?.accessDenied && row) {
    return {
      ...row,
      user_id: 'other-user',
      companies_id: 'other-company',
    }
  }
  return row
}

describe('whatsapp routes auth / ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkConnectionStatusMock.mockResolvedValue('connected')
    getHistoryFromRedisMock.mockResolvedValue([])
  })

  it('getWhatsAppHistoryEndpoint retorna 401 sem usuario autenticado', async () => {
    const res = createRes()
    await getWhatsAppHistoryEndpoint(
      { query: { integration_id: 'int-1', phone_number: '5511999999999' } } as any,
      res
    )
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('getWhatsAppHistoryEndpoint retorna 403 para integracao de outra empresa', async () => {
    mockIntegrationLookup(
      {
        id: 'int-b',
        user_id: 'user-b',
        companies_id: 'company-b',
        provider: 'whatsapp',
      },
      { accessDenied: true }
    )

    const res = createRes()
    await getWhatsAppHistoryEndpoint(
      {
        user: { email: 'owner@company-a.com' },
        query: { integration_id: 'int-b', phone_number: '5511999999999' },
      } as any,
      res
    )

    expect(res.status).toHaveBeenCalledWith(403)
    expect(getHistoryFromRedisMock).not.toHaveBeenCalled()
  })

  it('getWhatsAppHistoryEndpoint retorna historico quando integracao pertence ao usuario', async () => {
    mockIntegrationLookup({
      id: 'int-a',
      user_id: 'user-a',
      companies_id: 'company-a',
      provider: 'whatsapp',
    })

    const res = createRes()
    await getWhatsAppHistoryEndpoint(
      {
        user: { email: 'owner@company-a.com' },
        query: { integration_id: 'int-a', phone_number: '5511999999999' },
      } as any,
      res
    )

    expect(res.statusCode).toBe(200)
    expect(getHistoryFromRedisMock).toHaveBeenCalledWith('int-a', '5511999999999', 20)
  })

  it('getWhatsAppStatus valida ownership antes de checar conexao', async () => {
    mockIntegrationLookup({
      id: 'int-a',
      user_id: 'user-a',
      companies_id: 'company-a',
      provider: 'whatsapp',
    })

    const res = createRes()
    await getWhatsAppStatus(
      {
        user: { email: 'owner@company-a.com' },
        query: { integration_id: 'int-a' },
      } as any,
      res
    )

    expect(res.statusCode).toBe(200)
    expect(checkConnectionStatusMock).toHaveBeenCalledWith('int-a')
  })

  it('listWhatsAppIntegrations usa JWT e nao query email', async () => {
    const { usersChain, companyChain } = mockPlatformUser()
    const integrationsResult = [{ id: 'int-a', phone_number: '5511', provider: 'whatsapp' }]
    const integrationsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: undefined as unknown,
    }
    integrationsChain.eq = vi.fn().mockImplementation(() => ({
      eq: vi.fn().mockResolvedValue({ data: integrationsResult, error: null }),
    }))

    fromMock.mockImplementation((table: string) => {
      if (table === 'tb_users') return usersChain
      if (table === 'tb_company_users') return companyChain
      if (table === 'tb_integrations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: integrationsResult, error: null }),
            }),
          }),
        }
      }
      return integrationsChain
    })

    const res = createRes()
    await listWhatsAppIntegrations({ user: { email: 'owner@company-a.com' }, query: {} } as any, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.integrations).toHaveLength(1)
  })
})
