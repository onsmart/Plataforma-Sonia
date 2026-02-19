import { describe, it, expect, vi } from 'vitest'
import { FlowExecutor } from '../services/flows/flow-executor'
import { FlowData, FlowExecutionContext } from '../services/flows/flow.types'

// Mocking dependencies to avoid real side effects and environment check errors
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
        maybeSingle: vi.fn().mockResolvedValue({ data: { nome: 'Mock Agent' } }),
        single: vi.fn().mockResolvedValue({ data: { nodes: [] } })
    }
}))

vi.mock('../services/flows/fallback-events', () => ({
    saveFallbackEvent: vi.fn().mockResolvedValue(true)
}))

vi.mock('../services/system-logs', () => ({
    saveSystemLog: vi.fn().mockResolvedValue(true)
}))

vi.mock('../agents/chatwithAgent', () => ({
    chatWithAgent: vi.fn().mockResolvedValue('Mocked response')
}))

describe('FlowExecutor Smoke Test', () => {
    it('deve executar um flow mínimo (start -> stop) com sucesso', async () => {
        const flowData: FlowData = {
            nodes: [
                {
                    id: 'node-1',
                    type: 'start',
                    data: { label: 'Início' },
                    position: { x: 0, y: 0 }
                },
                {
                    id: 'node-2',
                    type: 'stop',
                    data: { label: 'Fim' },
                    position: { x: 200, y: 0 }
                }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: {},
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        // Verificações básicas
        expect(result).toBeDefined()
        expect(result.executionHistory).toHaveLength(2)
        expect(result.executionHistory[0].nodeId).toBe('node-1')
        expect(result.executionHistory[1].nodeId).toBe('node-2')
        expect(result.executionHistory[1].output).toEqual({ stopped: true })
    })

    it('deve falhar se o node inicial não for encontrado', async () => {
        const flowData: FlowData = {
            nodes: [
                {
                    id: 'node-1',
                    type: 'start',
                    data: { label: 'Início' },
                    position: { x: 0, y: 0 }
                }
            ],
            edges: [],
            startNodeId: 'node-invalido'
        }

        const context: FlowExecutionContext = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: {},
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)

        await expect(executor.execute()).rejects.toThrow('Node inicial não encontrado')
    })
})
