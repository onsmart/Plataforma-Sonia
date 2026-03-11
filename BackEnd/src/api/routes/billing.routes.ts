import express from 'express'
import Stripe from 'stripe'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

const router = express.Router()

// Inicializa o Stripe com a chave secreta do .env
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-02-25.clover' as any,
})

// Mapeamento de nomes amigáveis para Price IDs reais do Stripe
// Configure essas variáveis no .env do backend
const PRICE_IDS: Record<string, string> = {
    'price_pro_monthly': process.env.STRIPE_PRICE_PRO_MONTHLY || '',
    'price_pro_yearly': process.env.STRIPE_PRICE_PRO_YEARLY || '',
    'price_ent_monthly': process.env.STRIPE_PRICE_ENT_MONTHLY || '',
    'price_ent_yearly': process.env.STRIPE_PRICE_ENT_YEARLY || '',
}

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
 */
router.post('/checkout', async (req, res) => {
    try {
        logger.log('[Billing] Requisição de checkout recebida')
        const { priceId, email } = req.body

        logger.log(`[Billing] Dados recebidos: priceId=${priceId}, email=${email || 'não fornecido'}`)

        if (!priceId) {
            logger.error('[Billing] priceId não fornecido')
            return res.status(400).json({ error: 'priceId is required' })
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

        // Obter email do body, header ou token JWT
        let userEmail = email

        // Se não veio no body, tenta pegar do header
        if (!userEmail) {
            const emailHeader = req.headers['x-user-email']
            userEmail = Array.isArray(emailHeader) ? emailHeader[0] : emailHeader
        }

        // Se ainda não tem, tenta extrair do token JWT
        if (!userEmail) {
            const authHeader = req.headers.authorization
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7)
                try {
                    // Decodificar o token JWT (sem verificar, apenas para pegar o email)
                    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
                    userEmail = payload.email
                } catch (e) {
                    logger.warn('[Billing] Não foi possível extrair email do token JWT')
                }
            }
        }

        if (!userEmail) {
            logger.error('[Billing] Email do usuário não encontrado')
            return res.status(400).json({
                error: 'User email is required',
                details: 'Email não foi fornecido no body, header ou token JWT'
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

        logger.log(`[Billing] Criando sessão de checkout para: ${userEmail} (companiesId: ${companiesId}, priceId: ${realPriceId})`)

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
                    user_email: userEmail
                },
                subscription_data: {
                    metadata: {
                        tenantId: companiesId,
                        user_email: userEmail
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
 * Query: email (opcional, pode vir do header x-user-email)
 */
router.get('/subscription', async (req, res) => {
    try {
        // Obter email
        let userEmail = req.query.email as string
        if (!userEmail) {
            const emailHeader = req.headers['x-user-email']
            userEmail = Array.isArray(emailHeader) ? emailHeader[0] : emailHeader
        }

        if (!userEmail) {
            const authHeader = req.headers.authorization
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7)
                try {
                    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
                    userEmail = payload.email
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

        // Se não tem subscription, retorna starter
        const plan = (subscription?.plan as 'starter' | 'pro' | 'enterprise') || 'starter'
        const status = subscription?.status === 'active' ? 'active' : 'inactive'

        return res.json({
            plan,
            status,
            current_period_end: subscription?.current_period_end || null
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
 */
router.get('/export', async (req, res) => {
    try {
        // Obter email
        let userEmail = req.query.email as string
        if (!userEmail) {
            const emailHeader = req.headers['x-user-email']
            userEmail = Array.isArray(emailHeader) ? emailHeader[0] : emailHeader
        }

        if (!userEmail) {
            const authHeader = req.headers.authorization
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7)
                try {
                    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
                    userEmail = payload.email
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
 */
router.post('/portal', async (req, res) => {
    try {
        const { email } = req.body

        if (!stripe || !process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({ error: 'Stripe not configured' })
        }

        // Obter email (mesma lógica do checkout)
        let userEmail = email
        if (!userEmail) {
            const emailHeader = req.headers['x-user-email']
            userEmail = Array.isArray(emailHeader) ? emailHeader[0] : emailHeader
        }

        if (!userEmail) {
            const authHeader = req.headers.authorization
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7)
                try {
                    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
                    userEmail = payload.email
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

                // Determinar o plano baseado no preço
                const amount = session.amount_total || 0
                const plan = amount >= 49900 ? 'enterprise' : amount >= 4900 ? 'pro' : 'starter'

                logger.log(`[Billing] Processando pagamento: ${userEmail} -> ${plan} (tenantId: ${tenantId})`)

                // Atualizar ou criar subscription no banco
                const subscriptionData = {
                    companies_id: tenantId,
                    plan: plan,
                    status: 'active',
                    stripe_customer_id: session.customer as string,
                    stripe_subscription_id: session.subscription as string,
                    current_period_end: (session as any).subscription_details?.metadata?.current_period_end
                        ? new Date((session as any).subscription_details.metadata.current_period_end * 1000).toISOString()
                        : null,
                    updated_at: new Date().toISOString()
                }

                // Verificar se já existe subscription
                const { data: existing } = await supabase
                    .from('tb_subscriptions')
                    .select('id')
                    .eq('companies_id', tenantId)
                    .maybeSingle()

                if (existing) {
                    // Atualizar
                    const { error: updateError } = await supabase
                        .from('tb_subscriptions')
                        .update(subscriptionData)
                        .eq('id', existing.id)

                    if (updateError) {
                        logger.error('[Billing] Erro ao atualizar subscription:', updateError)
                    } else {
                        logger.log(`[Billing] ✅ Subscription atualizada: ${existing.id}`)
                    }
                } else {
                    // Criar nova
                    const { error: insertError } = await supabase
                        .from('tb_subscriptions')
                        .insert({
                            ...subscriptionData,
                            created_at: new Date().toISOString()
                        })

                    if (insertError) {
                        logger.error('[Billing] Erro ao criar subscription:', insertError)
                    } else {
                        logger.log(`[Billing] ✅ Nova subscription criada para tenantId: ${tenantId}`)
                    }
                }

                break
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription
                const tenantId = subscription.metadata?.tenantId

                if (!tenantId) break

                const { error: updateError } = await supabase
                    .from('tb_subscriptions')
                    .update({
                        status: subscription.status,
                        current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('stripe_subscription_id', subscription.id)

                if (updateError) {
                    logger.error('[Billing] Erro ao atualizar subscription:', updateError)
                } else {
                    logger.log(`[Billing] ✅ Subscription atualizada: ${subscription.id}`)
                }
                break
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription
                const tenantId = subscription.metadata?.tenantId

                if (!tenantId) break

                const { error: updateError } = await supabase
                    .from('tb_subscriptions')
                    .update({
                        plan: 'free',
                        status: 'canceled',
                        canceled_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('stripe_subscription_id', subscription.id)

                if (updateError) {
                    logger.error('[Billing] Erro ao cancelar subscription:', updateError)
                } else {
                    logger.log(`[Billing] ✅ Subscription cancelada: ${subscription.id}`)
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
