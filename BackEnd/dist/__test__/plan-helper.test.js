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
vitest_1.vi.mock('../lib/logger', () => ({
    default: {
        info: vitest_1.vi.fn(),
        log: vitest_1.vi.fn(),
        error: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn(),
    },
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
        single: vitest_1.vi.fn(),
    },
}));
vitest_1.vi.mock('../services/usage-tracker.service', () => ({
    getActiveAgentCount: vitest_1.vi.fn(),
    getCurrentMonthConversationCount: vitest_1.vi.fn(),
    hasContactConversationThisMonth: vitest_1.vi.fn(),
    hasOpenServiceSession: vitest_1.vi.fn(),
}));
vitest_1.vi.mock('../services/service-session.service', () => ({
    getMonthlyAtendimentoCount: vitest_1.vi.fn(),
}));
const usage_tracker_service_1 = require("../services/usage-tracker.service");
const service_session_service_1 = require("../services/service-session.service");
async function mockSubscription(plan, status = 'active') {
    const { supabase } = await Promise.resolve().then(() => __importStar(require('../lib/supabase')));
    vitest_1.vi.mocked(supabase.from).mockReturnValue({
        select: vitest_1.vi.fn().mockReturnThis(),
        eq: vitest_1.vi.fn().mockReturnThis(),
        in: vitest_1.vi.fn().mockReturnThis(),
        order: vitest_1.vi.fn().mockReturnThis(),
        limit: vitest_1.vi.fn().mockReturnThis(),
        maybeSingle: vitest_1.vi.fn().mockResolvedValue({
            data: plan ? { plan, status } : null,
            error: null,
        }),
    });
}
(0, vitest_1.describe)('Plan Helper - getPlanInfo', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        plan_helper_1.planInfoCache.clear();
    });
    (0, vitest_1.it)('normaliza legado pro para rec_start', async () => {
        await mockSubscription('pro');
        const result = await (0, plan_helper_1.getPlanInfo)('test-company-id');
        (0, vitest_1.expect)(result.plan).toBe('rec_start');
        (0, vitest_1.expect)(result.limits.conversations).toBe(200);
        (0, vitest_1.expect)(result.limits.hasActiveOutbound).toBe(false);
    });
    (0, vitest_1.it)('retorna com_growth para legado plus', async () => {
        await mockSubscription('plus');
        const result = await (0, plan_helper_1.getPlanInfo)('test-company-id');
        (0, vitest_1.expect)(result.plan).toBe('com_growth');
        (0, vitest_1.expect)(result.limits.conversations).toBe(1500);
        (0, vitest_1.expect)(result.limits.hasActiveOutbound).toBe(true);
    });
    (0, vitest_1.it)('retorna rec_growth com RAG', async () => {
        await mockSubscription('rec_growth');
        const result = await (0, plan_helper_1.getPlanInfo)('test-company-id');
        (0, vitest_1.expect)(result.plan).toBe('rec_growth');
        (0, vitest_1.expect)(result.limits.hasRAG).toBe(true);
        (0, vitest_1.expect)(result.limits.agents).toBe(3);
    });
    (0, vitest_1.it)('enterprise receptivo sem limite de conversas', async () => {
        await mockSubscription('rec_enterprise');
        const result = await (0, plan_helper_1.getPlanInfo)('test-company-id');
        (0, vitest_1.expect)(result.limits.conversations).toBe(null);
        (0, vitest_1.expect)(result.limits.hasSSO).toBe(true);
    });
});
(0, vitest_1.describe)('Plan Helper - canCreateAgent', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        plan_helper_1.planInfoCache.clear();
    });
    (0, vitest_1.it)('bloqueia rec_start com 1 agente ativo', async () => {
        await mockSubscription('rec_start');
        vitest_1.vi.mocked(usage_tracker_service_1.getActiveAgentCount).mockResolvedValue(1);
        const result = await (0, plan_helper_1.canCreateAgent)('test-company-id');
        (0, vitest_1.expect)(result.allowed).toBe(false);
        (0, vitest_1.expect)(result.upgradePlan).toBe('rec_growth');
    });
});
(0, vitest_1.describe)('Plan Helper - canStartNewAtendimento', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        plan_helper_1.planInfoCache.clear();
        vitest_1.vi.mocked(service_session_service_1.getMonthlyAtendimentoCount).mockResolvedValue(0);
    });
    (0, vitest_1.it)('permite abrir sessão abaixo do limite', async () => {
        await mockSubscription('rec_start');
        vitest_1.vi.mocked(service_session_service_1.getMonthlyAtendimentoCount).mockResolvedValue(100);
        const result = await (0, plan_helper_1.canStartNewAtendimento)('test-company-id');
        (0, vitest_1.expect)(result.allowed).toBe(true);
    });
    (0, vitest_1.it)('bloqueia ao atingir 200 sessões', async () => {
        await mockSubscription('rec_start');
        vitest_1.vi.mocked(service_session_service_1.getMonthlyAtendimentoCount).mockResolvedValue(200);
        const result = await (0, plan_helper_1.canStartNewAtendimento)('test-company-id');
        (0, vitest_1.expect)(result.allowed).toBe(false);
        (0, vitest_1.expect)(result.reason).toMatch(/Atualize seu plano/);
        (0, vitest_1.expect)(result.upgradePlan).toBe('rec_growth');
    });
    (0, vitest_1.it)('enterprise ilimitado', async () => {
        await mockSubscription('rec_enterprise');
        const result = await (0, plan_helper_1.canStartNewAtendimento)('test-company-id');
        (0, vitest_1.expect)(result.allowed).toBe(true);
    });
});
(0, vitest_1.describe)('Plan Helper - canAcceptConversation (sessões)', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        plan_helper_1.planInfoCache.clear();
        vitest_1.vi.mocked(usage_tracker_service_1.hasOpenServiceSession).mockResolvedValue(false);
        vitest_1.vi.mocked(service_session_service_1.getMonthlyAtendimentoCount).mockResolvedValue(0);
    });
    (0, vitest_1.it)('permite continuar sessão aberta mesmo no limite', async () => {
        await mockSubscription('rec_start');
        vitest_1.vi.mocked(usage_tracker_service_1.hasOpenServiceSession).mockResolvedValue(true);
        vitest_1.vi.mocked(service_session_service_1.getMonthlyAtendimentoCount).mockResolvedValue(200);
        const result = await (0, plan_helper_1.canAcceptConversation)('test-company-id', 'contact-1', 'int-1');
        (0, vitest_1.expect)(result.allowed).toBe(true);
        (0, vitest_1.expect)(result.continuing).toBe(true);
    });
    (0, vitest_1.it)('bloqueia novo atendimento quando limite atingido', async () => {
        await mockSubscription('rec_start');
        vitest_1.vi.mocked(service_session_service_1.getMonthlyAtendimentoCount).mockResolvedValue(200);
        const result = await (0, plan_helper_1.canAcceptConversation)('test-company-id', 'contact-new', 'int-1');
        (0, vitest_1.expect)(result.allowed).toBe(false);
        (0, vitest_1.expect)(result.continuing).toBe(false);
    });
});
(0, vitest_1.describe)('Plan Helper - canSendMessage (alias conversas)', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        plan_helper_1.planInfoCache.clear();
        vitest_1.vi.mocked(usage_tracker_service_1.getCurrentMonthConversationCount).mockResolvedValue(200);
    });
    (0, vitest_1.it)('bloqueia rec_start no limite', async () => {
        await mockSubscription('rec_start');
        const result = await (0, plan_helper_1.canSendMessage)('test-company-id', 200);
        (0, vitest_1.expect)(result.allowed).toBe(false);
    });
});
(0, vitest_1.describe)('Plan Helper - canUseActiveOutbound', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        plan_helper_1.planInfoCache.clear();
    });
    (0, vitest_1.it)('bloqueia linha receptiva', async () => {
        await mockSubscription('rec_growth');
        const result = await (0, plan_helper_1.canUseActiveOutbound)('test-company-id');
        (0, vitest_1.expect)(result.allowed).toBe(false);
        (0, vitest_1.expect)(result.upgradePlan).toBe('com_start');
    });
    (0, vitest_1.it)('permite linha completa', async () => {
        await mockSubscription('com_start');
        const result = await (0, plan_helper_1.canUseActiveOutbound)('test-company-id');
        (0, vitest_1.expect)(result.allowed).toBe(true);
    });
});
(0, vitest_1.describe)('Plan Helper - canUseRAG', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        plan_helper_1.planInfoCache.clear();
    });
    (0, vitest_1.it)('bloqueia rec_start', async () => {
        await mockSubscription('rec_start');
        const result = await (0, plan_helper_1.canUseRAG)('test-company-id');
        (0, vitest_1.expect)(result.allowed).toBe(false);
    });
    (0, vitest_1.it)('permite com_growth', async () => {
        await mockSubscription('com_growth');
        const result = await (0, plan_helper_1.canUseRAG)('test-company-id');
        (0, vitest_1.expect)(result.allowed).toBe(true);
    });
});
(0, vitest_1.describe)('Plan Helper - governance e SSO', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        plan_helper_1.planInfoCache.clear();
    });
    (0, vitest_1.it)('permite governance em com_enterprise', async () => {
        await mockSubscription('com_enterprise');
        (0, vitest_1.expect)((await (0, plan_helper_1.canUseGovernance)('x')).allowed).toBe(true);
        (0, vitest_1.expect)((await (0, plan_helper_1.canUseSSO)('x')).allowed).toBe(true);
    });
    (0, vitest_1.it)('bloqueia governance em com_start', async () => {
        await mockSubscription('com_start');
        (0, vitest_1.expect)((await (0, plan_helper_1.canUseGovernance)('x')).allowed).toBe(false);
    });
});
