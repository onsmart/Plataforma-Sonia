import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  canCreateAgent,
  canSendMessage,
  canUseGovernance,
  canUseRAG,
  canUseSSO,
  getPlanInfo,
  planInfoCache,
} from '../utils/plan-helper'
import { getActiveAgentCount, getCurrentMessageCount } from '../services/usage-tracker.service'

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
  getCurrentMessageCount: vi.fn(),
}))

async function mockSubscription(plan: 'pro' | 'plus' | 'enterprise' | null, status: 'active' | 'inactive' | 'trialing' = 'active') {
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

  it('retorna Pro inativo quando não há subscription', async () => {
    await mockSubscription(null)

    const result = await getPlanInfo('test-company-id')

    expect(result.plan).toBe('pro')
    expect(result.status).toBe('inactive')
    expect(result.limits.agents).toBe(1)
    expect(result.limits.messages).toBe(50)
    expect(result.limits.hasRAG).toBe(false)
  })

  it('retorna Pro com limites do plano base', async () => {
    await mockSubscription('pro')

    const result = await getPlanInfo('test-company-id')

    expect(result.plan).toBe('pro')
    expect(result.status).toBe('active')
    expect(result.limits.agents).toBe(1)
    expect(result.limits.messages).toBe(50)
    expect(result.limits.hasRAG).toBe(false)
  })

  it('retorna Plus com RAG e mensagens ilimitadas', async () => {
    await mockSubscription('plus')

    const result = await getPlanInfo('test-company-id')

    expect(result.plan).toBe('plus')
    expect(result.status).toBe('active')
    expect(result.limits.agents).toBe(5)
    expect(result.limits.messages).toBe(null)
    expect(result.limits.hasRAG).toBe(true)
  })

  it('retorna Enterprise com todos os recursos liberados', async () => {
    await mockSubscription('enterprise')

    const result = await getPlanInfo('test-company-id')

    expect(result.plan).toBe('enterprise')
    expect(result.status).toBe('active')
    expect(result.limits.agents).toBe(null)
    expect(result.limits.messages).toBe(null)
    expect(result.limits.hasRAG).toBe(true)
    expect(result.limits.hasSSO).toBe(true)
    expect(result.limits.hasGovernance).toBe(true)
  })
})

describe('Plan Helper - canCreateAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planInfoCache.clear()
  })

  it('permite criar agente quando o Pro está abaixo do limite', async () => {
    await mockSubscription('pro')
    vi.mocked(getActiveAgentCount).mockResolvedValue(0)

    const result = await canCreateAgent('test-company-id')

    expect(result.allowed).toBe(true)
  })

  it('bloqueia no Pro ao atingir o limite e sugere upgrade para Plus', async () => {
    await mockSubscription('pro')
    vi.mocked(getActiveAgentCount).mockResolvedValue(1)

    const result = await canCreateAgent('test-company-id')

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('permite apenas')
    expect(result.upgradePlan).toBe('plus')
  })

  it('bloqueia quando não há assinatura ativa', async () => {
    await mockSubscription(null)

    const result = await canCreateAgent('test-company-id')

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('assinatura ativa')
  })
})

describe('Plan Helper - canSendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planInfoCache.clear()
    vi.mocked(getCurrentMessageCount).mockResolvedValue(0)
  })

  it('permite envio no Pro abaixo do limite', async () => {
    await mockSubscription('pro')

    const result = await canSendMessage('test-company-id', 30)

    expect(result.allowed).toBe(true)
  })

  it('bloqueia no Pro ao atingir 50 mensagens e sugere Plus', async () => {
    await mockSubscription('pro')

    const result = await canSendMessage('test-company-id', 50)

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('limite')
    expect(result.upgradePlan).toBe('plus')
  })

  it('permite mensagens ilimitadas no Plus', async () => {
    await mockSubscription('plus')

    const result = await canSendMessage('test-company-id', 999999)

    expect(result.allowed).toBe(true)
  })
})

describe('Plan Helper - canUseRAG', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planInfoCache.clear()
  })

  it('bloqueia RAG no Pro e sugere Plus', async () => {
    await mockSubscription('pro')

    const result = await canUseRAG('test-company-id')

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('RAG')
    expect(result.upgradePlan).toBe('plus')
  })

  it('permite RAG no Plus', async () => {
    await mockSubscription('plus')

    const result = await canUseRAG('test-company-id')

    expect(result.allowed).toBe(true)
  })
})

describe('Plan Helper - canUseGovernance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planInfoCache.clear()
  })

  it('permite Governance no Enterprise', async () => {
    await mockSubscription('enterprise')

    const result = await canUseGovernance('test-company-id')

    expect(result.allowed).toBe(true)
  })

  it('bloqueia Governance em planos inferiores', async () => {
    await mockSubscription('plus')

    const result = await canUseGovernance('test-company-id')

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Enterprise')
  })
})

describe('Plan Helper - canUseSSO', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planInfoCache.clear()
  })

  it('permite SSO no Enterprise', async () => {
    await mockSubscription('enterprise')

    const result = await canUseSSO('test-company-id')

    expect(result.allowed).toBe(true)
  })

  it('bloqueia SSO em planos inferiores', async () => {
    await mockSubscription('plus')

    const result = await canUseSSO('test-company-id')

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Enterprise')
  })
})
