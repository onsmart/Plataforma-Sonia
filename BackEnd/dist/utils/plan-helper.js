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
exports.getPlanInfo = getPlanInfo;
exports.canCreateAgent = canCreateAgent;
exports.canActivateAgent = canActivateAgent;
exports.canSendMessage = canSendMessage;
exports.canUseRAG = canUseRAG;
exports.canUseSSO = canUseSSO;
exports.canUseGovernance = canUseGovernance;
const supabase_1 = require("../lib/supabase");
const logger_1 = __importDefault(require("../lib/logger"));
// Cache em memória para plan info
const planInfoCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
/**
 * Obtém informações do plano da empresa (com cache)
 */
async function getPlanInfo(companiesId) {
    try {
        // Verificar cache
        const cached = planInfoCache.get(companiesId);
        if (cached && cached.expiresAt > Date.now()) {
            logger_1.default.log(`[getPlanInfo] ✅ Cache hit para companies_id: ${companiesId}`);
            return cached.info;
        }
        // Buscar subscription no banco (apenas ativas ou em trial)
        // Status válidos: 'active', 'trialing' (período de teste)
        // Status inválidos: 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid'
        const { data: subscription, error } = await supabase_1.supabase
            .from('tb_subscriptions')
            .select('plan, status')
            .eq('companies_id', companiesId)
            .in('status', ['active', 'trialing']) // Apenas status válidos
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) {
            logger_1.default.warn(`[getPlanInfo] Erro ao buscar subscription: ${error.message}`);
        }
        // Se não tem subscription ativa, assume starter
        const plan = subscription?.plan || 'starter';
        // Status 'trialing' também é considerado ativo para permitir uso durante período de teste
        const status = (subscription?.status === 'active' || subscription?.status === 'trialing')
            ? 'active'
            : 'inactive';
        // Definir limites baseado no plano
        const limits = getPlanLimits(plan);
        const planInfo = {
            plan,
            status,
            limits
        };
        // Salvar no cache
        planInfoCache.set(companiesId, {
            info: planInfo,
            expiresAt: Date.now() + CACHE_TTL_MS
        });
        return planInfo;
    }
    catch (err) {
        logger_1.default.error('[getPlanInfo] Erro:', err);
        // Em caso de erro, retorna starter como padrão
        return {
            plan: 'starter',
            status: 'inactive',
            limits: getPlanLimits('starter')
        };
    }
}
/**
 * Retorna os limites de cada plano
 */
function getPlanLimits(plan) {
    switch (plan) {
        case 'starter':
            return {
                agents: 1,
                messages: 50,
                hasRAG: false,
                hasSSO: false,
                hasGovernance: false,
                hasCustomDeployment: false
            };
        case 'pro':
            return {
                agents: 5,
                messages: null, // unlimited
                hasRAG: true,
                hasSSO: false,
                hasGovernance: false,
                hasCustomDeployment: false
            };
        case 'enterprise':
            return {
                agents: null, // unlimited
                messages: null, // unlimited
                hasRAG: true,
                hasSSO: true,
                hasGovernance: true,
                hasCustomDeployment: true
            };
        default:
            return getPlanLimits('starter');
    }
}
/**
 * Verifica se a empresa pode criar mais agentes
 * Valida baseado em agentes ATIVOS (status_id = 1)
 */
async function canCreateAgent(companiesId) {
    const planInfo = await getPlanInfo(companiesId);
    if (planInfo.status !== 'active') {
        return {
            allowed: false,
            reason: 'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
            upgradePlan: 'pro'
        };
    }
    const limit = planInfo.limits.agents;
    // Se não tem limite (unlimited), permite
    if (limit === null) {
        return { allowed: true };
    }
    // ✅ MUDANÇA: Usar getActiveAgentCount ao invés de currentAgentCount
    const { getActiveAgentCount } = await Promise.resolve().then(() => __importStar(require('../services/usage-tracker.service')));
    const activeCount = await getActiveAgentCount(companiesId);
    // Verifica se já atingiu o limite de agentes ATIVOS
    if (activeCount >= limit) {
        const upgradePlan = planInfo.plan === 'starter' ? 'pro' : 'enterprise';
        return {
            allowed: false,
            reason: `Você já tem ${activeCount} agente(s) ativo(s). O plano ${planInfo.plan === 'starter' ? 'Starter' : 'Pro'} permite apenas ${limit} agente(s) ativo(s) simultaneamente. Para criar mais agentes, faça upgrade para o plano ${upgradePlan === 'pro' ? 'Pro' : 'Enterprise'}.`,
            upgradePlan
        };
    }
    return { allowed: true };
}
/**
 * Verifica se a empresa pode ativar mais um agente
 * Valida se já existe agente ativo antes de ativar outro
 */
async function canActivateAgent(companiesId, agentIdToActivate) {
    const planInfo = await getPlanInfo(companiesId);
    if (planInfo.status !== 'active') {
        return {
            allowed: false,
            reason: 'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
            upgradePlan: 'pro'
        };
    }
    const limit = planInfo.limits.agents;
    // Enterprise tem limite ilimitado
    if (limit === null) {
        return { allowed: true };
    }
    // Contar agentes ativos (exceto o que está sendo ativado)
    const { getActiveAgentCount } = await Promise.resolve().then(() => __importStar(require('../services/usage-tracker.service')));
    const currentActiveCount = await getActiveAgentCount(companiesId);
    // Se o agente que está sendo ativado já está ativo, não conta
    const { data: agent } = await supabase_1.supabase
        .from('tb_agents')
        .select('status_id')
        .eq('id', agentIdToActivate)
        .eq('companies_id', companiesId)
        .maybeSingle();
    // Se já está ativo, permite (não vai aumentar o count)
    if (agent?.status_id === 1) {
        return { allowed: true };
    }
    // Verifica se já atingiu o limite
    if (currentActiveCount >= limit) {
        const upgradePlan = planInfo.plan === 'starter' ? 'pro' : 'enterprise';
        return {
            allowed: false,
            reason: `Você já tem ${currentActiveCount} agente(s) ativo(s). O plano ${planInfo.plan === 'starter' ? 'Starter' : 'Pro'} permite apenas ${limit} agente(s) ativo(s) simultaneamente. Para ativar mais agentes, faça upgrade para o plano ${upgradePlan === 'pro' ? 'Pro' : 'Enterprise'}.`,
            upgradePlan
        };
    }
    return { allowed: true };
}
/**
 * Verifica se a empresa pode enviar mais mensagens
 */
async function canSendMessage(companiesId, currentMessageCount) {
    const planInfo = await getPlanInfo(companiesId);
    if (planInfo.status !== 'active') {
        return {
            allowed: false,
            reason: 'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
            upgradePlan: 'pro'
        };
    }
    const limit = planInfo.limits.messages;
    // Se não tem limite (unlimited), permite
    if (limit === null) {
        return { allowed: true };
    }
    // Verifica se já atingiu o limite
    if (currentMessageCount >= limit) {
        return {
            allowed: false,
            reason: `Você atingiu o limite de ${limit} mensagens/mês do seu plano atual. Para enviar mensagens ilimitadas, faça upgrade para o plano Pro.`,
            upgradePlan: 'pro'
        };
    }
    return { allowed: true };
}
/**
 * Verifica se a empresa pode usar RAG (Knowledge Base)
 */
async function canUseRAG(companiesId) {
    const planInfo = await getPlanInfo(companiesId);
    if (planInfo.status !== 'active') {
        return {
            allowed: false,
            reason: 'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
            upgradePlan: 'pro'
        };
    }
    if (!planInfo.limits.hasRAG) {
        return {
            allowed: false,
            reason: 'A funcionalidade RAG Knowledge Base está disponível apenas no plano Pro ou superior. Faça upgrade do seu plano para acessar esta funcionalidade.',
            upgradePlan: 'pro'
        };
    }
    return { allowed: true };
}
/**
 * Verifica se a empresa pode usar SSO
 */
async function canUseSSO(companiesId) {
    const planInfo = await getPlanInfo(companiesId);
    if (planInfo.status !== 'active') {
        return {
            allowed: false,
            reason: 'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
            upgradePlan: 'enterprise'
        };
    }
    if (!planInfo.limits.hasSSO) {
        return {
            allowed: false,
            reason: 'A funcionalidade SSO & Governance está disponível apenas no plano Enterprise. Entre em contato com nossa equipe de vendas para fazer upgrade.',
            upgradePlan: 'enterprise'
        };
    }
    return { allowed: true };
}
/**
 * Verifica se a empresa pode usar Governance
 */
async function canUseGovernance(companiesId) {
    const planInfo = await getPlanInfo(companiesId);
    if (planInfo.status !== 'active') {
        return {
            allowed: false,
            reason: 'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
            upgradePlan: 'enterprise'
        };
    }
    if (!planInfo.limits.hasGovernance) {
        return {
            allowed: false,
            reason: 'A funcionalidade Governance está disponível apenas no plano Enterprise. Entre em contato com nossa equipe de vendas para fazer upgrade.',
            upgradePlan: 'enterprise'
        };
    }
    return { allowed: true };
}
