import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock, fetchMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  fetchMock: vi.fn(),
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

import { parseHubSpotApiError, testHubSpotConnection } from '../services/integrations/crm/hubspot.service'

describe('hubspot connection test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = fetchMock as any
  })

  it('parseHubSpotApiError deve identificar 401 de autenticacao', () => {
    const parsed = parseHubSpotApiError(
      'HubSpot API error: 401 - {"status":"error","message":"Authentication credentials not found.","category":"INVALID_AUTHENTICATION"}'
    )
    expect(parsed.httpStatus).toBe(401)
    expect(parsed.errorCode).toBe('INVALID_AUTHENTICATION')
    expect(parsed.message).toContain('Token do HubSpot')
  })

  it('testHubSpotConnection deve validar token sem retornar contatos', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ portalId: 123456, accountType: 'STANDARD' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ name: 'contact' }] }),
      })

    const result = await testHubSpotConnection({ token: 'pat-test-token-123456' })

    expect(result.success).toBe(true)
    expect(result.portalId).toBe(123456)
    expect(result.crmSchemaAccessVerified).toBe(true)
    expect(result.lgpdNotice).toContain('sem exibicao de dados pessoais')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.hubapi.com/account-info/v3/details',
      expect.objectContaining({ method: 'GET' })
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.hubapi.com/crm/v3/schemas/contacts',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('testHubSpotConnection deve retornar auth_failed para token invalido', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      text: async () =>
        '{"status":"error","message":"Authentication credentials not found.","category":"INVALID_AUTHENTICATION"}',
      status: 401,
    })

    const result = await testHubSpotConnection({ token: 'invalid-token' })

    expect(result.success).toBe(false)
    expect(result.status).toBe('auth_failed')
    expect(result.crmSchemaAccessVerified).toBe(false)
  })
})
