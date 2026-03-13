"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const consultarArquivos_1 = require("../services/agents/consultarArquivos");
// Mocking dependencies to avoid environment variable errors and side effects
vitest_1.vi.mock('../lib/logger', () => ({
    default: {
        info: vitest_1.vi.fn(),
        log: vitest_1.vi.fn(),
        error: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn()
    }
}));
vitest_1.vi.mock('../lib/supabase', () => {
    const mockQueryBuilder = {
        select: vitest_1.vi.fn().mockReturnThis(),
        eq: vitest_1.vi.fn().mockReturnThis(),
        in: vitest_1.vi.fn().mockReturnThis(),
        order: vitest_1.vi.fn().mockReturnThis(),
        limit: vitest_1.vi.fn().mockReturnThis(),
        single: vitest_1.vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null, count: null, status: 200, statusText: 'OK' })),
        maybeSingle: vitest_1.vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null, count: null, status: 200, statusText: 'OK' })),
        then: vitest_1.vi.fn().mockImplementation((onFulfilled) => {
            return Promise.resolve({ data: [], error: null, count: null, status: 200, statusText: 'OK' }).then(onFulfilled);
        })
    };
    return {
        supabase: {
            from: vitest_1.vi.fn().mockReturnValue(mockQueryBuilder),
            rpc: vitest_1.vi.fn().mockResolvedValue({ data: [], error: null, count: null, status: 200, statusText: 'OK' })
        }
    };
});
vitest_1.vi.mock('../services/rag/embeddings.service', () => ({
    generateEmbedding: vitest_1.vi.fn().mockResolvedValue({ embedding: [0.1, 0.2, 0.3] })
}));
vitest_1.vi.mock('../utils/plan-helper', () => ({
    canUseRAG: vitest_1.vi.fn().mockResolvedValue({ allowed: true, reason: null })
}));
(0, vitest_1.describe)('RAG Smoke Test', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('deve retornar estrutura válida com dados mockados', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        const queryBuilder = supabase.from('any');
        // Setup for agent files search
        queryBuilder.then.mockImplementationOnce((onFulfilled) => {
            return Promise.resolve({ data: [{ file_id: 'file-1' }], error: null, count: null, status: 200, statusText: 'OK' }).then(onFulfilled);
        });
        // Setup for chunks search (RPC)
        vitest_1.vi.mocked(supabase.rpc).mockResolvedValue({
            data: [{ file_id: 'file-1', content: 'conteúdo de teste' }],
            error: null,
            count: null,
            status: 0,
            statusText: ''
        });
        // Setup for file names search
        queryBuilder.then.mockImplementationOnce((onFulfilled) => {
            return Promise.resolve({ data: [{ id: 'file-1', original_name: 'teste.pdf' }], error: null, count: null, status: 200, statusText: 'OK' }).then(onFulfilled);
        });
        const resultado = await (0, consultarArquivos_1.consultarArquivos)('fake-agent', 'fake-company', 'teste');
        (0, vitest_1.expect)(resultado).toHaveProperty('context');
        (0, vitest_1.expect)(resultado).toHaveProperty('sources');
        (0, vitest_1.expect)(resultado).toHaveProperty('sourceNames');
        (0, vitest_1.expect)(resultado.context).not.toBeNull();
        if (resultado.context) {
            (0, vitest_1.expect)(resultado.context).toContain('conteúdo de teste');
            (0, vitest_1.expect)(resultado.context).toContain('teste.pdf');
        }
        (0, vitest_1.expect)(resultado.sourceNames).toContain('teste.pdf');
        (0, vitest_1.expect)(resultado.sources).toContain('file-1');
    });
    (0, vitest_1.it)('deve retornar vazio se não houver mensagem', async () => {
        const resultado = await (0, consultarArquivos_1.consultarArquivos)('fake-agent', 'fake-company', '');
        (0, vitest_1.expect)(resultado.context).toBeNull();
        (0, vitest_1.expect)(resultado.sources).toEqual([]);
        (0, vitest_1.expect)(resultado.sourceNames).toEqual([]);
    });
});
