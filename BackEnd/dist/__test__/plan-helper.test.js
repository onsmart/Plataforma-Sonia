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
const plan_helper_1 = require("../utils/plan-helper");
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
        order: vitest_1.vi.fn().mockReturnThis(),
        limit: vitest_1.vi.fn().mockReturnThis(),
        maybeSingle: vitest_1.vi.fn(),
        single: vitest_1.vi.fn()
    }
}));
vitest_1.vi.mock('../services/usage-tracker.service', () => ({
    getActiveAgentCount: vitest_1.vi.fn(),
    getCurrentMessageCount: vitest_1.vi.fn()
}));
(0, vitest_1.describe)('Plan Helper - getPlanInfo', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('deve retornar starter com status inactive quando não há subscription', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        vitest_1.vi.mocked(supabase.from).mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            in: vitest_1.vi.fn().mockReturnThis(),
            order: vitest_1.vi.fn().mockReturnThis(),
            limit: vitest_1.vi.fn().mockReturnThis(),
            maybeSingle: vitest_1.vi.fn().mockResolvedValue({ data: null, error: null })
        });
        const result = await (0, plan_helper_1.getPlanInfo)('test-company-id');
        (0, vitest_1.expect)(result.plan).toBe('starter');
        (0, vitest_1.expect)(result.status).toBe('inactive');
        (0, vitest_1.expect)(result.limits.agents).toBe(1);
        (0, vitest_1.expect)(result.limits.messages).toBe(50);
        (0, vitest_1.expect)(result.limits.hasRAG).toBe(false);
    });
    (0, vitest_1.it)('deve retornar pro com status active quando há subscription ativa', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        vitest_1.vi.mocked(supabase.from).mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            in: vitest_1.vi.fn().mockReturnThis(),
            order: vitest_1.vi.fn().mockReturnThis(),
            limit: vitest_1.vi.fn().mockReturnThis(),
            maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                data: { plan: 'pro', status: 'active' },
                error: null
            })
        });
        const result = await (0, plan_helper_1.getPlanInfo)('test-company-id');
        (0, vitest_1.expect)(result.plan).toBe('pro');
        (0, vitest_1.expect)(result.status).toBe('active');
        (0, vitest_1.expect)(result.limits.agents).toBe(5);
        (0, vitest_1.expect)(result.limits.messages).toBe(null); // unlimited
        (0, vitest_1.expect)(result.limits.hasRAG).toBe(true);
    });
    (0, vitest_1.it)('deve retornar enterprise com status active quando há subscription enterprise', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        vitest_1.vi.mocked(supabase.from).mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            in: vitest_1.vi.fn().mockReturnThis(),
            order: vitest_1.vi.fn().mockReturnThis(),
            limit: vitest_1.vi.fn().mockReturnThis(),
            maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                data: { plan: 'enterprise', status: 'active' },
                error: null
            })
        });
        const result = await (0, plan_helper_1.getPlanInfo)('test-company-id');
        (0, vitest_1.expect)(result.plan).toBe('enterprise');
        (0, vitest_1.expect)(result.status).toBe('active');
        (0, vitest_1.expect)(result.limits.agents).toBe(null); // unlimited
        (0, vitest_1.expect)(result.limits.messages).toBe(null); // unlimited
        (0, vitest_1.expect)(result.limits.hasRAG).toBe(true);
        (0, vitest_1.expect)(result.limits.hasSSO).toBe(true);
        (0, vitest_1.expect)(result.limits.hasGovernance).toBe(true);
    });
});
(0, vitest_1.describe)('Plan Helper - canCreateAgent', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('deve permitir criar agente quando está abaixo do limite', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        vitest_1.vi.mocked(supabase.from).mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            in: vitest_1.vi.fn().mockReturnThis(),
            order: vitest_1.vi.fn().mockReturnThis(),
            limit: vitest_1.vi.fn().mockReturnThis(),
            maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                data: { plan: 'starter', status: 'active' },
                error: null
            })
        });
        vitest_1.vi.mocked(usage_tracker_service_1.getActiveAgentCount).mockResolvedValue(0);
        const result = await (0, plan_helper_1.canCreateAgent)('test-company-id');
        (0, vitest_1.expect)(result.allowed).toBe(true);
    });
    (0, vitest_1.it)('deve bloquear criação quando atingiu o limite', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        vitest_1.vi.mocked(supabase.from).mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            in: vitest_1.vi.fn().mockReturnThis(),
            order: vitest_1.vi.fn().mockReturnThis(),
            limit: vitest_1.vi.fn().mockReturnThis(),
            maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                data: { plan: 'starter', status: 'active' },
                error: null
            })
        });
        vitest_1.vi.mocked(usage_tracker_service_1.getActiveAgentCount).mockResolvedValue(1); // Limite do starter é 1, já tem 1 ativo
        const result = await (0, plan_helper_1.canCreateAgent)('test-company-id');
        (0, vitest_1.expect)(result.allowed).toBe(false);
        (0, vitest_1.expect)(result.reason).toContain('limite');
        (0, vitest_1.expect)(result.upgradePlan).toBe('pro');
    });
    (0, vitest_1.it)('deve bloquear quando subscription não está ativa', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        vitest_1.vi.mocked(supabase.from).mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            in: vitest_1.vi.fn().mockReturnThis(),
            order: vitest_1.vi.fn().mockReturnThis(),
            limit: vitest_1.vi.fn().mockReturnThis(),
            maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                data: null, // Sem subscription
                error: null
            })
        });
        const result = await (0, plan_helper_1.canCreateAgent)('test-company-id');
        (0, vitest_1.expect)(result.allowed).toBe(false);
        (0, vitest_1.expect)(result.reason).toContain('assinatura ativa');
    });
});
(0, vitest_1.describe)('Plan Helper - canSendMessage', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('deve permitir enviar mensagem quando está abaixo do limite', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        vitest_1.vi.mocked(supabase.from).mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            in: vitest_1.vi.fn().mockReturnThis(),
            order: vitest_1.vi.fn().mockReturnThis(),
            limit: vitest_1.vi.fn().mockReturnThis(),
            maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                data: { plan: 'starter', status: 'active' },
                error: null
            })
        });
        vitest_1.vi.mocked(usage_tracker_service_1.getCurrentMessageCount).mockResolvedValue(30); // Abaixo do limite de 50
        const result = await (0, plan_helper_1.canSendMessage)('test-company-id', 30);
        (0, vitest_1.expect)(result.allowed).toBe(true);
    });
    (0, vitest_1.it)('deve bloquear quando atingiu o limite de mensagens', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        vitest_1.vi.mocked(supabase.from).mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            in: vitest_1.vi.fn().mockReturnThis(),
            order: vitest_1.vi.fn().mockReturnThis(),
            limit: vitest_1.vi.fn().mockReturnThis(),
            maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                data: { plan: 'starter', status: 'active' },
                error: null
            })
        });
        const result = await (0, plan_helper_1.canSendMessage)('test-company-id', 50); // Limite do starter é 50
        (0, vitest_1.expect)(result.allowed).toBe(false);
        (0, vitest_1.expect)(result.reason).toContain('limite');
    });
    (0, vitest_1.it)('deve permitir mensagens ilimitadas no plano pro', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        vitest_1.vi.mocked(supabase.from).mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            in: vitest_1.vi.fn().mockReturnThis(),
            order: vitest_1.vi.fn().mockReturnThis(),
            limit: vitest_1.vi.fn().mockReturnThis(),
            maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                data: { plan: 'pro', status: 'active' },
                error: null
            })
        });
        const result = await (0, plan_helper_1.canSendMessage)('test-company-id', 999999);
        (0, vitest_1.expect)(result.allowed).toBe(true); // Pro tem mensagens ilimitadas
    });
});
(0, vitest_1.describe)('Plan Helper - canUseRAG', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('deve permitir RAG no plano pro', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        vitest_1.vi.mocked(supabase.from).mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            in: vitest_1.vi.fn().mockReturnThis(),
            order: vitest_1.vi.fn().mockReturnThis(),
            limit: vitest_1.vi.fn().mockReturnThis(),
            maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                data: { plan: 'pro', status: 'active' },
                error: null
            })
        });
        const result = await (0, plan_helper_1.canUseRAG)('test-company-id');
        (0, vitest_1.expect)(result.allowed).toBe(true);
    });
    (0, vitest_1.it)('deve bloquear RAG no plano starter', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        vitest_1.vi.mocked(supabase.from).mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            in: vitest_1.vi.fn().mockReturnThis(),
            order: vitest_1.vi.fn().mockReturnThis(),
            limit: vitest_1.vi.fn().mockReturnThis(),
            maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                data: { plan: 'starter', status: 'active' },
                error: null
            })
        });
        const result = await (0, plan_helper_1.canUseRAG)('test-company-id');
        (0, vitest_1.expect)(result.allowed).toBe(false);
        (0, vitest_1.expect)(result.reason).toContain('RAG');
        (0, vitest_1.expect)(result.upgradePlan).toBe('pro');
    });
});
(0, vitest_1.describe)('Plan Helper - canUseGovernance', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('deve permitir Governance no plano enterprise', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        vitest_1.vi.mocked(supabase.from).mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            in: vitest_1.vi.fn().mockReturnThis(),
            order: vitest_1.vi.fn().mockReturnThis(),
            limit: vitest_1.vi.fn().mockReturnThis(),
            maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                data: { plan: 'enterprise', status: 'active' },
                error: null
            })
        });
        const result = await (0, plan_helper_1.canUseGovernance)('test-company-id');
        (0, vitest_1.expect)(result.allowed).toBe(true);
    });
    (0, vitest_1.it)('deve bloquear Governance em planos inferiores', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        vitest_1.vi.mocked(supabase.from).mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            in: vitest_1.vi.fn().mockReturnThis(),
            order: vitest_1.vi.fn().mockReturnThis(),
            limit: vitest_1.vi.fn().mockReturnThis(),
            maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                data: { plan: 'pro', status: 'active' },
                error: null
            })
        });
        const result = await (0, plan_helper_1.canUseGovernance)('test-company-id');
        (0, vitest_1.expect)(result.allowed).toBe(false);
        (0, vitest_1.expect)(result.reason).toContain('Enterprise');
    });
});
(0, vitest_1.describe)('Plan Helper - canUseSSO', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('deve permitir SSO no plano enterprise', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        vitest_1.vi.mocked(supabase.from).mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            in: vitest_1.vi.fn().mockReturnThis(),
            order: vitest_1.vi.fn().mockReturnThis(),
            limit: vitest_1.vi.fn().mockReturnThis(),
            maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                data: { plan: 'enterprise', status: 'active' },
                error: null
            })
        });
        const result = await (0, plan_helper_1.canUseSSO)('test-company-id');
        (0, vitest_1.expect)(result.allowed).toBe(true);
    });
    (0, vitest_1.it)('deve bloquear SSO em planos inferiores', async () => {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
        vitest_1.vi.mocked(supabase.from).mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            in: vitest_1.vi.fn().mockReturnThis(),
            order: vitest_1.vi.fn().mockReturnThis(),
            limit: vitest_1.vi.fn().mockReturnThis(),
            maybeSingle: vitest_1.vi.fn().mockResolvedValue({
                data: { plan: 'pro', status: 'active' },
                error: null
            })
        });
        const result = await (0, plan_helper_1.canUseSSO)('test-company-id');
        (0, vitest_1.expect)(result.allowed).toBe(false);
        (0, vitest_1.expect)(result.reason).toContain('Enterprise');
    });
});
