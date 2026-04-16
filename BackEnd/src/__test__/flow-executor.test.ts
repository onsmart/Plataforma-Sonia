import { describe, it, expect, vi } from 'vitest'
import { FlowExecutor } from '../services/flows/flow-executor'
import { FlowData, FlowExecutionContext } from '../services/flows/flow.types'
import { chatWithAgent } from '../services/agents/chatwithAgent'
import { sendFlowWhatsAppMessage } from '../services/integrations/whatsapp/whatsapp-flow-message.service'

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

vi.mock('../services/integrations/whatsapp/whatsapp-flow-message.service', () => ({
    sendFlowWhatsAppMessage: vi.fn().mockResolvedValue({
        success: true,
        sendMode: 'normal',
    })
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

        await expect(executor.execute()).rejects.toThrow(/startNodeId .* não corresponde a nenhum node/)
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

    it('deve executar node debug sem alterar context.data com saída do debug', async () => {
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
                    type: 'debug',
                    data: { label: 'Debug', debugKeys: 'foo' },
                    position: { x: 100, y: 0 }
                },
                {
                    id: 'node-3',
                    type: 'stop',
                    data: { label: 'Fim' },
                    position: { x: 200, y: 0 }
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
            data: { foo: 'bar', secret: 42 },
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(result.data.foo).toBe('bar')
        expect(result.data.secret).toBe(42)
        expect(result.data.kind).toBeUndefined()
        expect(result.data.snapshot).toBeUndefined()

        const debugStep = result.executionHistory.find((h) => h.nodeId === 'node-2')
        expect(debugStep).toBeDefined()
        expect(debugStep?.success).toBe(true)
        expect(debugStep?.output?.kind).toBe('debug')
        expect(debugStep?.output?.snapshot).toEqual({ foo: 'bar' })
        expect(debugStep?.input).toEqual({ keysRequested: ['foo'] })
        expect(debugStep?.nodeType).toBe('debug')
        expect(debugStep?.startedAt).toBeDefined()
        expect(debugStep?.finishedAt).toBeDefined()
    })
    it('deve executar o novo bloco Enviar mensagem WhatsApp e marcar entrega interna', async () => {
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
                    type: 'whatsapp_message',
                    data: {
                        label: 'Enviar mensagem WhatsApp',
                        waMessageType: 'buttons',
                        waMessageText: 'Como posso ajudar?',
                        waButtons: [{ id: 'btn_1', text: 'Falar agora' }]
                    },
                    position: { x: 100, y: 0 }
                },
                {
                    id: 'node-3',
                    type: 'stop',
                    data: { label: 'Fim' },
                    position: { x: 200, y: 0 }
                }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-3' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'flow-wa',
            userId: 'user-1',
            userEmail: 'user@example.com',
            data: {
                integrations_id: 'integration-1',
                whatsapp_contact_id: 'contact-1'
            },
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(sendFlowWhatsAppMessage).toHaveBeenCalledWith(expect.objectContaining({
            integrationsId: 'integration-1',
            to: 'contact-1',
            messageType: 'buttons',
            messageText: 'Como posso ajudar?'
        }))
        expect(result.data.__flow_whatsapp_outbound_already_sent).toBe(true)
        expect(result.executionHistory[1].output).toEqual(expect.objectContaining({
            kind: 'whatsapp_message',
            sendMode: 'normal'
        }))
    })
})
