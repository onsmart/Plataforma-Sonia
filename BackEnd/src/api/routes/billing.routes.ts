import express from 'express'
import Stripe from 'stripe'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { requireAuth, requireAdmin, userCanManageBilling } from '../../middleware/auth.middleware'
import {
  inferPlanIdFromStripePriceKey,
  normalizePlanId,
  getPlanCatalogEntry,
  getFreePlanDisplay,
  hasEffectivePaidAccess,
  isPaidSubscriptionStatus,
  isStripeCheckoutAvailable,
  getPlansCatalogForApi,
  FREE_PLAN_ID,
  type PlanId,
} from '../../config/plans.catalog'
import {
  applyStripeSubscriptionEnd,
  buildBillingSnapshot,
  buildCheckoutSubscriptionPatch,
  buildSubscriptionPatchFromStripe,
  getSubscriptionBillingPeriodUnix,
  syncCompanySubscriptionFromStripeIfNeeded,
  upsertCompanySubscription,
} from '../../services/billing/stripe-subscription-sync.service'
import { clearPlanInfoCache, getPlanInfo } from '../../utils/plan-helper'
import { getActiveAgentCount, getCurrentMonthConversationCount } from '../../services/usage-tracker.service'

const router = express.Router()

// Inicializa o Stripe com a chave secreta do .env
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-02-25.clover' as any,
})

/** Assinaturas apenas mensais — configure STRIPE_PRICE_REC_* no .env (aceita sufixo _MONTHLY legado). */
const STRIPE_REC_START =
    process.env.STRIPE_PRICE_REC_START?.trim() ||
    process.env.STRIPE_PRICE_REC_START_MONTHLY?.trim() ||
    process.env.STRIPE_PRICE_PRO_MONTHLY?.trim() ||
    process.env.STRIPE_PRICE_PRO?.trim() ||
    ''
const STRIPE_REC_GROWTH =
    process.env.STRIPE_PRICE_REC_GROWTH?.trim() ||
    process.env.STRIPE_PRICE_REC_GROWTH_MONTHLY?.trim() ||
    process.env.STRIPE_PRICE_PLUS_MONTHLY?.trim() ||
    process.env.STRIPE_PRICE_PLUS?.trim() ||
    ''

const PRICE_IDS: Record<string, string> = {
    price_rec_start: STRIPE_REC_START,
    price_rec_start_monthly: STRIPE_REC_START,
    price_rec_growth: STRIPE_REC_GROWTH,
    price_rec_growth_monthly: STRIPE_REC_GROWTH,
}

function isYearlyPriceKey(priceId: string): boolean {
    return /yearly|_annual|_anual/i.test(priceId)
}

function inferPlanFromPriceIdentifier(priceId?: string | null): string {
    const normalized = String(priceId || '').toLowerCase()
    if (normalized.includes('rec_enterprise') || normalized.includes('rec-enterprise')) return 'rec_enterprise'
    if (normalized.includes('rec_growth') || normalized.includes('rec-growth')) return 'rec_growth'
    if (normalized.includes('rec_start') || normalized.includes('rec-start')) return 'rec_start'
    if (normalized.includes('com_enterprise') || normalized.includes('com-enterprise')) return 'com_enterprise'
    if (normalized.includes('com_growth') || normalized.includes('com-growth')) return 'com_growth'
    if (normalized.includes('com_start') || normalized.includes('com-start')) return 'com_start'
    return inferPlanIdFromStripePriceKey(normalized)
}

/**
 * GET /billing/plans
 * Catálogo público dos 6 planos oficiais
 */
router.get('/plans', (_req, res) => {
    return res.json({ plans: getPlansCatalogForApi() })
})

/**
 * GET /billing/usage
 * Uso atual (conversas distintas no mês + agentes) conforme plano ativo
 */
router.get('/usage', requireAuth, async (req, res) => {
    try {
        const userEmail = (req as any).user?.email as string | undefined
        if (!userEmail) {
            return res.status(401).json({ error: 'User email is required' })
        }

        const companiesId = await getCompanyIdByEmail(userEmail)
        if (!companiesId) {
            return res.status(403).json({ error: 'User does not belong to any company' })
        }

        const forceSync = req.query.sync === '1' || req.query.sync === 'true'

        let { data: subscriptionRow } = await supabase
            .from('tb_subscriptions')
            .select(
                'plan, status, current_period_start, current_period_end, canceled_at, stripe_subscription_id, stripe_customer_id, created_at'
            )
            .eq('companies_id', companiesId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (subscriptionRow?.stripe_subscription_id) {
            const syncedPatch = await syncCompanySubscriptionFromStripeIfNeeded(
                stripe,
                companiesId,
                subscriptionRow,
                forceSync
            )
            if (syncedPatch) {
                subscriptionRow = { ...subscriptionRow, ...syncedPatch }
                clearPlanInfoCache(companiesId)
            }
        }

        const [conversationsUsed, agentsUsed] = await Promise.all([
            getCurrentMonthConversationCount(companiesId),
            getActiveAgentCount(companiesId),
        ])
        const catalogPlan = normalizePlanId(subscriptionRow?.plan)
        const contractedCatalog = getPlanCatalogEntry(catalogPlan)
        const usageLimitReached =
            contractedCatalog.monthlyConversations !== null &&
            conversationsUsed >= contractedCatalog.monthlyConversations
        const billingSnapshot = buildBillingSnapshot(subscriptionRow || {}, {
            usageLimitReached,
        })
        const planInfo = await getPlanInfo(companiesId)
        const effectiveCatalog = getPlanCatalogEntry(planInfo.plan)
        const subscriptionStatus = billingSnapshot.status
        const canManageBilling = await userCanManageBilling(userEmail)

        return res.json({
            plan: planInfo.plan,
            plan_code: effectiveCatalog.code,
            plan_title: effectiveCatalog.title,
            product_line: effectiveCatalog.productLine,
            status: planInfo.status,
            subscription_status: subscriptionStatus,
            catalog_plan: catalogPlan,
            effective_plan: planInfo.plan,
            gates_use_effective_plan: true,
            current_period_start: billingSnapshot.current_period_start,
            current_period_end: billingSnapshot.current_period_end,
            canceled_at: billingSnapshot.canceled_at,
            cancel_at_period_end: billingSnapshot.cancel_at_period_end,
            has_paid_access: billingSnapshot.has_paid_access,
            has_stripe_subscription: billingSnapshot.has_stripe_subscription,
            can_manage_billing: canManageBilling,
            subscribed_at: subscriptionRow?.created_at || null,
            conversations_used: conversationsUsed,
            conversations_limit: contractedCatalog.monthlyConversations,
            usage_limit_reached: usageLimitReached,
            access_revoked_by_usage:
                billingSnapshot.cancel_at_period_end &&
                usageLimitReached &&
                !billingSnapshot.has_paid_access,
            volume_label: contractedCatalog.volumeLabel,
            agents_used: agentsUsed,
            agents_limit: planInfo.limits.agents,
            has_active_outbound: planInfo.limits.hasActiveOutbound,
            has_rag: planInfo.limits.hasRAG,
            has_governance: planInfo.limits.hasGovernance,
            has_sso: planInfo.limits.hasSSO,
        })
    } catch (error: any) {
        logger.error('[getBillingUsage] Erro:', error)
        return res.status(500).json({ error: 'Erro ao buscar uso', details: error.message })
    }
})

/**
 * Converte um nome amigável de priceId para o ID real do Stripe
 * Se já for um ID real (começa com price_ e tem formato correto), retorna como está
 */
function getRealPriceId(priceId: string): string {
    // IDs reais do Stripe têm formato: price_ + caracteres alfanuméricos (geralmente 24+ caracteres)
    // Nomes amigáveis são como: price_pro_monthly, price_ent_yearly, etc.
    // Verifica se é um nome amigável conhecido primeiro
    if (PRICE_IDS.hasOwnProperty(priceId)) {
        const realPriceId = PRICE_IDS[priceId]
        if (!realPriceId || realPriceId.trim() === '') {
            throw new Error(`Price ID não configurado: ${priceId}. Configure a variável STRIPE_PRICE_${priceId.toUpperCase().replace('PRICE_', '')} no .env`)
        }
        return realPriceId
    }

    // Se não está no mapeamento, verifica se é um ID real do Stripe
    // IDs reais têm formato: price_ seguido de caracteres alfanuméricos longos (sem underscores no meio)
    // Exemplo: price_1T7eYuBoK4Em3YqtnyBsFQle (24+ caracteres, sem underscores após price_)
    if (priceId.startsWith('price_')) {
        // Remove o prefixo "price_" e verifica o restante
        const afterPrefix = priceId.substring(6) // "price_".length = 6
        // IDs reais do Stripe têm pelo menos 24 caracteres após "price_"
        // e geralmente não têm underscores (são alfanuméricos contínuos)
        if (afterPrefix.length >= 24 && !afterPrefix.includes('_')) {
            return priceId // É um ID real do Stripe
        }
    }

    // Se chegou aqui, não é nem um nome amigável conhecido nem um ID real válido
    throw new Error(`Price ID inválido: ${priceId}. Use um nome amigável (ex: price_pro_monthly) ou um ID real do Stripe (ex: price_1T7eYuBoK4Em3YqtnyBsFQle)`)
}

/**
 * POST /billing/checkout
 * Cria uma sessão de checkout no Stripe
 * Body: { priceId: string, email?: string }
 * ✅ Requer autenticação
 */
router.post('/checkout', requireAuth, async (req, res) => {
    try {
        logger.log('[Billing] Requisição de checkout recebida')
        const { priceId, email } = req.body

        logger.log(`[Billing] Dados recebidos: priceId=${priceId}, email=${email || 'não fornecido'}`)

        if (!priceId) {
            logger.error('[Billing] priceId não fornecido')
            return res.status(400).json({ error: 'priceId is required' })
        }

        if (isYearlyPriceKey(priceId)) {
            return res.status(400).json({
                error: 'Assinaturas disponíveis apenas no ciclo mensal',
                code: 'BILLING_MONTHLY_ONLY',
            })
        }

        // Verificar se a chave do Stripe está configurada
        const stripeKey = process.env.STRIPE_SECRET_KEY
        if (!stripeKey || stripeKey.trim() === '') {
            logger.error('[Billing] STRIPE_SECRET_KEY não configurado no .env')
            return res.status(500).json({
                error: 'Stripe not configured',
                details: 'STRIPE_SECRET_KEY missing in environment variables'
            })
        }

        // Verificar se o Stripe foi inicializado corretamente
        if (!stripe) {
            logger.error('[Billing] Stripe não inicializado')
            return res.status(500).json({ error: 'Stripe initialization failed' })
        }

        // ✅ Email vem do middleware (validado) ou fallback para compatibilidade
        const userEmail = (req as any).user?.email || email || req.headers['x-user-email'] as string

        if (!userEmail) {
            logger.error('[Billing] Email do usuário não encontrado')
            return res.status(401).json({
                error: 'User email is required',
                details: 'Token de autenticação inválido ou email não fornecido'
            })
        }

        logger.log(`[Billing] Email obtido: ${userEmail}`)

        // Obter companiesId a partir do email
        const companiesId = await getCompanyIdByEmail(userEmail)

        if (!companiesId) {
            logger.warn(`[Billing] Nenhuma empresa encontrada para email: ${userEmail}`)
            return res.status(403).json({
                error: 'User does not belong to any company',
                details: `Nenhuma empresa associada ao email: ${userEmail}`
            })
        }

        logger.log(`[Billing] companiesId obtido: ${companiesId}`)

        // Obter origin do header ou usar padrão
        const origin = req.headers.origin || 'http://192.168.15.31:3000'

        // Converter nome amigável para ID real do Stripe
        let realPriceId: string
        try {
            realPriceId = getRealPriceId(priceId)
            logger.log(`[Billing] PriceId convertido: ${priceId} -> ${realPriceId}`)
        } catch (priceError: any) {
            logger.error(`[Billing] Erro ao converter priceId: ${priceError.message}`)
            return res.status(400).json({
                error: priceError.message,
                details: 'Configure as variáveis de ambiente STRIPE_PRICE_* no .env do backend'
            })
        }

        const requestedPlan = normalizePlanId(inferPlanFromPriceIdentifier(priceId)) as PlanId
        if (!isStripeCheckoutAvailable(requestedPlan)) {
            logger.warn(`[Billing] Checkout bloqueado para plano ${requestedPlan}`)
            return res.status(400).json({
                error: 'Plano não disponível para checkout online',
                details:
                    'Este plano requer contato com nossa equipe comercial. Use o botão "Falar com vendas" ou entre em contato pelo site.',
                code: 'CHECKOUT_NOT_AVAILABLE',
                plan: requestedPlan,
            })
        }

        logger.log(`[Billing] Criando sessão de checkout para: ${userEmail} (companiesId: ${companiesId}, priceId: ${realPriceId}, plan: ${requestedPlan})`)

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
            })

            if (!session.url) {
                logger.error('[Billing] Stripe retornou sessão sem URL')
                throw new Error('Stripe session URL não foi gerada')
            }

            logger.log(`[Billing] ✅ Sessão criada com sucesso: ${session.id}, URL: ${session.url}`)
            return res.json({ url: session.url })
        } catch (stripeError: any) {
            logger.error('[Billing] Erro ao criar sessão no Stripe:', stripeError)

            // Erros comuns do Stripe
            if (stripeError.type === 'StripeInvalidRequestError') {
                if (stripeError.message?.includes('No such price')) {
                    return res.status(400).json({
                        error: 'Price ID inválido',
                        details: `O priceId "${priceId}" não existe no Stripe. Verifique se está usando um ID real do painel do Stripe (ex: price_1PqW23...)`
                    })
                }
            }

            throw stripeError
        }
    } catch (error: any) {
        logger.error('[Billing] Erro no Checkout:', error)
        const errorMessage = error.message || 'Checkout Failed'
        const errorDetails = process.env.NODE_ENV === 'development'
            ? { stack: error.stack, fullError: error }
            : undefined

        return res.status(500).json({
            error: errorMessage,
            details: errorDetails
        })
    }
})

/**
 * GET /billing/subscription
 * Retorna informações da assinatura atual do usuário
 * ✅ Requer autenticação e ser admin
 */
router.get('/subscription', requireAuth, requireAdmin, async (req, res) => {
    try {
        // Obter email
        let userEmail: string | undefined = req.query.email as string | undefined
        if (!userEmail) {
            const emailHeader = req.headers['x-user-email']
            userEmail = Array.isArray(emailHeader) ? emailHeader[0] : (emailHeader as string | undefined)
        }

        if (!userEmail) {
            const authHeader = req.headers.authorization
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7)
                try {
                    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
                    userEmail = payload.email as string | undefined
                } catch (e) {
                    // Ignora erro
                }
            }
        }

        if (!userEmail) {
            return res.status(400).json({ error: 'User email is required' })
        }

        const companiesId = await getCompanyIdByEmail(userEmail)
        if (!companiesId) {
            return res.status(403).json({ error: 'User does not belong to any company' })
        }

        // Buscar subscription
        const { data: subscription, error } = await supabase
            .from('tb_subscriptions')
            .select('plan, status, current_period_end')
            .eq('companies_id', companiesId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (error) {
            logger.warn(`[getSubscription] Erro ao buscar subscription: ${error.message}`)
        }

        if (!subscription || !hasEffectivePaidAccess(subscription)) {
            const free = getFreePlanDisplay()
            return res.json({
                plan: FREE_PLAN_ID,
                plan_code: free.code,
                plan_title: free.title,
                product_line: free.productLine,
                status: 'inactive',
                current_period_end: subscription?.current_period_end || null,
            })
        }

        const plan = normalizePlanId(subscription.plan)
        const catalog = getPlanCatalogEntry(plan)

        return res.json({
            plan,
            plan_code: catalog.code,
            plan_title: catalog.title,
            product_line: catalog.productLine,
            status: 'active',
            current_period_end: subscription.current_period_end || null,
        })
    } catch (error: any) {
        logger.error('[getSubscription] Erro:', error)
        return res.status(500).json({
            error: 'Erro ao buscar assinatura',
            details: error.message
        })
    }
})

/**
 * GET /billing/export
 * Exporta dados de uso e billing em formato CSV
 * Query: email (opcional, pode vir do header x-user-email), startDate, endDate
 * ✅ Requer autenticação e ser admin
 */
router.get('/export', requireAuth, requireAdmin, async (req, res) => {
    try {
        // ✅ Email vem do middleware (validado) ou fallback para compatibilidade
        const userEmail = (req as any).user?.email || (req.query.email as string | undefined) || (req.headers['x-user-email'] as string | undefined)

        if (!userEmail) {
            return res.status(401).json({ 
                error: 'User email is required',
                details: 'Token de autenticação inválido ou email não fornecido'
            })
        }

        const companiesId = await getCompanyIdByEmail(userEmail)
        if (!companiesId) {
            return res.status(403).json({ error: 'User does not belong to any company' })
        }

        // Parse dates (opcional)
        const startDate = req.query.startDate 
            ? new Date(req.query.startDate as string)
            : new Date(new Date().getFullYear(), 0, 1) // Início do ano atual (buscar mais dados)
        const endDate = req.query.endDate 
            ? new Date(req.query.endDate as string)
            : new Date() // Hoje

        // Buscar métricas de uso (buscar todos os meses disponíveis se não houver filtro específico)
        let usageQuery = supabase
            .from('tb_usage_metrics')
            .select('*')
            .eq('companies_id', companiesId)
            .order('month_start', { ascending: true })

        // Aplicar filtros de data apenas se fornecidos explicitamente
        if (req.query.startDate) {
            usageQuery = usageQuery.gte('month_start', startDate.toISOString().split('T')[0])
        }
        if (req.query.endDate) {
            usageQuery = usageQuery.lte('month_start', endDate.toISOString().split('T')[0])
        }

        const { data: usageMetrics, error: usageError } = await usageQuery

        if (usageError) {
            logger.warn(`[exportBilling] Erro ao buscar métricas: ${usageError.message}`)
            // Se a tabela não existe, usageError.code será 'PGRST116' ou similar
            if (usageError.code === '42P01') {
                logger.error('[exportBilling] ⚠️ Tabela tb_usage_metrics não existe! Execute o SQL: BackEnd/database/CRIAR_TABELA_USAGE_METRICS.sql')
            }
        }

        logger.log(`[exportBilling] Métricas encontradas: ${usageMetrics?.length || 0} registros`)

        // Buscar subscription
        const { data: subscription, error: subError } = await supabase
            .from('tb_subscriptions')
            .select('*')
            .eq('companies_id', companiesId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (subError) {
            logger.warn(`[exportBilling] Erro ao buscar subscription: ${subError.message}`)
        }

        // Gerar CSV
        const csvRows: string[] = []
        
        // Header
        csvRows.push('Tipo,Período,Valor,Detalhes')
        
        // Subscription info
        if (subscription) {
            csvRows.push(`Subscription,${subscription.created_at},${subscription.plan},Status: ${subscription.status}`)
            if (subscription.current_period_end) {
                csvRows.push(`Subscription Period End,${subscription.current_period_end},,`)
            }
        }
        
        // Usage metrics
        if (usageMetrics && usageMetrics.length > 0) {
            csvRows.push('') // Linha em branco
            csvRows.push('Métricas de Uso Mensal')
            csvRows.push('Mês,Agentes,Mensagens')
            
            for (const metric of usageMetrics) {
                csvRows.push(`${metric.month_start},${metric.agent_count},${metric.message_count}`)
            }
        } else {
            csvRows.push('')
            csvRows.push('Métricas de Uso Mensal')
            csvRows.push('Mês,Agentes,Mensagens')
            csvRows.push('Nenhum dado disponível,,')
        }

        const csvContent = csvRows.join('\n')
        
        // Enviar como download
        const filename = `billing-export-${companiesId}-${new Date().toISOString().split('T')[0]}.csv`
        
        // Adicionar BOM para Excel reconhecer UTF-8 (no início do conteúdo)
        const csvWithBOM = '\ufeff' + csvContent
        
        // Configurar headers antes de enviar
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        res.setHeader('Cache-Control', 'no-cache')
        
        // Enviar resposta uma única vez
        res.send(csvWithBOM)
        
        logger.log(`[exportBilling] ✅ CSV exportado para ${userEmail}`)
    } catch (error: any) {
        logger.error('[exportBilling] Erro:', error)
        
        // Verificar se a resposta já foi enviada
        if (!res.headersSent) {
            return res.status(500).json({
                error: 'Erro ao exportar dados',
                details: error.message
            })
        }
        // Se já foi enviada, apenas logar o erro
    }
})

/**
 * POST /billing/portal
 * Cria uma sessão do portal de gerenciamento do Stripe
 * Body: { email?: string }
 * ✅ Requer autenticação e ser admin
 */
router.post('/portal', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { email } = req.body

        if (!stripe || !process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({ error: 'Stripe not configured' })
        }

        // ✅ Email vem do middleware (validado) ou fallback para compatibilidade
        const userEmail = (req as any).user?.email || email || (req.headers['x-user-email'] as string)

        if (!userEmail) {
            return res.status(401).json({ 
                error: 'User email is required',
                details: 'Token de autenticação inválido ou email não fornecido'
            })
        }

        const companiesId = await getCompanyIdByEmail(userEmail)
        if (!companiesId) {
            return res.status(403).json({ error: 'User does not belong to any company' })
        }

        // Buscar subscription no banco para obter o customer ID do Stripe
        // Por enquanto, vamos buscar pela subscription mais recente do tenant
        // TODO: Criar tabela tb_subscriptions se não existir
        const { data: subscription, error: subError } = await supabase
            .from('tb_subscriptions')
            .select('stripe_customer_id, stripe_subscription_id')
            .eq('companies_id', companiesId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (subError || !subscription?.stripe_customer_id) {
            logger.warn(`[Billing] Nenhuma subscription encontrada para companiesId: ${companiesId}`)
            return res.status(404).json({
                error: 'No active billing account found. Please upgrade first.',
                error_code: 'NO_SUBSCRIPTION'
            })
        }

        const origin = req.headers.origin || 'http://192.168.15.31:3000'

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: subscription.stripe_customer_id,
            return_url: `${origin}/configuration`,
        })

        return res.json({ url: portalSession.url })
    } catch (error: any) {
        logger.error('[Billing] Erro no Portal:', error)
        return res.status(500).json({
            error: error.message || 'Portal Failed',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        })
    }
})

async function loadStripeSubscriptionForCompany(companiesId: string) {
    const { data: subscription, error } = await supabase
        .from('tb_subscriptions')
        .select('stripe_subscription_id, stripe_customer_id, status, plan')
        .eq('companies_id', companiesId)
        .maybeSingle()

    if (error) {
        throw new Error(error.message)
    }

    const stripeSubscriptionId = subscription?.stripe_subscription_id?.trim()
    if (!stripeSubscriptionId) {
        const err = new Error('Nenhuma assinatura Stripe encontrada para esta conta.')
        ;(err as any).status = 404
        ;(err as any).code = 'NO_STRIPE_SUBSCRIPTION'
        throw err
    }

    return { subscription, stripeSubscriptionId }
}

/**
 * POST /billing/cancel-renewal
 * Agenda cancelamento ao fim do ciclo pago (mantém benefícios até current_period_end).
 */
router.post('/cancel-renewal', requireAuth, requireAdmin, async (req, res) => {
    try {
        if (!stripe || !process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({ error: 'Stripe not configured' })
        }

        const userEmail = (req as any).user?.email as string | undefined
        if (!userEmail) {
            return res.status(401).json({ error: 'User email is required' })
        }

        const companiesId = await getCompanyIdByEmail(userEmail)
        if (!companiesId) {
            return res.status(403).json({ error: 'User does not belong to any company' })
        }

        const { stripeSubscriptionId } = await loadStripeSubscriptionForCompany(companiesId)

        const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
            cancel_at_period_end: true,
        })

        const patch = buildSubscriptionPatchFromStripe(updated)
        await upsertCompanySubscription(companiesId, patch)
        clearPlanInfoCache(companiesId)

        const conversationsUsed = await getCurrentMonthConversationCount(companiesId)
        const contractedCatalog = getPlanCatalogEntry(normalizePlanId(patch.plan))
        const usageLimitReached =
            contractedCatalog.monthlyConversations !== null &&
            conversationsUsed >= contractedCatalog.monthlyConversations
        const snapshot = buildBillingSnapshot(
            {
                ...patch,
                stripe_subscription_id: stripeSubscriptionId,
            },
            { usageLimitReached }
        )

        return res.json({
            success: true,
            message:
                'Assinatura cancelada. Você mantém os benefícios até o fim do ciclo ou até esgotar os atendimentos do mês.',
            ...snapshot,
            usage_limit_reached: usageLimitReached,
            access_revoked_by_usage:
                snapshot.cancel_at_period_end && usageLimitReached && !snapshot.has_paid_access,
        })
    } catch (error: any) {
        const status = error.status || 500
        logger.error('[Billing] Erro ao cancelar renovação:', error)
        return res.status(status).json({
            error: error.message || 'Erro ao cancelar renovação',
            code: error.code,
        })
    }
})

/**
 * POST /billing/reactivate-renewal
 * Desfaz cancelamento agendado (continua renovando automaticamente).
 */
router.post('/reactivate-renewal', requireAuth, requireAdmin, async (req, res) => {
    try {
        if (!stripe || !process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({ error: 'Stripe not configured' })
        }

        const userEmail = (req as any).user?.email as string | undefined
        if (!userEmail) {
            return res.status(401).json({ error: 'User email is required' })
        }

        const companiesId = await getCompanyIdByEmail(userEmail)
        if (!companiesId) {
            return res.status(403).json({ error: 'User does not belong to any company' })
        }

        const { stripeSubscriptionId } = await loadStripeSubscriptionForCompany(companiesId)

        const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
            cancel_at_period_end: false,
        })

        const patch = buildSubscriptionPatchFromStripe(updated)
        await upsertCompanySubscription(companiesId, patch)
        clearPlanInfoCache(companiesId)

        const conversationsUsed = await getCurrentMonthConversationCount(companiesId)
        const contractedCatalog = getPlanCatalogEntry(normalizePlanId(patch.plan))
        const usageLimitReached =
            contractedCatalog.monthlyConversations !== null &&
            conversationsUsed >= contractedCatalog.monthlyConversations
        const snapshot = buildBillingSnapshot(
            {
                ...patch,
                stripe_subscription_id: stripeSubscriptionId,
            },
            { usageLimitReached }
        )

        return res.json({
            success: true,
            message: 'Renovação automática reativada com sucesso.',
            ...snapshot,
            usage_limit_reached: usageLimitReached,
        })
    } catch (error: any) {
        const status = error.status || 500
        logger.error('[Billing] Erro ao reativar renovação:', error)
        return res.status(status).json({
            error: error.message || 'Erro ao reativar renovação',
            code: error.code,
        })
    }
})

/**
 * Handler do webhook do Stripe
 * Exportado para ser usado diretamente no index.ts (antes do express.json())
 */
export async function handleStripeWebhook(req: express.Request, res: express.Response) {
    // ✅ LOG INICIAL para debug
    console.log('')
    console.log('═══════════════════════════════════════════════════════════')
    console.log('🔔 [Billing Webhook] Requisição recebida!')
    console.log('═══════════════════════════════════════════════════════════')
    console.log('📥 Headers:', {
        'stripe-signature': req.headers['stripe-signature'] ? 'presente' : 'ausente',
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent']?.substring(0, 50)
    })
    console.log('📦 Body type:', typeof req.body)
    console.log('📦 Body length:', req.body?.length || 0)
    console.log('📦 Body is Buffer?', Buffer.isBuffer(req.body))
    
    const sigHeader = req.headers['stripe-signature']
    const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!webhookSecret) {
        console.error('❌ [Billing Webhook] STRIPE_WEBHOOK_SECRET não configurado')
        logger.error('[Billing] STRIPE_WEBHOOK_SECRET não configurado')
        return res.status(500).json({ error: 'Webhook secret not configured' })
    }

    console.log('🔑 Webhook Secret configurado:', webhookSecret.substring(0, 10) + '...')

    let event: Stripe.Event

    try {
        // Verificar assinatura do webhook
        console.log('🔍 Verificando assinatura do webhook...')
        event = stripe.webhooks.constructEvent(req.body, sig!, webhookSecret)
        console.log('✅ Assinatura verificada com sucesso!')
        console.log('📋 Tipo do evento:', event.type)
    } catch (err: any) {
        console.error('❌ [Billing Webhook] Erro ao verificar assinatura:', err.message)
        console.error('❌ Detalhes do erro:', {
            message: err.message,
            type: err.type,
            sig: sig ? (typeof sig === 'string' ? sig.substring(0, 20) + '...' : 'array') : 'ausente',
            bodyLength: req.body?.length || 0
        })
        logger.error(`[Billing] Webhook signature verification failed: ${err.message}`)
        return res.status(400).send(`Webhook Error: ${err.message}`)
    }

    console.log(`✅ [Billing] Webhook recebido: ${event.type}`)
    logger.log(`[Billing] Webhook recebido: ${event.type}`)

    try {
        // Processar diferentes tipos de eventos
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session
                const tenantId = session.metadata?.tenantId
                const userEmail = session.metadata?.user_email || session.customer_email

                if (!tenantId) {
                    logger.warn('[Billing] checkout.session.completed sem tenantId no metadata')
                    break
                }

                const amount = session.amount_total || 0
                const plan = session.metadata?.plan
                    ? normalizePlanId(session.metadata.plan)
                    : amount >= 49900
                      ? 'com_enterprise'
                      : amount >= 4900
                        ? 'com_growth'
                        : 'rec_start'

                let stripeSubscription: Stripe.Subscription | null = null
                if (session.subscription) {
                    stripeSubscription = await stripe.subscriptions.retrieve(
                        session.subscription as string
                    )
                }

                logger.log(
                    `[Billing] Processando pagamento: ${userEmail} -> ${plan} (tenantId: ${tenantId})`
                )

                const subscriptionPatch = buildCheckoutSubscriptionPatch({
                    tenantId,
                    session,
                    subscription: stripeSubscription,
                    planOverride: plan,
                })
                const { companies_id, ...patch } = subscriptionPatch

                try {
                    await upsertCompanySubscription(companies_id, patch)
                    logger.log(`[Billing] ✅ Subscription sincronizada após checkout (tenantId: ${tenantId})`)
                } catch (upsertError) {
                    logger.error('[Billing] Erro ao persistir subscription pós-checkout:', upsertError)
                }

                break
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription
                const tenantId = subscription.metadata?.tenantId

                if (!tenantId) break

                const patch = buildSubscriptionPatchFromStripe(subscription)

                try {
                    await upsertCompanySubscription(tenantId, patch)
                    logger.log(`[Billing] ✅ Subscription atualizada: ${subscription.id}`)
                } catch (updateError) {
                    logger.error('[Billing] Erro ao atualizar subscription:', updateError)
                }
                break
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription
                const tenantId = subscription.metadata?.tenantId

                if (!tenantId) break

                try {
                    const periodEndUnix = getSubscriptionBillingPeriodUnix(subscription).current_period_end
                    const periodStillActive =
                        periodEndUnix != null && periodEndUnix * 1000 > Date.now()

                    if (periodStillActive) {
                        const patch = buildSubscriptionPatchFromStripe(subscription)
                        await upsertCompanySubscription(tenantId, {
                            ...patch,
                            status: 'canceled',
                        })
                        logger.log(
                            `[Billing] Subscription ${subscription.id} cancelada; acesso até fim do ciclo`
                        )
                    } else {
                        await applyStripeSubscriptionEnd(tenantId)
                        logger.log(`[Billing] ✅ Subscription encerrada (plano free): ${subscription.id}`)
                    }
                } catch (updateError) {
                    logger.error('[Billing] Erro ao encerrar subscription:', updateError)
                }
                break
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice
                const tenantId = (invoice as any).subscription_details?.metadata?.tenantId ||
                    ((invoice as any).subscription ?
                        (await stripe.subscriptions.retrieve((invoice as any).subscription as string)).metadata?.tenantId
                        : null)

                if (tenantId) {
                    logger.warn(`[Billing] ⚠️ Pagamento falhou para tenantId: ${tenantId}`)
                    // Você pode criar uma notificação aqui se quiser
                }
                break
            }

            default:
                logger.log(`[Billing] Evento não processado: ${event.type}`)
        }

        res.json({ received: true })
    } catch (error: any) {
        logger.error('[Billing] Erro ao processar webhook:', error)
        res.status(500).json({ error: 'Webhook processing failed' })
    }
}

/**
 * POST /billing/webhook
 * Webhook do Stripe para processar eventos de pagamento
 * IMPORTANTE: Esta rota deve usar express.raw() para receber o body bruto
 * Nota: A rota principal está registrada no index.ts antes do express.json()
 * Esta rota aqui é apenas para manter compatibilidade
 */
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook)

export default router
