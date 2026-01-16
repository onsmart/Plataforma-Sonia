import Stripe from "npm:stripe@14.14.0";
import * as kv from "./kv_store.tsx";
import { logActivity, createNotification } from "./core.ts";

export const PLANS = {
    'price_pro_monthly': { name: 'SONIA Pro', amount: 4900 },
    'price_ent_monthly': { name: 'SONIA Enterprise', amount: 49900 }
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
});

export async function createCheckoutSession(tenantId: string, priceId: string, returnUrl: string, email?: string) {
    if (!stripe._api.auth) throw new Error("Stripe Key Missing");

    // Ensure customer exists or create (simplification: create session with email)
    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
            {
                price: priceId, 
                quantity: 1,
            },
        ],
        customer_email: email,
        success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnUrl}`,
        metadata: {
            tenantId
        },
        subscription_data: {
            metadata: {
                tenantId
            }
        }
    });

    return session.url;
}

export async function createPortalSession(tenantId: string, returnUrl: string) {
    if (!stripe._api.auth) throw new Error("Stripe Key Missing");

    // 1. Get Subscription to find Stripe Customer ID
    const sub = await kv.get(`tenant:${tenantId}:subscription`);
    
    // Explicitly check for stripeId
    if (!sub || !sub.stripeId) {
        console.error(`[Billing] Portal Request Failed - No Stripe ID for tenant ${tenantId}`);
        throw new Error("No active billing account found. Please upgrade first.");
    }

    try {
        // We need the Customer ID, not Subscription ID. 
        // Ideally we stored customerId. But if we only have subscription ID (stripeId), we fetch sub first.
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripeId);
        
        const session = await stripe.billingPortal.sessions.create({
            customer: stripeSub.customer as string,
            return_url: returnUrl,
        });

        return session.url;
    } catch (e) {
        console.error(`[Billing] Stripe Error: ${e.message}`);
        throw new Error("Failed to connect to billing provider.");
    }
}

export async function processStripeWebhook(event: any) {
    const data = event.data.object;
    let tenantId = data.metadata?.tenantId;

    console.log(`[Stripe Webhook] Received ${event.type}`);

    if (tenantId) {
        if (event.type === 'checkout.session.completed') {
            const amount = data.amount_total; 
            const plan = amount > 10000 ? 'enterprise' : 'pro';
            
            await kv.set(`tenant:${tenantId}:subscription`, { 
                plan, 
                status: 'active', 
                stripeId: data.subscription,
                updatedAt: new Date().toISOString()
            });

            await logActivity(tenantId, {
                agent: "Stripe Billing",
                action: `Subscription Activated: ${plan.toUpperCase()}`,
                type: "success",
                platform: "Billing"
            });

            await createNotification(tenantId, {
                type: 'success',
                title: 'Subscription Active',
                message: `Welcome to SONIA ${plan === 'enterprise' ? 'Enterprise' : 'Pro'}! Your features are now unlocked.`
            });
        }
        else if (event.type === 'customer.subscription.updated') {
            await kv.set(`tenant:${tenantId}:subscription`, { 
                plan: 'pro', 
                status: data.status, 
                stripeId: data.id,
                currentPeriodEnd: new Date(data.current_period_end * 1000).toISOString()
            });
        }
        else if (event.type === 'customer.subscription.deleted') {
            await kv.set(`tenant:${tenantId}:subscription`, { 
                plan: 'free', 
                status: 'canceled',
                canceledAt: new Date().toISOString()
            });

            await logActivity(tenantId, {
                agent: "Stripe Billing",
                action: "Subscription Canceled",
                type: "warning",
                platform: "Billing"
            });

            await createNotification(tenantId, {
                type: 'warning',
                title: 'Subscription Canceled',
                message: `Your subscription has been canceled. You have been downgraded to the Free plan.`
            });
        }
        else if (event.type === 'invoice.payment_failed') {
            await createNotification(tenantId, {
                type: 'error',
                title: 'Payment Failed',
                message: `We failed to process your latest payment. Please update your billing information to avoid service interruption.`
            });
            
            await logActivity(tenantId, {
                agent: "Stripe Billing",
                action: "Invoice Payment Failed",
                type: "error",
                platform: "Billing"
            });
        }
    }
}
