import { describe, it, expect, vi, beforeEach } from 'vitest'
import { consultarArquivos } from '../services/agents/consultarArquivos'

// Mocking dependencies to avoid environment variable errors and side effects
vi.mock('../lib/logger', () => ({
    default: {
        info: vi.fn(),
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
}))

vi.mock('../lib/supabase', () => {
    const mockQueryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null, count: null, status: 200, statusText: 'OK', success: true })),
        maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null, count: null, status: 200, statusText: 'OK', success: true })),
        then: vi.fn().mockImplementation((onFulfilled: any) => {
            return Promise.resolve({ data: [], error: null, count: null, status: 200, statusText: 'OK', success: true }).then(onFulfilled)
        })
    }

    return {
        supabase: {
            from: vi.fn().mockReturnValue(mockQueryBuilder),
            rpc: vi.fn().mockResolvedValue({ data: [], error: null, count: null, status: 200, statusText: 'OK', success: true })
        }
    }
})

vi.mock('../services/rag/embeddings.service', () => ({
    generateEmbedding: vi.fn().mockResolvedValue({ embedding: [0.1, 0.2, 0.3] })
}))

vi.mock('../utils/plan-helper', () => ({
    canUseRAG: vi.fn().mockResolvedValue({ allowed: true, reason: null })
}))

describe('RAG Smoke Test', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('deve retornar estrutura válida com dados mockados', async () => {
        const { supabase } = await import('../lib/supabase')
        const queryBuilder = supabase.from('any') as any

        // Setup for agent files search
        queryBuilder.then.mockImplementationOnce((onFulfilled: any) => {
            return Promise.resolve({ data: [{ file_id: 'file-1' }], error: null, count: null, status: 200, statusText: 'OK', success: true }).then(onFulfilled)
        })

        // Setup for chunks search (RPC)
        vi.mocked(supabase.rpc).mockResolvedValue({
            data: [{ file_id: 'file-1', content: 'conteúdo de teste' }],
            error: null,
            count: null,
            status: 0,
            statusText: '',
            success: true
        })

        // Setup for file names search
        queryBuilder.then.mockImplementationOnce((onFulfilled: any) => {
            return Promise.resolve({ data: [{ id: 'file-1', original_name: 'teste.pdf' }], error: null, count: null, status: 200, statusText: 'OK', success: true }).then(onFulfilled)
        })

        const resultado = await consultarArquivos(
            'fake-agent',
            'fake-company',
            'teste'
        )

        expect(resultado).toHaveProperty('context')
        expect(resultado).toHaveProperty('sources')
        expect(resultado).toHaveProperty('sourceNames')

        expect(resultado.context).not.toBeNull()
        if (resultado.context) {
            expect(resultado.context).toContain('conteúdo de teste')
            expect(resultado.context).toContain('teste.pdf')
        }
        expect(resultado.sourceNames).toContain('teste.pdf')
        expect(resultado.sources).toContain('file-1')
    })

    it('deve retornar vazio se não houver mensagem', async () => {
        const resultado = await consultarArquivos(
            'fake-agent',
            'fake-company',
            ''
        )

        expect(resultado.context).toBeNull()
        expect(resultado.sources).toEqual([])
        expect(resultado.sourceNames).toEqual([])
    })
})
