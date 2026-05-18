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

import {
  normalizeHubSpotToken,
  parseHubSpotApiError,
  testHubSpotConnection,
} from '../services/integrations/crm/hubspot.service'

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

  it('normalizeHubSpotToken deve remover prefixo Bearer e aspas', () => {
    expect(normalizeHubSpotToken('  Bearer pat-abc-123  ')).toBe('pat-abc-123')
    expect(normalizeHubSpotToken('"pat-abc-123"')).toBe('pat-abc-123')
  })

  it('testHubSpotConnection deve validar CRM sem retornar contatos', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ portalId: 123456, accountType: 'STANDARD' }),
      })

    const result = await testHubSpotConnection({ token: 'pat-test-token-123456789012' })

    expect(result.success).toBe(true)
    expect(result.portalId).toBe(123456)
    expect(result.crmSchemaAccessVerified).toBe(true)
    expect(result.lgpdNotice).toContain('sem exibicao de dados pessoais')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.hubapi.com/crm/v3/objects/contacts?limit=1&properties=firstname',
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

    const result = await testHubSpotConnection({ token: 'pat-invalid-token-1234567890' })

    expect(result.success).toBe(false)
    expect(result.status).toBe('auth_failed')
    expect(result.crmSchemaAccessVerified).toBe(false)
  })
})
