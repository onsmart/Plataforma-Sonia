import express from 'express'
import Stripe from 'stripe'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

const router = express.Router()

// Inicializa o Stripe com a chave secreta do .env
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
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
 * Se já for um ID real (começa com price_), retorna como está
 */
function getRealPriceId(priceId: string): string {
    // Se já é um ID real do Stripe (começa com price_ e tem formato correto)
    if (priceId.startsWith('price_') && priceId.length > 10) {
        return priceId
    }
    
    // Tenta mapear o nome amigável
    const realPriceId = PRICE_IDS[priceId]
    if (!realPriceId || realPriceId.trim() === '') {
        throw new Error(`Price ID não configurado: ${priceId}. Configure a variável STRIPE_PRICE_${priceId.toUpperCase().replace('PRICE_', '')} no .env`)
    }
    
    return realPriceId
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
 * POST /billing/webhook
 * Webhook do Stripe para processar eventos de pagamento
 * IMPORTANTE: Esta rota deve usar express.raw() para receber o body bruto
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature']
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!webhookSecret) {
        logger.error('[Billing] STRIPE_WEBHOOK_SECRET não configurado')
        return res.status(500).json({ error: 'Webhook secret not configured' })
    }

    let event: Stripe.Event

    try {
        // Verificar assinatura do webhook
        event = stripe.webhooks.constructEvent(req.body, sig!, webhookSecret)
    } catch (err: any) {
        logger.error(`[Billing] Webhook signature verification failed: ${err.message}`)
        return res.status(400).send(`Webhook Error: ${err.message}`)
    }

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
                    current_period_end: session.subscription_details?.metadata?.current_period_end 
                        ? new Date(session.subscription_details.metadata.current_period_end * 1000).toISOString()
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
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
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
                const tenantId = invoice.subscription_details?.metadata?.tenantId || 
                                (invoice.subscription ? 
                                    (await stripe.subscriptions.retrieve(invoice.subscription as string)).metadata?.tenantId 
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
})

export default router
