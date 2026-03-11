import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getPlanInfo, canCreateAgent, canSendMessage, canUseRAG, canUseGovernance, canUseSSO } from '../utils/plan-helper'
import { getActiveAgentCount, getCurrentMessageCount } from '../services/usage-tracker.service'

// Mock dependencies
vi.mock('../lib/logger', () => ({
    default: {
        info: vi.fn(),
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
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
        single: vi.fn()
    }
}))

vi.mock('../services/usage-tracker.service', () => ({
    getActiveAgentCount: vi.fn(),
    getCurrentMessageCount: vi.fn()
}))

describe('Plan Helper - getPlanInfo', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('deve retornar starter com status inactive quando não há subscription', async () => {
        const { supabase } = await import('../lib/supabase')
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
        } as any)

        const result = await getPlanInfo('test-company-id')

        expect(result.plan).toBe('starter')
        expect(result.status).toBe('inactive')
        expect(result.limits.agents).toBe(1)
        expect(result.limits.messages).toBe(50)
        expect(result.limits.hasRAG).toBe(false)
    })

    it('deve retornar pro com status active quando há subscription ativa', async () => {
        const { supabase } = await import('../lib/supabase')
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { plan: 'pro', status: 'active' },
                error: null
            })
        } as any)

        const result = await getPlanInfo('test-company-id')

        expect(result.plan).toBe('pro')
        expect(result.status).toBe('active')
        expect(result.limits.agents).toBe(5)
        expect(result.limits.messages).toBe(null) // unlimited
        expect(result.limits.hasRAG).toBe(true)
    })

    it('deve retornar enterprise com status active quando há subscription enterprise', async () => {
        const { supabase } = await import('../lib/supabase')
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { plan: 'enterprise', status: 'active' },
                error: null
            })
        } as any)

        const result = await getPlanInfo('test-company-id')

        expect(result.plan).toBe('enterprise')
        expect(result.status).toBe('active')
        expect(result.limits.agents).toBe(null) // unlimited
        expect(result.limits.messages).toBe(null) // unlimited
        expect(result.limits.hasRAG).toBe(true)
        expect(result.limits.hasSSO).toBe(true)
        expect(result.limits.hasGovernance).toBe(true)
    })
})

describe('Plan Helper - canCreateAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('deve permitir criar agente quando está abaixo do limite', async () => {
        const { supabase } = await import('../lib/supabase')
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { plan: 'starter', status: 'active' },
                error: null
            })
        } as any)

        vi.mocked(getActiveAgentCount).mockResolvedValue(0)

        const result = await canCreateAgent('test-company-id')

        expect(result.allowed).toBe(true)
    })

    it('deve bloquear criação quando atingiu o limite', async () => {
        const { supabase } = await import('../lib/supabase')
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { plan: 'starter', status: 'active' },
                error: null
            })
        } as any)

        vi.mocked(getActiveAgentCount).mockResolvedValue(1) // Limite do starter é 1, já tem 1 ativo

        const result = await canCreateAgent('test-company-id')

        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('limite')
        expect(result.upgradePlan).toBe('pro')
    })

    it('deve bloquear quando subscription não está ativa', async () => {
        const { supabase } = await import('../lib/supabase')
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: null, // Sem subscription
                error: null
            })
        } as any)

        const result = await canCreateAgent('test-company-id')

        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('assinatura ativa')
    })
})

describe('Plan Helper - canSendMessage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('deve permitir enviar mensagem quando está abaixo do limite', async () => {
        const { supabase } = await import('../lib/supabase')
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { plan: 'starter', status: 'active' },
                error: null
            })
        } as any)

        vi.mocked(getCurrentMessageCount).mockResolvedValue(30) // Abaixo do limite de 50

        const result = await canSendMessage('test-company-id', 30)

        expect(result.allowed).toBe(true)
    })

    it('deve bloquear quando atingiu o limite de mensagens', async () => {
        const { supabase } = await import('../lib/supabase')
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { plan: 'starter', status: 'active' },
                error: null
            })
        } as any)

        const result = await canSendMessage('test-company-id', 50) // Limite do starter é 50

        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('limite')
    })

    it('deve permitir mensagens ilimitadas no plano pro', async () => {
        const { supabase } = await import('../lib/supabase')
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { plan: 'pro', status: 'active' },
                error: null
            })
        } as any)

        const result = await canSendMessage('test-company-id', 999999)

        expect(result.allowed).toBe(true) // Pro tem mensagens ilimitadas
    })
})

describe('Plan Helper - canUseRAG', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('deve permitir RAG no plano pro', async () => {
        const { supabase } = await import('../lib/supabase')
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { plan: 'pro', status: 'active' },
                error: null
            })
        } as any)

        const result = await canUseRAG('test-company-id')

        expect(result.allowed).toBe(true)
    })

    it('deve bloquear RAG no plano starter', async () => {
        const { supabase } = await import('../lib/supabase')
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { plan: 'starter', status: 'active' },
                error: null
            })
        } as any)

        const result = await canUseRAG('test-company-id')

        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('RAG')
        expect(result.upgradePlan).toBe('pro')
    })
})

describe('Plan Helper - canUseGovernance', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('deve permitir Governance no plano enterprise', async () => {
        const { supabase } = await import('../lib/supabase')
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { plan: 'enterprise', status: 'active' },
                error: null
            })
        } as any)

        const result = await canUseGovernance('test-company-id')

        expect(result.allowed).toBe(true)
    })

    it('deve bloquear Governance em planos inferiores', async () => {
        const { supabase } = await import('../lib/supabase')
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { plan: 'pro', status: 'active' },
                error: null
            })
        } as any)

        const result = await canUseGovernance('test-company-id')

        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('Enterprise')
    })
})

describe('Plan Helper - canUseSSO', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('deve permitir SSO no plano enterprise', async () => {
        const { supabase } = await import('../lib/supabase')
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { plan: 'enterprise', status: 'active' },
                error: null
            })
        } as any)

        const result = await canUseSSO('test-company-id')

        expect(result.allowed).toBe(true)
    })

    it('deve bloquear SSO em planos inferiores', async () => {
        const { supabase } = await import('../lib/supabase')
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { plan: 'pro', status: 'active' },
                error: null
            })
        } as any)

        const result = await canUseSSO('test-company-id')

        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('Enterprise')
    })
})
