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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.planInfoCache = void 0;
exports.clearPlanInfoCache = clearPlanInfoCache;
exports.getPlanInfo = getPlanInfo;
exports.canCreateAgent = canCreateAgent;
exports.canActivateAgent = canActivateAgent;
exports.canStartNewAtendimento = canStartNewAtendimento;
exports.canAcceptConversation = canAcceptConversation;
exports.canSendMessage = canSendMessage;
exports.canUseActiveOutbound = canUseActiveOutbound;
exports.canUseRAG = canUseRAG;
exports.canUseFlows = canUseFlows;
exports.canUseCrmApi = canUseCrmApi;
exports.canUseSSO = canUseSSO;
exports.canUseGovernance = canUseGovernance;
const supabase_1 = require("../lib/supabase");
const logger_1 = __importDefault(require("../lib/logger"));
const plans_catalog_1 = require("../config/plans.catalog");
exports.planInfoCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
function clearPlanInfoCache(companiesId) {
    if (companiesId) {
        exports.planInfoCache.delete(companiesId);
        return;
    }
    exports.planInfoCache.clear();
}
function buildFreePlanInfo() {
    const free = (0, plans_catalog_1.getFreePlanDisplay)();
    return {
        plan: plans_catalog_1.FREE_PLAN_ID,
        planCode: free.code,
        planTitle: free.title,
        status: 'inactive',
        limits: { ...plans_catalog_1.FREE_PLAN_LIMITS },
    };
}
function getPlanLimits(planId) {
    return (0, plans_catalog_1.planLimitsFromCatalog)(planId);
}
function suggestUpgradePlan(current) {
    const entry = (0, plans_catalog_1.getPlanCatalogEntry)(current);
    if (entry.productLine === 'rec') {
        if (entry.tier === 'start')
            return 'rec_growth';
        if (entry.tier === 'growth')
            return 'rec_enterprise';
        return 'rec_enterprise';
    }
    if (entry.tier === 'start')
        return 'com_growth';
    if (entry.tier === 'growth')
        return 'com_enterprise';
    return 'com_enterprise';
}
async function getPlanInfo(companiesId) {
    try {
        const cached = exports.planInfoCache.get(companiesId);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.info;
        }
        const { data: subscription, error } = await supabase_1.supabase
            .from('tb_subscriptions')
            .select('plan, status, current_period_end, canceled_at')
            .eq('companies_id', companiesId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) {
            logger_1.default.warn(`[getPlanInfo] Erro ao buscar subscription: ${error.message}`);
        }
        const cancelAtPeriodEnd = (0, plans_catalog_1.isCancelAtPeriodEnd)(subscription || {});
        let usageLimitReached = false;
        if (subscription && cancelAtPeriodEnd) {
            const planLimits = getPlanLimits((0, plans_catalog_1.normalizePlanId)(subscription.plan));
            if (planLimits.conversations !== null) {
                const { getMonthlyAtendimentoCount } = await Promise.resolve().then(() => __importStar(require('../services/service-session.service')));
                const used = await getMonthlyAtendimentoCount(companiesId);
                usageLimitReached = used >= planLimits.conversations;
            }
        }
        if (!subscription ||
            !(0, plans_catalog_1.hasEffectivePaidAccess)(subscription, { cancelAtPeriodEnd, usageLimitReached })) {
            const planInfo = buildFreePlanInfo();
            if (subscription?.status === 'canceled') {
                planInfo.status = 'canceled';
            }
            exports.planInfoCache.set(companiesId, {
                info: planInfo,
                expiresAt: Date.now() + CACHE_TTL_MS,
            });
            return planInfo;
        }
        const plan = (0, plans_catalog_1.normalizePlanId)(subscription.plan);
        const catalog = (0, plans_catalog_1.getPlanCatalogEntry)(plan);
        const subscriptionStatus = String(subscription.status || 'inactive');
        const planInfo = {
            plan,
            planCode: catalog.code,
            planTitle: catalog.title,
            status: subscriptionStatus === 'canceled' && (0, plans_catalog_1.hasEffectivePaidAccess)(subscription)
                ? 'active'
                : (0, plans_catalog_1.isPaidSubscriptionStatus)(subscriptionStatus)
                    ? 'active'
                    : subscriptionStatus === 'canceled'
                        ? 'canceled'
                        : 'inactive',
            limits: getPlanLimits(plan),
        };
        exports.planInfoCache.set(companiesId, {
            info: planInfo,
            expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return planInfo;
    }
    catch (err) {
        logger_1.default.error('[getPlanInfo] Erro:', err);
        return buildFreePlanInfo();
    }
}
async function canCreateAgent(companiesId) {
    const planInfo = await getPlanInfo(companiesId);
    if (planInfo.status !== 'active') {
        return {
            allowed: false,
            reason: 'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
            upgradePlan: 'rec_start',
        };
    }
    const limit = planInfo.limits.agents;
    if (limit === null) {
        return { allowed: true };
    }
    const { getActiveAgentCount } = await Promise.resolve().then(() => __importStar(require('../services/usage-tracker.service')));
    const activeCount = await getActiveAgentCount(companiesId);
    if (activeCount >= limit) {
        const upgradePlan = suggestUpgradePlan(planInfo.plan);
        return {
            allowed: false,
            reason: `Você já tem ${activeCount} agente(s) ativo(s). O plano ${planInfo.planTitle} permite apenas ${limit} agente(s) ativo(s). Faça upgrade para ${(0, plans_catalog_1.getPlanCatalogEntry)(upgradePlan).title}.`,
            upgradePlan,
        };
    }
    return { allowed: true };
}
async function canActivateAgent(companiesId, agentIdToActivate) {
    const planInfo = await getPlanInfo(companiesId);
    if (planInfo.status !== 'active') {
        return {
            allowed: false,
            reason: 'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
            upgradePlan: 'rec_start',
        };
    }
    const limit = planInfo.limits.agents;
    if (limit === null) {
        return { allowed: true };
    }
    const { getActiveAgentCount } = await Promise.resolve().then(() => __importStar(require('../services/usage-tracker.service')));
    const currentActiveCount = await getActiveAgentCount(companiesId);
    const { data: agent } = await supabase_1.supabase
        .from('tb_agents')
        .select('status_id')
        .eq('id', agentIdToActivate)
        .eq('companies_id', companiesId)
        .maybeSingle();
    if (agent?.status_id === 1) {
        return { allowed: true };
    }
    if (currentActiveCount >= limit) {
        const upgradePlan = suggestUpgradePlan(planInfo.plan);
        return {
            allowed: false,
            reason: `Você já tem ${currentActiveCount} agente(s) ativo(s). O plano ${planInfo.planTitle} permite apenas ${limit} agente(s) ativo(s). Faça upgrade para ${(0, plans_catalog_1.getPlanCatalogEntry)(upgradePlan).title}.`,
            upgradePlan,
        };
    }
    return { allowed: true };
}
/**
 * Limite mensal de atendimentos = sessões abertas no mês (tb_service_sessions).
 */
async function canStartNewAtendimento(companiesId) {
    const planInfo = await getPlanInfo(companiesId);
    if (planInfo.status !== 'active') {
        return {
            allowed: false,
            reason: 'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar atendendo conversas.',
            upgradePlan: 'rec_start',
        };
    }
    const limit = planInfo.limits.conversations;
    if (limit === null) {
        return { allowed: true, conversationsLimit: null };
    }
    const { getMonthlyAtendimentoCount } = await Promise.resolve().then(() => __importStar(require('../services/service-session.service')));
    const used = await getMonthlyAtendimentoCount(companiesId);
    if (used >= limit) {
        const upgradePlan = suggestUpgradePlan(planInfo.plan);
        return {
            allowed: false,
            reason: 'Atualize seu plano para poder ter mais acesso a números de atendimentos, ou entre em contato conosco para uma possível recarga.',
            upgradePlan,
            conversationsUsed: used,
            conversationsLimit: limit,
        };
    }
    return {
        allowed: true,
        conversationsUsed: used,
        conversationsLimit: limit,
    };
}
/**
 * Gate de inbound WhatsApp: continua sessão aberta ou delega abertura via resolveInboundSession.
 * @deprecated Preferir resolveInboundSession; mantido para compatibilidade.
 */
async function canAcceptConversation(companiesId, whatsappContactId, integrationId) {
    const { hasOpenServiceSession } = await Promise.resolve().then(() => __importStar(require('../services/usage-tracker.service')));
    if (await hasOpenServiceSession(companiesId, whatsappContactId, integrationId)) {
        const planInfo = await getPlanInfo(companiesId);
        return {
            allowed: true,
            continuing: true,
            conversationsLimit: planInfo.limits.conversations,
        };
    }
    const gate = await canStartNewAtendimento(companiesId);
    return { ...gate, continuing: false };
}
/** @deprecated Preferir canAcceptConversation; mantido para compatibilidade com RPC antiga */
async function canSendMessage(companiesId, currentMessageCount) {
    const planInfo = await getPlanInfo(companiesId);
    if (planInfo.status !== 'active') {
        return {
            allowed: false,
            reason: 'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
            upgradePlan: 'rec_start',
        };
    }
    const limit = planInfo.limits.conversations;
    if (limit === null) {
        return { allowed: true };
    }
    const { getCurrentMonthConversationCount } = await Promise.resolve().then(() => __importStar(require('../services/usage-tracker.service')));
    const used = typeof currentMessageCount === 'number'
        ? currentMessageCount
        : await getCurrentMonthConversationCount(companiesId);
    if (used >= limit) {
        const upgradePlan = suggestUpgradePlan(planInfo.plan);
        return {
            allowed: false,
            reason: `Você atingiu o limite de ${limit} atendimentos/mês do plano ${planInfo.planTitle}. Faça upgrade para ${(0, plans_catalog_1.getPlanCatalogEntry)(upgradePlan).title}.`,
            upgradePlan,
        };
    }
    return { allowed: true };
}
async function canUseActiveOutbound(companiesId) {
    const planInfo = await getPlanInfo(companiesId);
    if (planInfo.status !== 'active') {
        return {
            allowed: false,
            reason: 'Assinatura inativa. Ative um plano Sonia Completa para usar IA ativa/SDR.',
            upgradePlan: 'com_start',
        };
    }
    if (!planInfo.limits.hasActiveOutbound) {
        return {
            allowed: false,
            reason: 'Operação ativa (SDR, campanhas outbound) está disponível apenas nos planos Sonia Completa (COM_START, COM_GROWTH, COM_ENTERPRISE).',
            upgradePlan: 'com_start',
        };
    }
    return { allowed: true };
}
async function canUseRAG(companiesId) {
    const planInfo = await getPlanInfo(companiesId);
    if (planInfo.status !== 'active') {
        return {
            allowed: false,
            reason: 'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
            upgradePlan: suggestUpgradePlan(planInfo.plan),
        };
    }
    if (!planInfo.limits.hasRAG) {
        const upgradePlan = suggestUpgradePlan(planInfo.plan);
        return {
            allowed: false,
            reason: `A base de conhecimento (RAG) não está incluída no plano ${planInfo.planTitle}. Faça upgrade para ${(0, plans_catalog_1.getPlanCatalogEntry)(upgradePlan).title}.`,
            upgradePlan,
        };
    }
    return { allowed: true };
}
async function canUseFlows(companiesId) {
    const planInfo = await getPlanInfo(companiesId);
    if (planInfo.status !== 'active') {
        return {
            allowed: false,
            reason: 'Você não tem uma assinatura ativa. Contrate o plano Receptivo Growth para usar fluxos visuais.',
            upgradePlan: 'rec_growth',
        };
    }
    if (!planInfo.limits.hasFlows) {
        const upgradePlan = suggestUpgradePlan(planInfo.plan);
        return {
            allowed: false,
            reason: `Fluxos visuais não estão incluídos no plano ${planInfo.planTitle}. Faça upgrade para ${(0, plans_catalog_1.getPlanCatalogEntry)(upgradePlan).title}.`,
            upgradePlan,
        };
    }
    return { allowed: true };
}
async function canUseCrmApi(companiesId) {
    const planInfo = await getPlanInfo(companiesId);
    if (planInfo.status !== 'active') {
        return {
            allowed: false,
            reason: 'Você não tem uma assinatura ativa. Contrate o plano Receptivo Growth para integrações CRM/API.',
            upgradePlan: 'rec_growth',
        };
    }
    if (!planInfo.limits.hasCrmApi) {
        const upgradePlan = suggestUpgradePlan(planInfo.plan);
        return {
            allowed: false,
            reason: `Integrações CRM e API não estão incluídas no plano ${planInfo.planTitle}. Faça upgrade para ${(0, plans_catalog_1.getPlanCatalogEntry)(upgradePlan).title}.`,
            upgradePlan,
        };
    }
    return { allowed: true };
}
async function canUseSSO(companiesId) {
    const planInfo = await getPlanInfo(companiesId);
    if (planInfo.status !== 'active') {
        return {
            allowed: false,
            reason: 'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
            upgradePlan: planInfo.limits.productLine === 'rec' ? 'rec_enterprise' : 'com_enterprise',
        };
    }
    if (!planInfo.limits.hasSSO) {
        const upgradePlan = planInfo.limits.productLine === 'rec' ? 'rec_enterprise' : 'com_enterprise';
        return {
            allowed: false,
            reason: `SSO está disponível apenas no plano Enterprise da linha ${planInfo.limits.productLine === 'rec' ? 'Receptiva' : 'Completa'}.`,
            upgradePlan,
        };
    }
    return { allowed: true };
}
async function canUseGovernance(companiesId) {
    const planInfo = await getPlanInfo(companiesId);
    if (planInfo.status !== 'active') {
        return {
            allowed: false,
            reason: 'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
            upgradePlan: planInfo.limits.productLine === 'rec' ? 'rec_enterprise' : 'com_enterprise',
        };
    }
    if (!planInfo.limits.hasGovernance) {
        const upgradePlan = planInfo.limits.productLine === 'rec' ? 'rec_enterprise' : 'com_enterprise';
        return {
            allowed: false,
            reason: `Governança avançada está disponível apenas no plano Enterprise da linha ${planInfo.limits.productLine === 'rec' ? 'Receptiva' : 'Completa'}.`,
            upgradePlan,
        };
    }
    return { allowed: true };
}
