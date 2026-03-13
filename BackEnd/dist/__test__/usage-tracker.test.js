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
const usage_tracker_service_1 = require("../services/usage-tracker.service");
// Mock dependencies
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
        in: vitest_1.vi.fn().mockReturnThis(),
        gte: vitest_1.vi.fn().mockReturnThis(),
        lte: vitest_1.vi.fn().mockReturnThis(),
        order: vitest_1.vi.fn().mockReturnThis(),
        limit: vitest_1.vi.fn().mockReturnThis(),
        maybeSingle: vitest_1.vi.fn(),
        single: vitest_1.vi.fn(),
        insert: vitest_1.vi.fn().mockReturnThis(),
        update: vitest_1.vi.fn().mockReturnThis(),
        raw: vitest_1.vi.fn((query) => query)
    }
}));
(0, vitest_1.describe)('Usage Tracker - getCurrentAgentCount', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('deve retornar 0 quando não há agentes', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        vitest_1.vi.mocked(supabase.from).mockReturnValue({
            select: vitest_1.vi.fn().mockReturnValue({
                eq: vitest_1.vi.fn().mockResolvedValue({ count: 0, error: null })
            })
        });
        const result = await (0, usage_tracker_service_1.getCurrentAgentCount)('test-company-id');
        (0, vitest_1.expect)(result).toBe(0);
    });
    (0, vitest_1.it)('deve retornar contagem correta de agentes', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        vitest_1.vi.mocked(supabase.from).mockReturnValue({
            select: vitest_1.vi.fn().mockReturnValue({
                eq: vitest_1.vi.fn().mockResolvedValue({ count: 3, error: null })
            })
        });
        const result = await (0, usage_tracker_service_1.getCurrentAgentCount)('test-company-id');
        (0, vitest_1.expect)(result).toBe(3);
    });
    (0, vitest_1.it)('deve retornar 0 em caso de erro', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        vitest_1.vi.mocked(supabase.from).mockReturnValue({
            select: vitest_1.vi.fn().mockReturnValue({
                eq: vitest_1.vi.fn().mockResolvedValue({
                    count: null,
                    error: { message: 'Database error' }
                })
            })
        });
        const result = await (0, usage_tracker_service_1.getCurrentAgentCount)('test-company-id');
        (0, vitest_1.expect)(result).toBe(0);
    });
});
(0, vitest_1.describe)('Usage Tracker - getCurrentMessageCount', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('deve retornar 0 quando não há mensagens', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        // Mock para buscar integrações
        const integrationsMock = {
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockResolvedValue({
                data: [{ id: 'integration-1' }],
                error: null
            })
        };
        // Mock para contar mensagens - select retorna objeto com métodos encadeados
        const messagesMock = {
            select: vitest_1.vi.fn().mockReturnValue({
                in: vitest_1.vi.fn().mockReturnValue({
                    eq: vitest_1.vi.fn().mockReturnValue({
                        gte: vitest_1.vi.fn().mockReturnValue({
                            lte: vitest_1.vi.fn().mockResolvedValue({ count: 0, error: null })
                        })
                    })
                })
            })
        };
        vitest_1.vi.mocked(supabase.from).mockImplementation((table) => {
            if (table === 'tb_integrations')
                return integrationsMock;
            if (table === 'tb_whatsapp_messages')
                return messagesMock;
            return {};
        });
        const result = await (0, usage_tracker_service_1.getCurrentMessageCount)('test-company-id');
        (0, vitest_1.expect)(result).toBe(0);
    });
    (0, vitest_1.it)('deve retornar contagem correta de mensagens', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        const integrationsMock = {
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockResolvedValue({
                data: [{ id: 'integration-1' }],
                error: null
            })
        };
        const messagesMock = {
            select: vitest_1.vi.fn().mockReturnValue({
                in: vitest_1.vi.fn().mockReturnValue({
                    eq: vitest_1.vi.fn().mockReturnValue({
                        gte: vitest_1.vi.fn().mockReturnValue({
                            lte: vitest_1.vi.fn().mockResolvedValue({ count: 25, error: null })
                        })
                    })
                })
            })
        };
        vitest_1.vi.mocked(supabase.from).mockImplementation((table) => {
            if (table === 'tb_integrations')
                return integrationsMock;
            if (table === 'tb_whatsapp_messages')
                return messagesMock;
            return {};
        });
        const result = await (0, usage_tracker_service_1.getCurrentMessageCount)('test-company-id');
        (0, vitest_1.expect)(result).toBe(25);
    });
});
(0, vitest_1.describe)('Usage Tracker - incrementMessageCount', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('deve criar novo registro quando não existe', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        const insertMock = vitest_1.vi.fn();
        const selectAfterInsert = vitest_1.vi.fn();
        const maybeSingleAfterInsert = vitest_1.vi.fn().mockResolvedValue({
            data: { id: 'new-metric-id' },
            error: null
        });
        vitest_1.vi.mocked(supabase.from).mockImplementation((table) => {
            if (table === 'tb_usage_metrics') {
                return {
                    select: vitest_1.vi.fn().mockReturnValue({
                        eq: vitest_1.vi.fn().mockReturnValue({
                            eq: vitest_1.vi.fn().mockReturnValue({
                                maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                                    data: null,
                                    error: { code: 'PGRST116' }
                                })
                            })
                        })
                    }),
                    insert: insertMock.mockReturnValue({
                        select: selectAfterInsert.mockReturnValue({
                            maybeSingle: maybeSingleAfterInsert
                        })
                    })
                };
            }
            return {};
        });
        await (0, usage_tracker_service_1.incrementMessageCount)('test-company-id');
        (0, vitest_1.expect)(insertMock).toHaveBeenCalled();
    });
    (0, vitest_1.it)('deve atualizar registro existente', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        const updateMock = vitest_1.vi.fn();
        const eqAfterUpdate = vitest_1.vi.fn().mockResolvedValue({
            error: null
        });
        vitest_1.vi.mocked(supabase.from).mockImplementation((table) => {
            if (table === 'tb_usage_metrics') {
                return {
                    select: vitest_1.vi.fn().mockReturnValue({
                        eq: vitest_1.vi.fn().mockReturnValue({
                            eq: vitest_1.vi.fn().mockReturnValue({
                                maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                                    data: { id: 'existing-metric-id', message_count: 5 },
                                    error: null
                                })
                            })
                        })
                    }),
                    update: updateMock.mockReturnValue({
                        eq: eqAfterUpdate
                    })
                };
            }
            return {};
        });
        await (0, usage_tracker_service_1.incrementMessageCount)('test-company-id');
        (0, vitest_1.expect)(updateMock).toHaveBeenCalled();
    });
});
