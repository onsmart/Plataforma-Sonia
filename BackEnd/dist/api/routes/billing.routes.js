"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStripeWebhook = handleStripeWebhook;
const express_1 = __importDefault(require("express"));
const stripe_1 = __importDefault(require("stripe"));
const company_helper_1 = require("../../utils/company-helper");
const supabase_1 = require("../../lib/supabase");
const logger_1 = __importDefault(require("../../lib/logger"));
const auth_middleware_1 = require("../../middleware/auth.middleware");
const request_auth_1 = require("../../utils/request-auth");
const plans_catalog_1 = require("../../config/plans.catalog");
const stripe_subscription_sync_service_1 = require("../../services/billing/stripe-subscription-sync.service");
const subscription_billing_notify_service_1 = require("../../services/billing/subscription-billing-notify.service");
const plan_helper_1 = require("../../utils/plan-helper");
const usage_tracker_service_1 = require("../../services/usage-tracker.service");
const webhook_idempotency_service_1 = require("../../services/security/webhook-idempotency.service");
const router = express_1.default.Router();
// Inicializa o Stripe com a chave secreta do .env
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-02-25.clover',
});
/** Assinaturas apenas mensais — configure STRIPE_PRICE_REC_* no .env (aceita sufixo _MONTHLY legado). */
const STRIPE_REC_START = process.env.STRIPE_PRICE_REC_START?.trim() ||
    process.env.STRIPE_PRICE_REC_START_MONTHLY?.trim() ||
    process.env.STRIPE_PRICE_PRO_MONTHLY?.trim() ||
    process.env.STRIPE_PRICE_PRO?.trim() ||
    '';
const STRIPE_REC_GROWTH = process.env.STRIPE_PRICE_REC_GROWTH?.trim() ||
    process.env.STRIPE_PRICE_REC_GROWTH_MONTHLY?.trim() ||
    process.env.STRIPE_PRICE_PLUS_MONTHLY?.trim() ||
    process.env.STRIPE_PRICE_PLUS?.trim() ||
    '';
const PRICE_IDS = {
    price_rec_start: STRIPE_REC_START,
    price_rec_start_monthly: STRIPE_REC_START,
    price_rec_growth: STRIPE_REC_GROWTH,
    price_rec_growth_monthly: STRIPE_REC_GROWTH,
};
function isYearlyPriceKey(priceId) {
    return /yearly|_annual|_anual/i.test(priceId);
}
function inferPlanFromPriceIdentifier(priceId) {
    const normalized = String(priceId || '').toLowerCase();
    if (normalized.includes('rec_enterprise') || normalized.includes('rec-enterprise'))
        return 'rec_enterprise';
    if (normalized.includes('rec_growth') || normalized.includes('rec-growth'))
        return 'rec_growth';
    if (normalized.includes('rec_start') || normalized.includes('rec-start'))
        return 'rec_start';
    if (normalized.includes('com_enterprise') || normalized.includes('com-enterprise'))
        return 'com_enterprise';
    if (normalized.includes('com_growth') || normalized.includes('com-growth'))
        return 'com_growth';
    if (normalized.includes('com_start') || normalized.includes('com-start'))
        return 'com_start';
    return (0, plans_catalog_1.inferPlanIdFromStripePriceKey)(normalized);
}
/**
 * GET /billing/plans
 * Catálogo público dos 6 planos oficiais
 */
router.get('/plans', (_req, res) => {
    return res.json({ plans: (0, plans_catalog_1.getPlansCatalogForApi)() });
});
/**
 * GET /billing/usage
 * Uso atual (conversas distintas no mês + agentes) conforme plano ativo
 */
router.get('/usage', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, async (req, res) => {
    try {
        const userEmail = req.user?.email;
        if (!userEmail) {
            return res.status(401).json({ error: 'User email is required' });
        }
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(userEmail);
        if (!companiesId) {
            return res.status(403).json({ error: 'User does not belong to any company' });
        }
        const forceSync = req.query.sync === '1' || req.query.sync === 'true';
        let { data: subscriptionRow } = await supabase_1.supabase
            .from('tb_subscriptions')
            .select('plan, status, current_period_start, current_period_end, canceled_at, stripe_subscription_id, stripe_customer_id, created_at')
            .eq('companies_id', companiesId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (subscriptionRow?.stripe_subscription_id) {
            const syncedPatch = await (0, stripe_subscription_sync_service_1.syncCompanySubscriptionFromStripeIfNeeded)(stripe, companiesId, subscriptionRow, forceSync);
            if (syncedPatch) {
                subscriptionRow = { ...subscriptionRow, ...syncedPatch };
                (0, plan_helper_1.clearPlanInfoCache)(companiesId);
            }
        }
        const [conversationsUsed, agentsUsed] = await Promise.all([
            (0, usage_tracker_service_1.getCurrentMonthConversationCount)(companiesId),
            (0, usage_tracker_service_1.getActiveAgentCount)(companiesId),
        ]);
        const planInfo = await (0, plan_helper_1.getPlanInfo)(companiesId);
        const catalogPlan = (0, plans_catalog_1.normalizePlanId)(subscriptionRow?.plan);
        const hasPaidAccess = (0, plans_catalog_1.hasEffectivePaidAccess)(subscriptionRow || {});
        const contractedCatalog = (0, plans_catalog_1.getPlanCatalogEntry)(hasPaidAccess ? catalogPlan : plans_catalog_1.FREE_PLAN_ID);
        const usageLimitReached = !hasPaidAccess ||
            (planInfo.limits.conversations !== null &&
                conversationsUsed >= planInfo.limits.conversations);
        const billingSnapshot = (0, stripe_subscription_sync_service_1.buildBillingSnapshot)(subscriptionRow || {}, {
            usageLimitReached,
        });
        const periodEnded = (0, stripe_subscription_sync_service_1.isSubscriptionPeriodEnded)(billingSnapshot.current_period_end);
        const accessState = (0, stripe_subscription_sync_service_1.resolveSubscriptionAccessState)({
            has_paid_access: billingSnapshot.has_paid_access,
            cancel_at_period_end: billingSnapshot.cancel_at_period_end,
            has_stripe_subscription: billingSnapshot.has_stripe_subscription,
            current_period_end: billingSnapshot.current_period_end,
            catalog_plan: catalogPlan,
        });
        const subscriptionStatus = billingSnapshot.status;
        const canManageBilling = await (0, auth_middleware_1.userCanManageBilling)(userEmail);
        void (0, subscription_billing_notify_service_1.maybeNotifyLocalSubscriptionPeriodEnded)(companiesId).catch((err) => {
            logger_1.default.warn('[getBillingUsage] Falha ao verificar e-mail de fim de ciclo', {
                companiesId,
                error: err instanceof Error ? err.message : String(err),
            });
        });
        return res.json({
            plan: planInfo.plan,
            plan_code: contractedCatalog.code,
            plan_title: planInfo.planTitle,
            product_line: contractedCatalog.productLine,
            status: planInfo.status,
            subscription_status: subscriptionStatus,
            catalog_plan: hasPaidAccess ? catalogPlan : plans_catalog_1.FREE_PLAN_ID,
            effective_plan: planInfo.plan,
            gates_use_effective_plan: true,
            is_free_account: !billingSnapshot.has_paid_access,
            current_period_start: billingSnapshot.current_period_start,
            current_period_end: billingSnapshot.current_period_end,
            canceled_at: billingSnapshot.canceled_at,
            cancel_at_period_end: billingSnapshot.cancel_at_period_end,
            has_paid_access: billingSnapshot.has_paid_access,
            period_ended: periodEnded,
            access_state: accessState,
            has_stripe_subscription: billingSnapshot.has_stripe_subscription,
            can_manage_billing: canManageBilling,
            subscribed_at: subscriptionRow?.created_at || null,
            conversations_used: conversationsUsed,
            conversations_limit: planInfo.limits.conversations,
            usage_limit_reached: usageLimitReached,
            access_revoked_by_usage: billingSnapshot.cancel_at_period_end &&
                usageLimitReached &&
                !billingSnapshot.has_paid_access,
            volume_label: contractedCatalog.volumeLabel,
            agents_used: agentsUsed,
            agents_limit: planInfo.limits.agents,
            has_active_outbound: planInfo.limits.hasActiveOutbound,
            has_rag: planInfo.limits.hasRAG,
            has_governance: planInfo.limits.hasGovernance,
            has_sso: planInfo.limits.hasSSO,
            has_flows: planInfo.limits.hasFlows,
            has_crm_api: planInfo.limits.hasCrmApi,
        });
    }
    catch (error) {
        logger_1.default.error('[getBillingUsage] Erro:', error);
        return res.status(500).json({ error: 'Erro ao buscar uso', details: error.message });
    }
});
/**
 * Converte um nome amigável de priceId para o ID real do Stripe
 * Se já for um ID real (começa com price_ e tem formato correto), retorna como está
 */
function getRealPriceId(priceId) {
    // IDs reais do Stripe têm formato: price_ + caracteres alfanuméricos (geralmente 24+ caracteres)
    // Nomes amigáveis são como: price_pro_monthly, price_ent_yearly, etc.
    // Verifica se é um nome amigável conhecido primeiro
    if (PRICE_IDS.hasOwnProperty(priceId)) {
        const realPriceId = PRICE_IDS[priceId];
        if (!realPriceId || realPriceId.trim() === '') {
            throw new Error(`Price ID não configurado: ${priceId}. Configure a variável STRIPE_PRICE_${priceId.toUpperCase().replace('PRICE_', '')} no .env`);
        }
        return realPriceId;
    }
    // Se não está no mapeamento, verifica se é um ID real do Stripe
    // IDs reais têm formato: price_ seguido de caracteres alfanuméricos longos (sem underscores no meio)
    // Exemplo: price_1T7eYuBoK4Em3YqtnyBsFQle (24+ caracteres, sem underscores após price_)
    if (priceId.startsWith('price_')) {
        // Remove o prefixo "price_" e verifica o restante
        const afterPrefix = priceId.substring(6); // "price_".length = 6
        // IDs reais do Stripe têm pelo menos 24 caracteres após "price_"
        // e geralmente não têm underscores (são alfanuméricos contínuos)
        if (afterPrefix.length >= 24 && !afterPrefix.includes('_')) {
            return priceId; // É um ID real do Stripe
        }
    }
    // Se chegou aqui, não é nem um nome amigável conhecido nem um ID real válido
    throw new Error(`Price ID inválido: ${priceId}. Use um nome amigável (ex: price_pro_monthly) ou um ID real do Stripe (ex: price_1T7eYuBoK4Em3YqtnyBsFQle)`);
}
/**
 * POST /billing/checkout
 * Cria uma sessão de checkout no Stripe
 * Body: { priceId: string, email?: string }
 * ✅ Requer autenticação
 */
router.post('/checkout', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, async (req, res) => {
    try {
        logger_1.default.log('[Billing] Requisição de checkout recebida');
        const { priceId, email } = req.body;
        logger_1.default.log(`[Billing] Dados recebidos: priceId=${priceId}, email=${email || 'não fornecido'}`);
        if (!priceId) {
            logger_1.default.error('[Billing] priceId não fornecido');
            return res.status(400).json({ error: 'priceId is required' });
        }
        if (isYearlyPriceKey(priceId)) {
            return res.status(400).json({
                error: 'Assinaturas disponíveis apenas no ciclo mensal',
                code: 'BILLING_MONTHLY_ONLY',
            });
        }
        // Verificar se a chave do Stripe está configurada
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey || stripeKey.trim() === '') {
            logger_1.default.error('[Billing] STRIPE_SECRET_KEY não configurado no .env');
            return res.status(500).json({
                error: 'Stripe not configured',
                details: 'STRIPE_SECRET_KEY missing in environment variables'
            });
        }
        // Verificar se o Stripe foi inicializado corretamente
        if (!stripe) {
            logger_1.default.error('[Billing] Stripe não inicializado');
            return res.status(500).json({ error: 'Stripe initialization failed' });
        }
        const userEmail = (0, request_auth_1.getAuthenticatedEmail)(req);
        if (!userEmail) {
            logger_1.default.error('[Billing] Email do usuário não encontrado');
            return res.status(401).json({
                error: 'User email is required',
                details: 'Token de autenticação inválido ou email não fornecido'
            });
        }
        logger_1.default.log(`[Billing] Email obtido: ${userEmail}`);
        // Obter companiesId a partir do email
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(userEmail);
        if (!companiesId) {
            logger_1.default.warn(`[Billing] Nenhuma empresa encontrada para email: ${userEmail}`);
            return res.status(403).json({
                error: 'User does not belong to any company',
                details: `Nenhuma empresa associada ao email: ${userEmail}`
            });
        }
        logger_1.default.log(`[Billing] companiesId obtido: ${companiesId}`);
        // Obter origin do header ou usar padrão
        const origin = req.headers.origin || 'http://192.168.15.31:3000';
        // Converter nome amigável para ID real do Stripe
        let realPriceId;
        try {
            realPriceId = getRealPriceId(priceId);
            logger_1.default.log(`[Billing] PriceId convertido: ${priceId} -> ${realPriceId}`);
        }
        catch (priceError) {
            logger_1.default.error(`[Billing] Erro ao converter priceId: ${priceError.message}`);
            return res.status(400).json({
                error: priceError.message,
                details: 'Configure as variáveis de ambiente STRIPE_PRICE_* no .env do backend'
            });
        }
        const requestedPlan = (0, plans_catalog_1.normalizePlanId)(inferPlanFromPriceIdentifier(priceId));
        if (!(0, plans_catalog_1.isStripeCheckoutAvailable)(requestedPlan)) {
            logger_1.default.warn(`[Billing] Checkout bloqueado para plano ${requestedPlan}`);
            return res.status(400).json({
                error: 'Plano não disponível para checkout online',
                details: 'Este plano requer contato com nossa equipe comercial. Use o botão "Falar com vendas" ou entre em contato pelo site.',
                code: 'CHECKOUT_NOT_AVAILABLE',
                plan: requestedPlan,
            });
        }
        logger_1.default.log(`[Billing] Criando sessão de checkout para: ${userEmail} (companiesId: ${companiesId}, priceId: ${realPriceId}, plan: ${requestedPlan})`);
        // Criar sessão de checkout no Stripe
        try {
            const session = await stripe.checkout.sessions.create({
                mode: 'subscription',
                payment_method_types: ['card'],
                line_items: [{
                        price: realPriceId,
                        quantity: 1,
                    }],
                customer_email: userEmail,
                success_url: `${origin}/configuration?status=success&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${origin}/configuration?status=cancelled`,
                metadata: {
                    tenantId: companiesId,
                    user_email: userEmail,
                    plan: requestedPlan
                },
                subscription_data: {
                    metadata: {
                        tenantId: companiesId,
                        user_email: userEmail,
                        plan: requestedPlan
                    }
                }
            });
            if (!session.url) {
                logger_1.default.error('[Billing] Stripe retornou sessão sem URL');
                throw new Error('Stripe session URL não foi gerada');
            }
            logger_1.default.log(`[Billing] ✅ Sessão criada com sucesso: ${session.id}, URL: ${session.url}`);
            return res.json({ url: session.url });
        }
        catch (stripeError) {
            logger_1.default.error('[Billing] Erro ao criar sessão no Stripe:', stripeError);
            // Erros comuns do Stripe
            if (stripeError.type === 'StripeInvalidRequestError') {
                if (stripeError.message?.includes('No such price')) {
                    return res.status(400).json({
                        error: 'Price ID inválido',
                        details: `O priceId "${priceId}" não existe no Stripe. Verifique se está usando um ID real do painel do Stripe (ex: price_1PqW23...)`
                    });
                }
            }
            throw stripeError;
        }
    }
    catch (error) {
        logger_1.default.error('[Billing] Erro no Checkout:', error);
        const errorMessage = error.message || 'Checkout Failed';
        const errorDetails = process.env.NODE_ENV === 'development'
            ? { stack: error.stack, fullError: error }
            : undefined;
        return res.status(500).json({
            error: errorMessage,
            details: errorDetails
        });
    }
});
/**
 * GET /billing/subscription
 * Retorna informações da assinatura atual do usuário
 * ✅ Requer autenticação e ser admin
 */
router.get('/subscription', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const userEmail = (0, request_auth_1.getAuthenticatedEmail)(req);
        if (!userEmail) {
            return res.status(401).json({ error: 'User email is required' });
        }
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(userEmail);
        if (!companiesId) {
            return res.status(403).json({ error: 'User does not belong to any company' });
        }
        // Buscar subscription
        const { data: subscription, error } = await supabase_1.supabase
            .from('tb_subscriptions')
            .select('plan, status, current_period_end')
            .eq('companies_id', companiesId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) {
            logger_1.default.warn(`[getSubscription] Erro ao buscar subscription: ${error.message}`);
        }
        if (!subscription || !(0, plans_catalog_1.hasEffectivePaidAccess)(subscription)) {
            const free = (0, plans_catalog_1.getFreePlanDisplay)();
            return res.json({
                plan: plans_catalog_1.FREE_PLAN_ID,
                plan_code: free.code,
                plan_title: free.title,
                product_line: free.productLine,
                status: 'inactive',
                current_period_end: subscription?.current_period_end || null,
            });
        }
        const plan = (0, plans_catalog_1.normalizePlanId)(subscription.plan);
        const catalog = (0, plans_catalog_1.getPlanCatalogEntry)(plan);
        return res.json({
            plan,
            plan_code: catalog.code,
            plan_title: catalog.title,
            product_line: catalog.productLine,
            status: 'active',
            current_period_end: subscription.current_period_end || null,
        });
    }
    catch (error) {
        logger_1.default.error('[getSubscription] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao buscar assinatura',
            details: error.message
        });
    }
});
/**
 * GET /billing/export
 * Exporta dados de uso e billing em formato CSV
 * Query: email (opcional, pode vir do header x-user-email), startDate, endDate
 * ✅ Requer autenticação e ser admin
 */
router.get('/export', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const userEmail = (0, request_auth_1.getAuthenticatedEmail)(req);
        if (!userEmail) {
            return res.status(401).json({
                error: 'User email is required',
                details: 'Token de autenticação inválido ou email não fornecido'
            });
        }
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(userEmail);
        if (!companiesId) {
            return res.status(403).json({ error: 'User does not belong to any company' });
        }
        // Parse dates (opcional)
        const startDate = req.query.startDate
            ? new Date(req.query.startDate)
            : new Date(new Date().getFullYear(), 0, 1); // Início do ano atual (buscar mais dados)
        const endDate = req.query.endDate
            ? new Date(req.query.endDate)
            : new Date(); // Hoje
        // Buscar métricas de uso (buscar todos os meses disponíveis se não houver filtro específico)
        let usageQuery = supabase_1.supabase
            .from('tb_usage_metrics')
            .select('*')
            .eq('companies_id', companiesId)
            .order('month_start', { ascending: true });
        // Aplicar filtros de data apenas se fornecidos explicitamente
        if (req.query.startDate) {
            usageQuery = usageQuery.gte('month_start', startDate.toISOString().split('T')[0]);
        }
        if (req.query.endDate) {
            usageQuery = usageQuery.lte('month_start', endDate.toISOString().split('T')[0]);
        }
        const { data: usageMetrics, error: usageError } = await usageQuery;
        if (usageError) {
            logger_1.default.warn(`[exportBilling] Erro ao buscar métricas: ${usageError.message}`);
            // Se a tabela não existe, usageError.code será 'PGRST116' ou similar
            if (usageError.code === '42P01') {
                logger_1.default.error('[exportBilling] ⚠️ Tabela tb_usage_metrics não existe! Execute o SQL: BackEnd/database/CRIAR_TABELA_USAGE_METRICS.sql');
            }
        }
        logger_1.default.log(`[exportBilling] Métricas encontradas: ${usageMetrics?.length || 0} registros`);
        // Buscar subscription
        const { data: subscription, error: subError } = await supabase_1.supabase
            .from('tb_subscriptions')
            .select('*')
            .eq('companies_id', companiesId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (subError) {
            logger_1.default.warn(`[exportBilling] Erro ao buscar subscription: ${subError.message}`);
        }
        // Gerar CSV
        const csvRows = [];
        // Header
        csvRows.push('Tipo,Período,Valor,Detalhes');
        // Subscription info
        if (subscription) {
            csvRows.push(`Subscription,${subscription.created_at},${subscription.plan},Status: ${subscription.status}`);
            if (subscription.current_period_end) {
                csvRows.push(`Subscription Period End,${subscription.current_period_end},,`);
            }
        }
        // Usage metrics
        if (usageMetrics && usageMetrics.length > 0) {
            csvRows.push(''); // Linha em branco
            csvRows.push('Métricas de Uso Mensal');
            csvRows.push('Mês,Agentes,Mensagens');
            for (const metric of usageMetrics) {
                csvRows.push(`${metric.month_start},${metric.agent_count},${metric.message_count}`);
            }
        }
        else {
            csvRows.push('');
            csvRows.push('Métricas de Uso Mensal');
            csvRows.push('Mês,Agentes,Mensagens');
            csvRows.push('Nenhum dado disponível,,');
        }
        const csvContent = csvRows.join('\n');
        // Enviar como download
        const filename = `billing-export-${companiesId}-${new Date().toISOString().split('T')[0]}.csv`;
        // Adicionar BOM para Excel reconhecer UTF-8 (no início do conteúdo)
        const csvWithBOM = '\ufeff' + csvContent;
        // Configurar headers antes de enviar
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-cache');
        // Enviar resposta uma única vez
        res.send(csvWithBOM);
        logger_1.default.log(`[exportBilling] ✅ CSV exportado para ${userEmail}`);
    }
    catch (error) {
        logger_1.default.error('[exportBilling] Erro:', error);
        // Verificar se a resposta já foi enviada
        if (!res.headersSent) {
            return res.status(500).json({
                error: 'Erro ao exportar dados',
                details: error.message
            });
        }
        // Se já foi enviada, apenas logar o erro
    }
});
/**
 * POST /billing/portal
 * Cria uma sessão do portal de gerenciamento do Stripe
 * Body: { email?: string }
 * ✅ Requer autenticação e ser admin
 */
router.post('/portal', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { email } = req.body;
        if (!stripe || !process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({ error: 'Stripe not configured' });
        }
        const userEmail = (0, request_auth_1.getAuthenticatedEmail)(req);
        if (!userEmail) {
            return res.status(401).json({
                error: 'User email is required',
                details: 'Token de autenticação inválido ou email não fornecido'
            });
        }
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(userEmail);
        if (!companiesId) {
            return res.status(403).json({ error: 'User does not belong to any company' });
        }
        // Buscar subscription no banco para obter o customer ID do Stripe
        // Por enquanto, vamos buscar pela subscription mais recente do tenant
        // TODO: Criar tabela tb_subscriptions se não existir
        const { data: subscription, error: subError } = await supabase_1.supabase
            .from('tb_subscriptions')
            .select('stripe_customer_id, stripe_subscription_id')
            .eq('companies_id', companiesId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (subError || !subscription?.stripe_customer_id) {
            logger_1.default.warn(`[Billing] Nenhuma subscription encontrada para companiesId: ${companiesId}`);
            return res.status(404).json({
                error: 'No active billing account found. Please upgrade first.',
                error_code: 'NO_SUBSCRIPTION'
            });
        }
        const origin = req.headers.origin || 'http://192.168.15.31:3000';
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: subscription.stripe_customer_id,
            return_url: `${origin}/configuration`,
        });
        return res.json({ url: portalSession.url });
    }
    catch (error) {
        logger_1.default.error('[Billing] Erro no Portal:', error);
        return res.status(500).json({
            error: error.message || 'Portal Failed',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});
async function buildBillingActionResponse(companiesId, stripeSubscriptionId, patch, extra) {
    const conversationsUsed = await (0, usage_tracker_service_1.getCurrentMonthConversationCount)(companiesId);
    const contractedCatalog = (0, plans_catalog_1.getPlanCatalogEntry)((0, plans_catalog_1.normalizePlanId)(patch.plan));
    const usageLimitReached = contractedCatalog.monthlyConversations !== null &&
        conversationsUsed >= contractedCatalog.monthlyConversations;
    const snapshot = (0, stripe_subscription_sync_service_1.buildBillingSnapshot)({
        ...patch,
        stripe_subscription_id: stripeSubscriptionId,
    }, { usageLimitReached });
    return {
        ...extra,
        ...snapshot,
        usage_limit_reached: usageLimitReached,
        access_revoked_by_usage: snapshot.cancel_at_period_end && usageLimitReached && !snapshot.has_paid_access,
    };
}
/**
 * POST /billing/cancel-renewal
 * Agenda cancelamento ao fim do ciclo pago (mantém benefícios até current_period_end).
 * Sempre atualiza o Stripe primeiro; o banco reflete a resposta confirmada do Stripe.
 */
router.post('/cancel-renewal', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        if (!stripe || !process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({ error: 'Stripe not configured' });
        }
        const userEmail = req.user?.email;
        if (!userEmail) {
            return res.status(401).json({ error: 'User email is required' });
        }
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(userEmail);
        if (!companiesId) {
            return res.status(403).json({ error: 'User does not belong to any company' });
        }
        const { stripeSubscriptionId } = await (0, stripe_subscription_sync_service_1.loadStripeSubscriptionForCompany)(companiesId);
        const { subscription, patch, stripe_sync } = await (0, stripe_subscription_sync_service_1.mutateCompanyStripeSubscription)(stripe, companiesId, () => ({ cancel_at_period_end: true }));
        if (!subscription.cancel_at_period_end) {
            return res.status(502).json({
                error: 'O Stripe não confirmou o cancelamento agendado. Tente novamente.',
                code: 'STRIPE_CANCEL_NOT_CONFIRMED',
                stripe_sync,
            });
        }
        return res.json(await buildBillingActionResponse(companiesId, stripeSubscriptionId, patch, {
            success: true,
            message: 'Assinatura cancelada no Stripe. Você mantém os benefícios até o fim do ciclo ou até esgotar os atendimentos do mês.',
            stripe_sync: { ...stripe_sync, stripe_updated: true },
        }));
    }
    catch (error) {
        const status = error.status || 500;
        logger_1.default.error('[Billing] Erro ao cancelar renovação:', error);
        return res.status(status).json({
            error: error.message || 'Erro ao cancelar renovação',
            code: error.code,
        });
    }
});
/**
 * POST /billing/reactivate-renewal
 * Desfaz cancelamento agendado (continua renovando automaticamente).
 * Sempre atualiza o Stripe primeiro.
 */
router.post('/reactivate-renewal', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        if (!stripe || !process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({ error: 'Stripe not configured' });
        }
        const userEmail = req.user?.email;
        if (!userEmail) {
            return res.status(401).json({ error: 'User email is required' });
        }
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(userEmail);
        if (!companiesId) {
            return res.status(403).json({ error: 'User does not belong to any company' });
        }
        const { stripeSubscriptionId } = await (0, stripe_subscription_sync_service_1.loadStripeSubscriptionForCompany)(companiesId);
        const { subscription, patch, stripe_sync } = await (0, stripe_subscription_sync_service_1.mutateCompanyStripeSubscription)(stripe, companiesId, () => ({ cancel_at_period_end: false }));
        if (subscription.cancel_at_period_end) {
            return res.status(502).json({
                error: 'O Stripe não confirmou a reativação da renovação. Tente novamente.',
                code: 'STRIPE_REACTIVATE_NOT_CONFIRMED',
                stripe_sync,
            });
        }
        return res.json(await buildBillingActionResponse(companiesId, stripeSubscriptionId, patch, {
            success: true,
            message: 'Renovação automática reativada no Stripe com sucesso.',
            stripe_sync: { ...stripe_sync, stripe_updated: true },
        }));
    }
    catch (error) {
        const status = error.status || 500;
        logger_1.default.error('[Billing] Erro ao reativar renovação:', error);
        return res.status(status).json({
            error: error.message || 'Erro ao reativar renovação',
            code: error.code,
        });
    }
});
/**
 * Handler do webhook do Stripe
 * Exportado para ser usado diretamente no index.ts (antes do express.json())
 */
async function handleStripeWebhook(req, res) {
    // ✅ LOG INICIAL para debug
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔔 [Billing Webhook] Requisição recebida!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📥 Headers:', {
        'stripe-signature': req.headers['stripe-signature'] ? 'presente' : 'ausente',
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent']?.substring(0, 50)
    });
    console.log('📦 Body type:', typeof req.body);
    console.log('📦 Body length:', req.body?.length || 0);
    console.log('📦 Body is Buffer?', Buffer.isBuffer(req.body));
    const sigHeader = req.headers['stripe-signature'];
    const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('❌ [Billing Webhook] STRIPE_WEBHOOK_SECRET não configurado');
        logger_1.default.error('[Billing] STRIPE_WEBHOOK_SECRET não configurado');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    let event;
    try {
        // Verificar assinatura do webhook
        console.log('🔍 Verificando assinatura do webhook...');
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        console.log('✅ Assinatura verificada com sucesso!');
        console.log('📋 Tipo do evento:', event.type);
    }
    catch (err) {
        console.error('❌ [Billing Webhook] Erro ao verificar assinatura:', err.message);
        console.error('❌ Detalhes do erro:', {
            message: err.message,
            type: err.type,
            sig: sig ? (typeof sig === 'string' ? sig.substring(0, 20) + '...' : 'array') : 'ausente',
            bodyLength: req.body?.length || 0
        });
        logger_1.default.error(`[Billing] Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    console.log(`✅ [Billing] Webhook recebido: ${event.type}`);
    logger_1.default.log(`[Billing] Webhook recebido: ${event.type}`);
    if ((0, webhook_idempotency_service_1.isDuplicateWebhookEvent)('stripe', event.id)) {
        return res.json({ received: true, duplicate: true });
    }
    (0, webhook_idempotency_service_1.markWebhookEventProcessed)('stripe', event.id);
    try {
        // Processar diferentes tipos de eventos
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const tenantId = session.metadata?.tenantId;
                const userEmail = session.metadata?.user_email || session.customer_email;
                if (!tenantId) {
                    logger_1.default.warn('[Billing] checkout.session.completed sem tenantId no metadata');
                    break;
                }
                const amount = session.amount_total || 0;
                const plan = session.metadata?.plan
                    ? (0, plans_catalog_1.normalizePlanId)(session.metadata.plan)
                    : amount >= 49900
                        ? 'com_enterprise'
                        : amount >= 4900
                            ? 'com_growth'
                            : 'rec_start';
                let stripeSubscription = null;
                if (session.subscription) {
                    stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);
                }
                logger_1.default.log(`[Billing] Processando pagamento: ${userEmail} -> ${plan} (tenantId: ${tenantId})`);
                const subscriptionPatch = (0, stripe_subscription_sync_service_1.buildCheckoutSubscriptionPatch)({
                    tenantId,
                    session,
                    subscription: stripeSubscription,
                    planOverride: plan,
                });
                const { companies_id, ...patch } = subscriptionPatch;
                try {
                    await (0, stripe_subscription_sync_service_1.upsertCompanySubscription)(companies_id, patch);
                    logger_1.default.log(`[Billing] ✅ Subscription sincronizada após checkout (tenantId: ${tenantId})`);
                }
                catch (upsertError) {
                    logger_1.default.error('[Billing] Erro ao persistir subscription pós-checkout:', upsertError);
                }
                break;
            }
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                const tenantId = await (0, stripe_subscription_sync_service_1.resolveTenantIdFromStripeSubscription)(stripe, subscription);
                if (!tenantId) {
                    logger_1.default.warn(`[Billing] subscription.updated sem tenantId (sub ${subscription.id})`);
                    break;
                }
                const patch = (0, stripe_subscription_sync_service_1.buildSubscriptionPatchFromStripe)(subscription);
                try {
                    await (0, stripe_subscription_sync_service_1.upsertCompanySubscription)(tenantId, patch);
                    (0, plan_helper_1.clearPlanInfoCache)(tenantId);
                    logger_1.default.log(`[Billing] ✅ Subscription atualizada via webhook: ${subscription.id} cancel_at_period_end=${subscription.cancel_at_period_end}`);
                }
                catch (updateError) {
                    logger_1.default.error('[Billing] Erro ao atualizar subscription:', updateError);
                }
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const tenantId = await (0, stripe_subscription_sync_service_1.resolveTenantIdFromStripeSubscription)(stripe, subscription);
                if (!tenantId) {
                    logger_1.default.warn(`[Billing] subscription.deleted sem tenantId (sub ${subscription.id})`);
                    break;
                }
                try {
                    const periodEndUnix = (0, stripe_subscription_sync_service_1.getSubscriptionBillingPeriodUnix)(subscription).current_period_end;
                    const periodStillActive = periodEndUnix != null && periodEndUnix * 1000 > Date.now();
                    if (periodStillActive) {
                        const patch = (0, stripe_subscription_sync_service_1.buildSubscriptionPatchFromStripe)(subscription);
                        await (0, stripe_subscription_sync_service_1.upsertCompanySubscription)(tenantId, {
                            ...patch,
                            status: 'canceled',
                        });
                        logger_1.default.log(`[Billing] Subscription ${subscription.id} cancelada; acesso até fim do ciclo`);
                    }
                    else {
                        await (0, stripe_subscription_sync_service_1.applyStripeSubscriptionEnd)(tenantId);
                        logger_1.default.log(`[Billing] ✅ Subscription encerrada (plano free): ${subscription.id}`);
                        void (0, subscription_billing_notify_service_1.notifySubscriptionEndedFromStripe)(stripe, subscription, (0, subscription_billing_notify_service_1.inferSubscriptionEndReason)(subscription), event.id).catch((err) => {
                            logger_1.default.warn('[Billing] Falha ao enviar e-mail de encerramento', {
                                subscriptionId: subscription.id,
                                error: err instanceof Error ? err.message : String(err),
                            });
                        });
                    }
                }
                catch (updateError) {
                    logger_1.default.error('[Billing] Erro ao encerrar subscription:', updateError);
                }
                break;
            }
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                const tenantId = invoice.subscription_details?.metadata?.tenantId ||
                    (invoice.subscription ?
                        (await stripe.subscriptions.retrieve(invoice.subscription)).metadata?.tenantId
                        : null);
                if (tenantId) {
                    logger_1.default.warn(`[Billing] ⚠️ Pagamento falhou para tenantId: ${tenantId} (e-mail via Stripe Customer emails)`);
                }
                break;
            }
            default:
                logger_1.default.log(`[Billing] Evento não processado: ${event.type}`);
        }
        res.json({ received: true });
    }
    catch (error) {
        logger_1.default.error('[Billing] Erro ao processar webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
}
exports.default = router;
