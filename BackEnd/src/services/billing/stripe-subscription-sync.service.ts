import Stripe from 'stripe'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import {
  FREE_PLAN_ID,
  hasEffectivePaidAccess,
  inferPlanIdFromStripePriceKey,
  isCancelAtPeriodEnd,
  isFreePlanId,
  normalizePlanId,
  type PlanId,
} from '../../config/plans.catalog'
import { clearPlanInfoCache } from '../../utils/plan-helper'

export type SubscriptionRowPatch = {
  plan?: PlanId
  status: string
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  current_period_start?: string | null
  current_period_end?: string | null
  canceled_at?: string | null
  updated_at: string
}

export function unixToIso(unixSeconds: number | null | undefined): string | null {
  if (unixSeconds == null || !Number.isFinite(unixSeconds)) return null
  return new Date(unixSeconds * 1000).toISOString()
}

/** Basil/Clover: periodos ficam em subscription.items.data[]; fallback para API legada. */
export function getSubscriptionBillingPeriodUnix(subscription: Stripe.Subscription): {
  current_period_start: number | null
  current_period_end: number | null
} {
  const primaryItem = subscription.items?.data?.[0] as
    | (Stripe.SubscriptionItem & {
        current_period_start?: number | null
        current_period_end?: number | null
      })
    | undefined

  if (
    primaryItem?.current_period_start != null &&
    primaryItem?.current_period_end != null
  ) {
    return {
      current_period_start: primaryItem.current_period_start,
      current_period_end: primaryItem.current_period_end,
    }
  }

  const legacy = subscription as Stripe.Subscription & {
    current_period_start?: number | null
    current_period_end?: number | null
  }

  return {
    current_period_start: legacy.current_period_start ?? null,
    current_period_end: legacy.current_period_end ?? null,
  }
}

export function inferPlanFromStripeSubscription(subscription: Stripe.Subscription): PlanId {
  const fromMetadata = subscription.metadata?.plan
  if (fromMetadata) {
    return normalizePlanId(fromMetadata)
  }

  const priceId = subscription.items?.data?.[0]?.price?.id
  if (priceId) {
    return normalizePlanId(inferPlanIdFromStripePriceKey(priceId))
  }

  return 'rec_start'
}

export function buildSubscriptionPatchFromStripe(
  subscription: Stripe.Subscription,
  overrides: Partial<SubscriptionRowPatch> = {}
): SubscriptionRowPatch {
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end)
  const stripeCanceledAt = unixToIso(subscription.canceled_at)

  let canceledAt: string | null = null
  if (cancelAtPeriodEnd) {
    canceledAt = stripeCanceledAt || new Date().toISOString()
  } else if (subscription.status === 'active' || subscription.status === 'trialing') {
    canceledAt = null
  } else if (stripeCanceledAt) {
    canceledAt = stripeCanceledAt
  }

  const billingPeriod = getSubscriptionBillingPeriodUnix(subscription)

  return {
    plan: inferPlanFromStripeSubscription(subscription),
    status: subscription.status,
    stripe_customer_id:
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id ?? null,
    stripe_subscription_id: subscription.id,
    current_period_start: unixToIso(billingPeriod.current_period_start),
    current_period_end: unixToIso(billingPeriod.current_period_end),
    canceled_at: canceledAt,
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

export function buildCheckoutSubscriptionPatch(input: {
  tenantId: string
  session: Stripe.Checkout.Session
  subscription: Stripe.Subscription | null
  planOverride?: PlanId
}): SubscriptionRowPatch & { companies_id: string } {
  const { session, subscription, planOverride } = input
  const amount = session.amount_total || 0
  const fallbackPlan = session.metadata?.plan
    ? normalizePlanId(session.metadata.plan)
    : amount >= 49900
      ? 'com_enterprise'
      : amount >= 4900
        ? 'com_growth'
        : 'rec_start'

  const base: SubscriptionRowPatch = {
    plan: planOverride ?? fallbackPlan,
    status: subscription?.status || 'active',
    stripe_customer_id:
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id ?? null,
    stripe_subscription_id:
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id ?? null,
    current_period_start: null,
    current_period_end: null,
    canceled_at: null,
    updated_at: new Date().toISOString(),
  }

  if (subscription) {
    const fromStripe = buildSubscriptionPatchFromStripe(subscription, {
      plan: planOverride ?? inferPlanFromStripeSubscription(subscription) ?? fallbackPlan,
    })
    return { companies_id: input.tenantId, ...fromStripe }
  }

  return { companies_id: input.tenantId, ...base }
}

export async function upsertCompanySubscription(
  companiesId: string,
  patch: SubscriptionRowPatch
): Promise<void> {
  const { data: existing, error: findError } = await supabase
    .from('tb_subscriptions')
    .select('id')
    .eq('companies_id', companiesId)
    .maybeSingle()

  if (findError) {
    logger.error('[stripe-subscription-sync] Erro ao buscar subscription:', findError)
    throw findError
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('tb_subscriptions')
      .update(patch)
      .eq('id', existing.id)

    if (updateError) {
      logger.error('[stripe-subscription-sync] Erro ao atualizar subscription:', updateError)
      throw updateError
    }
  } else {
    const { error: insertError } = await supabase.from('tb_subscriptions').insert({
      companies_id: companiesId,
      ...patch,
      created_at: new Date().toISOString(),
    })

    if (insertError) {
      logger.error('[stripe-subscription-sync] Erro ao criar subscription:', insertError)
      throw insertError
    }
  }

  clearPlanInfoCache(companiesId)
}

export async function applyStripeSubscriptionEnd(companiesId: string): Promise<void> {
  const { error } = await supabase
    .from('tb_subscriptions')
    .update({
      plan: FREE_PLAN_ID,
      status: 'inactive',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('companies_id', companiesId)

  if (error) {
    logger.error('[stripe-subscription-sync] Erro ao encerrar subscription:', error)
    throw error
  }

  clearPlanInfoCache(companiesId)
}

export async function syncSubscriptionFromStripe(
  stripe: Stripe,
  stripeSubscriptionId: string
): Promise<SubscriptionRowPatch | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
    return buildSubscriptionPatchFromStripe(subscription)
  } catch (error: any) {
    logger.warn(
      `[stripe-subscription-sync] Falha ao sincronizar ${stripeSubscriptionId}: ${error.message}`
    )
    return null
  }
}

export type SubscriptionBillingSnapshot = {
  plan: string
  status: string
  current_period_start: string | null
  current_period_end: string | null
  canceled_at: string | null
  cancel_at_period_end: boolean
  has_paid_access: boolean
  has_stripe_subscription: boolean
}

export function buildBillingSnapshot(
  row: {
    plan?: string | null
    status?: string | null
    current_period_start?: string | null
    current_period_end?: string | null
    canceled_at?: string | null
    stripe_subscription_id?: string | null
  },
  options?: { usageLimitReached?: boolean }
): SubscriptionBillingSnapshot {
  const status = String(row.status || 'inactive')
  const cancelAtPeriodEnd = isCancelAtPeriodEnd(row)
  const hasPaidAccess = hasEffectivePaidAccess(row, {
    cancelAtPeriodEnd,
    usageLimitReached: options?.usageLimitReached,
  })

  return {
    plan: String(row.plan || FREE_PLAN_ID),
    status,
    current_period_start: row.current_period_start || null,
    current_period_end: row.current_period_end || null,
    canceled_at: row.canceled_at || null,
    cancel_at_period_end: cancelAtPeriodEnd,
    has_paid_access: hasPaidAccess,
    has_stripe_subscription: Boolean(row.stripe_subscription_id?.trim()),
  }
}

export async function syncCompanySubscriptionFromStripeIfNeeded(
  stripe: Stripe,
  companiesId: string,
  row: {
    plan?: string | null
    status?: string | null
    stripe_subscription_id?: string | null
    current_period_end?: string | null
    current_period_start?: string | null
  },
  force = false
): Promise<SubscriptionRowPatch | null> {
  const stripeSubscriptionId = row.stripe_subscription_id?.trim()
  if (!stripeSubscriptionId) return null

  const dbPlan = String(row.plan || FREE_PLAN_ID)
  const dbStatus = String(row.status || 'inactive')
  const looksDowngradedLocally =
    isFreePlanId(dbPlan) || dbStatus === 'inactive' || !hasEffectivePaidAccess(row)

  const needsSync =
    force ||
    !row.current_period_end ||
    !row.current_period_start ||
    looksDowngradedLocally

  if (!needsSync) return null

  const patch = await syncSubscriptionFromStripe(stripe, stripeSubscriptionId)
  if (!patch) return null

  // Stripe encerrou de fato — não reativar plano pago localmente.
  if (!hasEffectivePaidAccess(patch)) {
    logger.log(
      `[stripe-subscription-sync] Stripe ${stripeSubscriptionId} sem acesso pago; mantendo estado local`
    )
    return null
  }

  await upsertCompanySubscription(companiesId, patch)
  logger.log(
    `[stripe-subscription-sync] Assinatura reconciliada com Stripe para tenant ${companiesId}: ${patch.plan}/${patch.status}`
  )
  return patch
}
