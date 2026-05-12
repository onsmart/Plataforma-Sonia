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
  }
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock
  }
}))

import {
  createHubSpotContact,
  getHubSpotContacts,
  searchHubSpotContacts,
} from '../services/integrations/crm/hubspot.service'

function mockIntegrationRow(overrides?: Record<string, unknown>) {
  return {
    id: 'crm-int-1',
    api_key: 'hubspot-token',
    access_token: null,
    config: null,
    tb_crms: {
      id: 'crm-1',
      slug: 'hubspot',
      name: 'HubSpot',
      type: 'api_key'
    },
    ...overrides
  }
}

function createQueryBuilder(result: { data: any; error: any }) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue(result),
  }

  return builder
}

describe('hubspot.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = fetchMock as any
  })

  it('busca contatos usando propriedades padrão quando nenhuma lista é informada', async () => {
    fromMock.mockImplementation(() =>
      createQueryBuilder({
        data: mockIntegrationRow(),
        error: null
      })
    )
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 'contact-1',
            properties: {
              firstname: 'Mateus',
              lastname: 'Mantovani',
              email: 'mateus@example.com',
              phone: '5511999999999',
              company: 'OnSmart',
              lifecyclestage: 'lead'
            },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z'
          }
        ]
      })
    })

    const result = await getHubSpotContacts('crm-int-1', 5)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/crm/v3/objects/contacts?limit=5&properties=firstname,lastname,email,phone,company,lifecyclestage'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer hubspot-token'
        })
      })
    )
    expect(result).toEqual([
      expect.objectContaining({
        id: 'contact-1',
        firstname: 'Mateus',
        email: 'mateus@example.com'
      })
    ])
  })

  it('aplica filtro local starts_with na busca estruturada', async () => {
    fromMock.mockImplementation(() =>
      createQueryBuilder({
        data: mockIntegrationRow(),
        error: null
      })
    )
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 'contact-1',
            properties: { firstname: 'Mateus', email: 'mateus@example.com' },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z'
          },
          {
            id: 'contact-2',
            properties: { firstname: 'Joao', email: 'joao@example.com' },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z'
          }
        ]
      })
    })

    const result = await searchHubSpotContacts(
      'crm-int-1',
      10,
      undefined,
      undefined,
      [
        { field: 'firstname', operator: 'starts_with', value: 'Mat' }
      ]
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.hubapi.com/crm/v3/objects/contacts/search',
      expect.objectContaining({
        method: 'POST'
      })
    )
    expect(result).toHaveLength(1)
    expect(result[0].firstname).toBe('Mateus')
  })

  it('cria contato no HubSpot com propriedades extras serializadas', async () => {
    fromMock.mockImplementation(() =>
      createQueryBuilder({
        data: mockIntegrationRow(),
        error: null
      })
    )
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'contact-99',
        properties: {
          firstname: 'Ana',
          custom_field: 'vip'
        },
        createdAt: '2026-01-01T00:00:00.000Z'
      })
    })

    const result = await createHubSpotContact('crm-int-1', {
      firstname: 'Ana',
      custom_field: 'vip',
      score: 10
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.hubapi.com/crm/v3/objects/contacts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          properties: {
            firstname: 'Ana',
            custom_field: 'vip',
            score: '10'
          }
        })
      })
    )
    expect(result).toEqual(
      expect.objectContaining({
        id: 'contact-99',
        firstname: 'Ana',
        custom_field: 'vip'
      })
    )
  })
})
