import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCurrentAgentCount, getCurrentMessageCount, incrementMessageCount } from '../services/usage-tracker.service'

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
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(),
        single: vi.fn(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        raw: vi.fn((query: string) => query)
    }
}))

describe('Usage Tracker - getCurrentAgentCount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('deve retornar 0 quando não há agentes', async () => {
        const { supabase } = await import('../lib/supabase')
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 0, error: null })
            })
        } as any)

        const result = await getCurrentAgentCount('test-company-id')

        expect(result).toBe(0)
    })

    it('deve retornar contagem correta de agentes', async () => {
        const { supabase } = await import('../lib/supabase')
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 3, error: null })
            })
        } as any)

        const result = await getCurrentAgentCount('test-company-id')

        expect(result).toBe(3)
    })

    it('deve retornar 0 em caso de erro', async () => {
        const { supabase } = await import('../lib/supabase')
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                    count: null,
                    error: { message: 'Database error' }
                })
            })
        } as any)

        const result = await getCurrentAgentCount('test-company-id')

        expect(result).toBe(0)
    })
})

describe('Usage Tracker - getCurrentMessageCount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('deve retornar 0 quando não há mensagens', async () => {
        const { supabase } = await import('../lib/supabase')
        
        // Mock para buscar integrações
        const integrationsMock = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [{ id: 'integration-1' }],
                error: null
            })
        }

        // Mock para contar mensagens - select retorna objeto com métodos encadeados
        const messagesMock = {
            select: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        gte: vi.fn().mockReturnValue({
                            lte: vi.fn().mockResolvedValue({ count: 0, error: null })
                        })
                    })
                })
            })
        }

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            if (table === 'tb_integrations') return integrationsMock as any
            if (table === 'tb_whatsapp_messages') return messagesMock as any
            return {} as any
        })

        const result = await getCurrentMessageCount('test-company-id')

        expect(result).toBe(0)
    })

    it('deve retornar contagem correta de mensagens', async () => {
        const { supabase } = await import('../lib/supabase')
        
        const integrationsMock = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [{ id: 'integration-1' }],
                error: null
            })
        }

        const messagesMock = {
            select: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        gte: vi.fn().mockReturnValue({
                            lte: vi.fn().mockResolvedValue({ count: 25, error: null })
                        })
                    })
                })
            })
        }

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            if (table === 'tb_integrations') return integrationsMock as any
            if (table === 'tb_whatsapp_messages') return messagesMock as any
            return {} as any
        })

        const result = await getCurrentMessageCount('test-company-id')

        expect(result).toBe(25)
    })
})

describe('Usage Tracker - incrementMessageCount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('deve criar novo registro quando não existe', async () => {
        const { supabase } = await import('../lib/supabase')
        
        const insertMock = vi.fn()
        const selectAfterInsert = vi.fn()
        const maybeSingleAfterInsert = vi.fn().mockResolvedValue({
            data: { id: 'new-metric-id' },
            error: null
        })

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            if (table === 'tb_usage_metrics') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({
                                data: null,
                                error: { code: 'PGRST116' }
                            })
                        })
                    }),
                    insert: insertMock.mockReturnValue({
                        select: selectAfterInsert.mockReturnValue({
                            maybeSingle: maybeSingleAfterInsert
                        })
                    })
                } as any
            }
            return {} as any
        })

        await incrementMessageCount('test-company-id')

        expect(insertMock).toHaveBeenCalled()
    })

    it('deve atualizar registro existente', async () => {
        const { supabase } = await import('../lib/supabase')
        
        const updateMock = vi.fn()
        const eqAfterUpdate = vi.fn().mockResolvedValue({
            error: null
        })

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            if (table === 'tb_usage_metrics') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({
                                data: { id: 'existing-metric-id', message_count: 5 },
                                error: null
                            })
                        })
                    }),
                    update: updateMock.mockReturnValue({
                        eq: eqAfterUpdate
                    })
                } as any
            }
            return {} as any
        })

        await incrementMessageCount('test-company-id')

        expect(updateMock).toHaveBeenCalled()
    })
})
