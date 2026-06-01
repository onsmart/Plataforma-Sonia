import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  canAcceptConversation,
  canStartNewAtendimento,
  canSendMessage,
  canCreateAgent,
  canUseActiveOutbound,
  canUseGovernance,
  canUseRAG,
  canUseFlows,
  canUseCrmApi,
  canUseSSO,
  getPlanInfo,
  planInfoCache,
} from '../utils/plan-helper'

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
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  },
}))

vi.mock('../services/usage-tracker.service', () => ({
  getActiveAgentCount: vi.fn(),
  getCurrentMonthConversationCount: vi.fn(),
  hasContactConversationThisMonth: vi.fn(),
  hasOpenServiceSession: vi.fn(),
}))

vi.mock('../services/service-session.service', () => ({
  getMonthlyAtendimentoCount: vi.fn(),
}))

import {
  getActiveAgentCount,
  getCurrentMonthConversationCount,
  hasOpenServiceSession,
} from '../services/usage-tracker.service'
import { getMonthlyAtendimentoCount } from '../services/service-session.service'

async function mockSubscription(
  plan: string | null,
  status: 'active' | 'inactive' | 'trialing' = 'active'
) {
  const { supabase } = await import('../lib/supabase')
  vi.mocked(supabase.from).mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: plan ? { plan, status } : null,
      error: null,
    }),
  } as any)
}

describe('Plan Helper - getPlanInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planInfoCache.clear()
  })

  it('retorna rec_start com limites corretos', async () => {
    await mockSubscription('rec_start')
    const result = await getPlanInfo('test-company-id')
    expect(result.plan).toBe('rec_start')
    expect(result.limits.conversations).toBe(200)
    expect(result.limits.hasActiveOutbound).toBe(false)
  })

  it('retorna com_growth com outbound ativo', async () => {
    await mockSubscription('com_growth')
    const result = await getPlanInfo('test-company-id')
    expect(result.plan).toBe('com_growth')
    expect(result.limits.conversations).toBe(1500)
    expect(result.limits.hasActiveOutbound).toBe(true)
  })

  it('retorna rec_growth com RAG', async () => {
    await mockSubscription('rec_growth')
    const result = await getPlanInfo('test-company-id')
    expect(result.plan).toBe('rec_growth')
    expect(result.limits.hasRAG).toBe(true)
    expect(result.limits.agents).toBe(3)
  })

  it('mantém benefícios cancelados até o fim do ciclo pago', async () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    const { supabase } = await import('../lib/supabase')
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          plan: 'rec_growth',
          status: 'canceled',
          current_period_end: future,
          canceled_at: new Date().toISOString(),
        },
        error: null,
      }),
    } as any)

    const result = await getPlanInfo('test-company-id')
    expect(result.plan).toBe('rec_growth')
    expect(result.limits.hasRAG).toBe(true)
    expect(result.status).toBe('active')
  })
})

describe('Plan Helper - canCreateAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planInfoCache.clear()
  })

  it('bloqueia rec_start com 1 agente ativo', async () => {
    await mockSubscription('rec_start')
    vi.mocked(getActiveAgentCount).mockResolvedValue(1)
    const result = await canCreateAgent('test-company-id')
    expect(result.allowed).toBe(false)
    expect(result.upgradePlan).toBe('rec_growth')
  })
})

describe('Plan Helper - canStartNewAtendimento', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planInfoCache.clear()
    vi.mocked(getMonthlyAtendimentoCount).mockResolvedValue(0)
  })

  it('permite abrir sessão abaixo do limite', async () => {
    await mockSubscription('rec_start')
    vi.mocked(getMonthlyAtendimentoCount).mockResolvedValue(100)
    const result = await canStartNewAtendimento('test-company-id')
    expect(result.allowed).toBe(true)
  })

  it('bloqueia ao atingir 200 sessões', async () => {
    await mockSubscription('rec_start')
    vi.mocked(getMonthlyAtendimentoCount).mockResolvedValue(200)
    const result = await canStartNewAtendimento('test-company-id')
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/Atualize seu plano/)
    expect(result.upgradePlan).toBe('rec_growth')
  })

  it('enterprise ilimitado', async () => {
    await mockSubscription('rec_enterprise')
    const result = await canStartNewAtendimento('test-company-id')
    expect(result.allowed).toBe(true)
  })

})

describe('Plan Helper - canAcceptConversation (sessões)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planInfoCache.clear()
    vi.mocked(hasOpenServiceSession).mockResolvedValue(false)
    vi.mocked(getMonthlyAtendimentoCount).mockResolvedValue(0)
  })

  it('permite continuar sessão aberta mesmo no limite', async () => {
    await mockSubscription('rec_start')
    vi.mocked(hasOpenServiceSession).mockResolvedValue(true)
    vi.mocked(getMonthlyAtendimentoCount).mockResolvedValue(200)
    const result = await canAcceptConversation('test-company-id', 'contact-1', 'int-1')
    expect(result.allowed).toBe(true)
    expect(result.continuing).toBe(true)
  })

  it('bloqueia novo atendimento quando limite atingido', async () => {
    await mockSubscription('rec_start')
    vi.mocked(getMonthlyAtendimentoCount).mockResolvedValue(200)
    const result = await canAcceptConversation('test-company-id', 'contact-new', 'int-1')
    expect(result.allowed).toBe(false)
    expect(result.continuing).toBe(false)
  })
})

describe('Plan Helper - canSendMessage (alias conversas)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planInfoCache.clear()
    vi.mocked(getCurrentMonthConversationCount).mockResolvedValue(200)
  })

  it('bloqueia rec_start no limite', async () => {
    await mockSubscription('rec_start')
    const result = await canSendMessage('test-company-id', 200)
    expect(result.allowed).toBe(false)
  })
})

describe('Plan Helper - canUseActiveOutbound', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planInfoCache.clear()
  })

  it('bloqueia linha receptiva', async () => {
    await mockSubscription('rec_growth')
    const result = await canUseActiveOutbound('test-company-id')
    expect(result.allowed).toBe(false)
    expect(result.upgradePlan).toBe('com_start')
  })

  it('permite linha completa', async () => {
    await mockSubscription('com_start')
    const result = await canUseActiveOutbound('test-company-id')
    expect(result.allowed).toBe(true)
  })
})

describe('Plan Helper - canUseRAG', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planInfoCache.clear()
  })

  it('bloqueia rec_start', async () => {
    await mockSubscription('rec_start')
    const result = await canUseRAG('test-company-id')
    expect(result.allowed).toBe(false)
  })

  it('permite com_growth', async () => {
    await mockSubscription('com_growth')
    const result = await canUseRAG('test-company-id')
    expect(result.allowed).toBe(true)
  })
})

describe('Plan Helper - canUseFlows e canUseCrmApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planInfoCache.clear()
  })

  it('bloqueia fluxos no rec_start', async () => {
    await mockSubscription('rec_start')
    expect((await canUseFlows('test-company-id')).allowed).toBe(false)
    expect((await canUseFlows('test-company-id')).upgradePlan).toBe('rec_growth')
  })

  it('permite fluxos e CRM no rec_growth', async () => {
    await mockSubscription('rec_growth')
    expect((await canUseFlows('test-company-id')).allowed).toBe(true)
    expect((await canUseCrmApi('test-company-id')).allowed).toBe(true)
  })

  it('bloqueia CRM no rec_start', async () => {
    await mockSubscription('rec_start')
    expect((await canUseCrmApi('test-company-id')).allowed).toBe(false)
  })
})

describe('Plan Helper - governance e SSO', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planInfoCache.clear()
  })

  it('permite governance em com_enterprise', async () => {
    await mockSubscription('com_enterprise')
    expect((await canUseGovernance('x')).allowed).toBe(true)
    expect((await canUseSSO('x')).allowed).toBe(true)
  })

  it('bloqueia governance em com_start', async () => {
    await mockSubscription('com_start')
    expect((await canUseGovernance('x')).allowed).toBe(false)
  })
})
