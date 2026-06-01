import { describe, expect, it, vi, beforeEach } from 'vitest'
import { TenantOwnershipError } from '../utils/tenant-ownership'

const mockFrom = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

vi.mock('../utils/company-helper', () => ({
  getUserIdAndCompanyIdByEmail: vi.fn().mockResolvedValue({
    userId: 'user-1',
    companyId: 'company-a',
  }),
}))

vi.mock('../services/integrations/crm/crm-integration.repository', () => ({
  assertCRMIntegrationOwnedByUser: vi.fn().mockResolvedValue({ id: 'crm-1' }),
}))

function chain(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'maybeSingle', 'single', 'order', 'limit']
  for (const method of methods) {
    builder[method] = vi.fn().mockReturnValue(builder)
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(result)
  builder.single = vi.fn().mockResolvedValue(result)
  return builder
}

describe('tenant-ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('assertAgentDecisionOwnedByCompany rejeita agente de outro tenant', async () => {
    const { assertAgentDecisionOwnedByCompany } = await import('../utils/tenant-ownership')

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tb_agent_decisions') {
        return chain({
          data: { id: 'dec-1', agent_id: 'agent-1', status: 'pending_approval' },
          error: null,
        })
      }
      if (table === 'tb_agents') {
        return chain({ data: null, error: null })
      }
      return chain({ data: null, error: null })
    })

    await expect(assertAgentDecisionOwnedByCompany('dec-1', 'company-a')).rejects.toMatchObject({
      statusCode: 403,
      code: 'DECISION_FORBIDDEN',
    })
  })

  it('assertWhatsAppMessageOwnedByCompany rejeita integração de outro tenant', async () => {
    const { assertWhatsAppMessageOwnedByCompany } = await import('../utils/tenant-ownership')

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tb_whatsapp_messages') {
        return chain({
          data: { id: 'msg-1', integrations_id: 'int-1' },
          error: null,
        })
      }
      if (table === 'tb_integrations') {
        return chain({ data: null, error: null })
      }
      return chain({ data: null, error: null })
    })

    await expect(assertWhatsAppMessageOwnedByCompany('msg-1', 'company-a')).rejects.toBeInstanceOf(
      TenantOwnershipError
    )
  })

  it('assertCalendlyIntegrationOwnedByUser exige integração do workspace', async () => {
    const { assertCalendlyIntegrationOwnedByUser } = await import('../utils/tenant-ownership')

    mockFrom.mockImplementation(() => chain({ data: null, error: null }))

    await expect(
      assertCalendlyIntegrationOwnedByUser('int-other', 'user@company-a.com')
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'INTEGRATION_NOT_FOUND',
    })
  })
})
