"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const flow_executor_1 = require("../services/flows/flow-executor");
const chatwithAgent_1 = require("../services/agents/chatwithAgent");
// Mocking dependencies to avoid real side effects and environment check errors
vitest_1.vi.mock('../lib/logger', () => ({
    default: {
        info: vitest_1.vi.fn(),
        log: vitest_1.vi.fn(),
        error: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn()
    }
}));
vitest_1.vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vitest_1.vi.fn().mockReturnThis(),
        select: vitest_1.vi.fn().mockReturnThis(),
        eq: vitest_1.vi.fn().mockReturnThis(),
        rpc: vitest_1.vi.fn().mockResolvedValue({ data: [] }),
        maybeSingle: vitest_1.vi.fn().mockResolvedValue({ data: { nome: 'Mock Agent' } }),
        single: vitest_1.vi.fn().mockResolvedValue({ data: { nodes: [] } })
    }
}));
vitest_1.vi.mock('../services/flows/fallback-events', () => ({
    saveFallbackEvent: vitest_1.vi.fn().mockResolvedValue(true)
}));
vitest_1.vi.mock('../services/system-logs', () => ({
    saveSystemLog: vitest_1.vi.fn().mockResolvedValue(true)
}));
vitest_1.vi.mock('../services/agents/chatwithAgent', () => ({
    chatWithAgent: vitest_1.vi.fn().mockResolvedValue('Mocked response')
}));
vitest_1.vi.mock('../services/flows/flow-template-runner', () => ({
    executeFlowTemplateNode: vitest_1.vi.fn().mockResolvedValue('{"intent":"agendamento"}')
}));
(0, vitest_1.describe)('FlowExecutor Smoke Test', () => {
    (0, vitest_1.it)('deve executar um flow mínimo (start -> stop) com sucesso', async () => {
        const flowData = {
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
        };
        const context = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: {},
            executionHistory: []
        };
        const executor = new flow_executor_1.FlowExecutor(flowData, context);
        const result = await executor.execute();
        // Verificações básicas
        (0, vitest_1.expect)(result).toBeDefined();
        (0, vitest_1.expect)(result.executionHistory).toHaveLength(2);
        (0, vitest_1.expect)(result.executionHistory[0].nodeId).toBe('node-1');
        (0, vitest_1.expect)(result.executionHistory[1].nodeId).toBe('node-2');
        (0, vitest_1.expect)(result.executionHistory[1].output).toEqual({ stopped: true });
    });
    (0, vitest_1.it)('deve falhar se o node inicial não for encontrado', async () => {
        const flowData = {
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
        };
        const context = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: {},
            executionHistory: []
        };
        const executor = new flow_executor_1.FlowExecutor(flowData, context);
        await (0, vitest_1.expect)(executor.execute()).rejects.toThrow(/startNodeId .* não corresponde a nenhum node/);
    });
    (0, vitest_1.it)('deve executar um node agent em modo template sem exigir agentId', async () => {
        const flowData = {
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
        };
        const context = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: { message: 'Quero agendar uma consulta' },
            executionHistory: []
        };
        const executor = new flow_executor_1.FlowExecutor(flowData, context);
        const result = await executor.execute();
        (0, vitest_1.expect)(result.executionHistory).toHaveLength(3);
        (0, vitest_1.expect)(result.executionHistory[1].executionMode).toBe('template');
        (0, vitest_1.expect)(result.executionHistory[1].agentId).toBeUndefined();
        (0, vitest_1.expect)(result.executionHistory[1].templateId).toBe('template-123');
        (0, vitest_1.expect)(result.data.intent).toBe('agendamento');
    });
    (0, vitest_1.it)('deve executar um node agent legado usando agentId', async () => {
        const flowData = {
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
        };
        const context = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: { message: 'Teste legado' },
            executionHistory: []
        };
        const executor = new flow_executor_1.FlowExecutor(flowData, context);
        const result = await executor.execute();
        (0, vitest_1.expect)(chatwithAgent_1.chatWithAgent).toHaveBeenCalledWith('test@example.com', 'agent-123', vitest_1.expect.any(String), vitest_1.expect.objectContaining({ message: 'Teste legado' }));
        (0, vitest_1.expect)(result.executionHistory[1].executionMode).toBe('agent');
        (0, vitest_1.expect)(result.executionHistory[1].agentId).toBe('agent-123');
    });
    (0, vitest_1.it)('deve executar node debug sem alterar context.data com saída do debug', async () => {
        const flowData = {
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
        };
        const context = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: { foo: 'bar', secret: 42 },
            executionHistory: []
        };
        const executor = new flow_executor_1.FlowExecutor(flowData, context);
        const result = await executor.execute();
        (0, vitest_1.expect)(result.data.foo).toBe('bar');
        (0, vitest_1.expect)(result.data.secret).toBe(42);
        (0, vitest_1.expect)(result.data.kind).toBeUndefined();
        (0, vitest_1.expect)(result.data.snapshot).toBeUndefined();
        const debugStep = result.executionHistory.find((h) => h.nodeId === 'node-2');
        (0, vitest_1.expect)(debugStep).toBeDefined();
        (0, vitest_1.expect)(debugStep?.success).toBe(true);
        (0, vitest_1.expect)(debugStep?.output?.kind).toBe('debug');
        (0, vitest_1.expect)(debugStep?.output?.snapshot).toEqual({ foo: 'bar' });
        (0, vitest_1.expect)(debugStep?.input).toEqual({ keysRequested: ['foo'] });
        (0, vitest_1.expect)(debugStep?.nodeType).toBe('debug');
        (0, vitest_1.expect)(debugStep?.startedAt).toBeDefined();
        (0, vitest_1.expect)(debugStep?.finishedAt).toBeDefined();
    });
});
