import { describe, it, expect, vi } from 'vitest'
import { FlowExecutor } from '../services/flows/flow-executor'
import { FlowData, FlowExecutionContext } from '../services/flows/flow.types'
import { chatWithAgent } from '../services/agents/chatwithAgent'

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
        rpc: vi.fn().mockResolvedValue({ data: [] }),
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

vi.mock('../services/agents/chatwithAgent', () => ({
    chatWithAgent: vi.fn().mockResolvedValue('Mocked response')
}))

vi.mock('../services/flows/flow-template-runner', () => ({
    executeFlowTemplateNode: vi.fn().mockResolvedValue('{"intent":"agendamento"}')
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

    it('deve executar um node agent em modo template sem exigir agentId', async () => {
        const flowData: FlowData = {
            nodes: [
                {
                    id: 'node-1',
                    type: 'start',
                    data: { label: 'InÃ­cio' },
                    position: { x: 0, y: 0 }
                },
                {
                    id: 'node-2',
                    type: 'agent',
                    data: {
                        label: 'Classificador',
                        executionMode: 'template',
                        templateId: 'template-123',
                        templateName: 'Classificador',
                        additionalInstructions: 'Responda em JSON'
                    },
                    position: { x: 200, y: 0 }
                },
                {
                    id: 'node-3',
                    type: 'stop',
                    data: { label: 'Fim' },
                    position: { x: 400, y: 0 }
                }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-3' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: { message: 'Quero agendar uma consulta' },
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(result.executionHistory).toHaveLength(3)
        expect(result.executionHistory[1].executionMode).toBe('template')
        expect(result.executionHistory[1].agentId).toBeUndefined()
        expect(result.executionHistory[1].templateId).toBe('template-123')
        expect(result.data.intent).toBe('agendamento')
    })

    it('deve executar um node agent legado usando agentId', async () => {
        const flowData: FlowData = {
            nodes: [
                {
                    id: 'node-1',
                    type: 'start',
                    data: { label: 'Inicio' },
                    position: { x: 0, y: 0 }
                },
                {
                    id: 'node-2',
                    type: 'agent',
                    data: {
                        label: 'Agente legado',
                        executionMode: 'agent',
                        agentId: 'agent-123',
                        agentName: 'Agente legado'
                    },
                    position: { x: 200, y: 0 }
                },
                {
                    id: 'node-3',
                    type: 'stop',
                    data: { label: 'Fim' },
                    position: { x: 400, y: 0 }
                }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-3' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: { message: 'Teste legado' },
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(chatWithAgent).toHaveBeenCalledWith(
            'test@example.com',
            'agent-123',
            expect.any(String),
            expect.objectContaining({ message: 'Teste legado' })
        )
        expect(result.executionHistory[1].executionMode).toBe('agent')
        expect(result.executionHistory[1].agentId).toBe('agent-123')
    })
})
