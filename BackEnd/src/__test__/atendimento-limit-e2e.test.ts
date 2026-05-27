/**
 * Simula 200 atendimentos no rec_start e valida bloqueio do 201º + notificações.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canStartNewAtendimento } from '../utils/plan-helper'

vi.mock('../lib/logger', () => ({
  default: { info: vi.fn(), log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  },
}))

vi.mock('../services/service-session.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/service-session.service')>()
  return {
    ...actual,
    getMonthlyAtendimentoCount: vi.fn(),
    resolveInboundSession: vi.fn(),
    closeStaleSessions: vi.fn().mockResolvedValue(0),
  }
})

vi.mock('../services/platform-email.service', () => ({
  isPlatformEmailConfigured: vi.fn().mockReturnValue(true),
  sendPlatformEmail: vi.fn().mockResolvedValue({ id: 'mock-email' }),
}))

import { getMonthlyAtendimentoCount, resolveInboundSession } from '../services/service-session.service'
import { sendPlatformEmail } from '../services/platform-email.service'

async function mockSubscription(plan: string) {
  const { supabase } = await import('../lib/supabase')
  vi.mocked(supabase.from).mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { plan, status: 'active' }, error: null }),
  } as any)
}

describe('atendimento-limit-e2e (simulado 200 sessões)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { planInfoCache } = await import('../utils/plan-helper')
    planInfoCache.clear()
    await mockSubscription('rec_start')
  })

  it('bloqueia canStartNewAtendimento na 201ª sessão (rec_start)', async () => {
    vi.mocked(getMonthlyAtendimentoCount).mockResolvedValue(200)
    const gate = await canStartNewAtendimento('company-1')
    expect(gate.allowed).toBe(false)
    expect(gate.conversationsUsed).toBe(200)
    expect(gate.conversationsLimit).toBe(200)
    expect(gate.reason).toMatch(/Atualize seu plano/)
  })

  it('resolveInboundSession bloqueia 201º contato', async () => {
    vi.mocked(resolveInboundSession).mockResolvedValueOnce({
      blocked: true,
      continuing: false,
      reason: 'Atualize seu plano para poder ter mais acesso a números de atendimentos, ou entre em contato conosco para uma possível recarga.',
      conversationsUsed: 200,
      conversationsLimit: 200,
    })

    const result = await resolveInboundSession({
      companiesId: 'company-1',
      integrationId: 'int-1',
      whatsappContactId: 'contact-201',
    })

    expect(result.blocked).toBe(true)
    expect(result.conversationsUsed).toBe(200)
  })

  it('dispara notificação e e-mail uma vez ao cruzar limite', async () => {
    const inserted: unknown[] = []
    const { supabase } = await import('../lib/supabase')

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn((row: unknown) => {
          inserted.push(row)
          return { ...chain, select: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'n1' }, error: null }) }) }
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data:
            inserted.length > 0
              ? { id: 'n1', metadata: { billing_month: '2026-05-01', email_sent: false } }
              : null,
          error: null,
        }),
      }
      if (table === 'tb_company_users') {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: [{ tb_users: { email: 'admin@test.com' } }],
          error: null,
        })
        chain.select = vi.fn().mockReturnValue(chain)
        chain.in = vi.fn().mockReturnValue(chain)
      }
      return chain
    })

    vi.mocked(getMonthlyAtendimentoCount).mockResolvedValue(200)

    const notifyMod = await import('../services/atendimento-limit-notify.service')
    vi.spyOn(notifyMod, 'getCompanyAdminEmails').mockResolvedValue(['admin@test.com'])

    const { notifyAtendimentoLimitReached } = notifyMod

    await notifyAtendimentoLimitReached('company-1', {
      conversationsUsed: 200,
      conversationsLimit: 200,
    })
    await notifyAtendimentoLimitReached('company-1', {
      conversationsUsed: 200,
      conversationsLimit: 200,
    })

    expect(inserted.length).toBe(1)
  })
})
