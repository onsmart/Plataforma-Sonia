"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const flow_executor_1 = require("../services/flows/flow-executor");
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
vitest_1.vi.mock('../agents/chatwithAgent', () => ({
    chatWithAgent: vitest_1.vi.fn().mockResolvedValue('Mocked response')
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
        await (0, vitest_1.expect)(executor.execute()).rejects.toThrow('Node inicial não encontrado');
    });
});
