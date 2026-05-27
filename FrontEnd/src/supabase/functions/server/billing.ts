import Stripe from "npm:stripe@14.14.0";
import * as kv from "./kv_store.tsx";
import { logActivity, createNotification } from "./core.ts";

import type { OfficialPlanId } from './types.ts';

export const PLANS: Record<string, { name: string; amount: number }> = {
    'price_rec_start_monthly': { name: 'Sonia Receptiva — Start', amount: 0 },
    'price_rec_growth_monthly': { name: 'Sonia Receptiva — Growth', amount: 0 },
    'price_com_growth_monthly': { name: 'Sonia Completa — Growth', amount: 4900 },
    'price_com_enterprise_monthly': { name: 'Sonia Completa — Enterprise', amount: 49900 },
};

const OFFICIAL_PLANS: OfficialPlanId[] = [
    'rec_start',
    'rec_growth',
    'rec_enterprise',
    'com_start',
    'com_growth',
    'com_enterprise',
];

function inferPlanFromBillingPayload(data: any): OfficialPlanId {
    const normalizedPlan = String(data?.metadata?.plan || '')
        .trim()
        .toLowerCase()
        .replace(/-/g, '_');
    if (OFFICIAL_PLANS.includes(normalizedPlan as OfficialPlanId)) {
        return normalizedPlan as OfficialPlanId;
    }

    const priceId = String(
        data?.items?.data?.[0]?.price?.id
        || data?.lines?.data?.[0]?.price?.id
        || data?.display_items?.[0]?.price?.id
        || ''
    ).toLowerCase();

    if (priceId.includes('com_enterprise') || priceId.includes('com-enterprise')) return 'com_enterprise';
    if (priceId.includes('com_growth') || priceId.includes('com-growth')) return 'com_growth';
    if (priceId.includes('com_start') || priceId.includes('com-start')) return 'com_start';
    if (priceId.includes('rec_enterprise') || priceId.includes('rec-enterprise')) return 'rec_enterprise';
    if (priceId.includes('rec_growth') || priceId.includes('rec-growth')) return 'rec_growth';
    if (priceId.includes('rec_start') || priceId.includes('rec-start')) return 'rec_start';

    const amount = Number(data?.amount_total || data?.plan?.amount || 0);
    if (amount >= 49900) return 'com_enterprise';
    if (amount >= 4900) return 'com_growth';
    return 'rec_start';
}

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
            const plan = inferPlanFromBillingPayload(data);
            
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
                message: `Welcome to SONIA ${plan.replace(/_/g, ' ').toUpperCase()}! Your features are now unlocked.`
            });
        }
        else if (event.type === 'customer.subscription.updated') {
            const plan = inferPlanFromBillingPayload(data);
            await kv.set(`tenant:${tenantId}:subscription`, { 
                plan, 
                status: data.status, 
                stripeId: data.id,
                currentPeriodEnd: new Date(data.current_period_end * 1000).toISOString()
            });
        }
        else if (event.type === 'customer.subscription.deleted') {
            await kv.set(`tenant:${tenantId}:subscription`, { 
                plan: 'rec_start', 
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
                message: `Your subscription has been canceled. You have been downgraded to the Pro plan.`
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
