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

export function isRealStripeSubscriptionId(id: string | null | undefined): boolean {
  const value = String(id || '').trim()
  if (!value.startsWith('sub_')) return false
  if (value.includes('free_local')) return false
  return true
}

export function isRealStripeCustomerId(id: string | null | undefined): boolean {
  const value = String(id || '').trim()
  if (!value.startsWith('cus_')) return false
  if (value.includes('free_local')) return false
  return true
}

export async function resolveTenantIdFromStripeSubscription(
  stripe: Stripe,
  subscriptionRef: Stripe.Subscription | string
): Promise<string | null> {
  const subscription =
    typeof subscriptionRef === 'string'
      ? await stripe.subscriptions.retrieve(subscriptionRef)
      : subscriptionRef

  const fromMetadata = subscription.metadata?.tenantId?.trim()
  if (fromMetadata) return fromMetadata

  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id

  if (!customerId) return null

  const { data } = await supabase
    .from('tb_subscriptions')
    .select('companies_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  return data?.companies_id || null
}

export async function loadStripeSubscriptionForCompany(companiesId: string): Promise<{
  subscription: {
    stripe_subscription_id: string
    stripe_customer_id: string | null
    status: string
    plan: string
  }
  stripeSubscriptionId: string
}> {
  const { data: subscription, error } = await supabase
    .from('tb_subscriptions')
    .select('stripe_subscription_id, stripe_customer_id, status, plan')
    .eq('companies_id', companiesId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const stripeSubscriptionId = subscription?.stripe_subscription_id?.trim()
  if (!isRealStripeSubscriptionId(stripeSubscriptionId)) {
    const err = new Error(
      'Nenhuma assinatura Stripe válida encontrada para esta conta. Contrate um plano pago antes de cancelar.'
    )
    ;(err as any).status = 404
    ;(err as any).code = 'NO_STRIPE_SUBSCRIPTION'
    throw err
  }

  return {
    subscription: subscription as {
      stripe_subscription_id: string
      stripe_customer_id: string | null
      status: string
      plan: string
    },
    stripeSubscriptionId: stripeSubscriptionId!,
  }
}

export type StripeSubscriptionMutationResult = {
  subscription: Stripe.Subscription
  patch: SubscriptionRowPatch
  stripe_sync: {
    subscription_id: string
    status: string
    cancel_at_period_end: boolean
    current_period_end: string | null
  }
}

/** Atualiza assinatura no Stripe, confirma resposta e persiste no banco (fonte de verdade: Stripe). */
export async function mutateCompanyStripeSubscription(
  stripe: Stripe,
  companiesId: string,
  buildUpdate: (current: Stripe.Subscription) => Stripe.SubscriptionUpdateParams
): Promise<StripeSubscriptionMutationResult> {
  const { stripeSubscriptionId } = await loadStripeSubscriptionForCompany(companiesId)
  const current = await stripe.subscriptions.retrieve(stripeSubscriptionId)
  const updateParams = buildUpdate(current)

  const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
    ...updateParams,
    metadata: {
      ...(current.metadata || {}),
      ...(updateParams.metadata || {}),
      tenantId: companiesId,
    },
  })

  const verified = await stripe.subscriptions.retrieve(updated.id)
  const billingPeriod = getSubscriptionBillingPeriodUnix(verified)
  const patch = buildSubscriptionPatchFromStripe(verified)
  await upsertCompanySubscription(companiesId, patch)
  clearPlanInfoCache(companiesId)

  logger.log('[stripe-subscription-sync] Assinatura Stripe atualizada', {
    companiesId,
    subscriptionId: verified.id,
    status: verified.status,
    cancel_at_period_end: verified.cancel_at_period_end,
    current_period_end: unixToIso(billingPeriod.current_period_end),
  })

  return {
    subscription: verified,
    patch,
    stripe_sync: {
      subscription_id: verified.id,
      status: verified.status,
      cancel_at_period_end: Boolean(verified.cancel_at_period_end),
      current_period_end: unixToIso(billingPeriod.current_period_end),
    },
  }
}

export function isSubscriptionPeriodEnded(iso: string | null | undefined): boolean {
  if (!iso?.trim()) return false
  const ms = new Date(iso).getTime()
  return !Number.isNaN(ms) && ms <= Date.now()
}

export function isStripeBillingSyncDisabled(): boolean {
  const raw = String(process.env.BILLING_DISABLE_STRIPE_SYNC || '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export type SubscriptionAccessState = 'free' | 'active' | 'cancel_scheduled' | 'ended'

export function resolveSubscriptionAccessState(input: {
  has_paid_access: boolean
  cancel_at_period_end: boolean
  has_stripe_subscription: boolean
  current_period_end?: string | null
  catalog_plan?: string | null
}): SubscriptionAccessState {
  if (input.has_paid_access && input.cancel_at_period_end) return 'cancel_scheduled'
  if (input.has_paid_access) return 'active'
  if (
    input.has_stripe_subscription ||
    isSubscriptionPeriodEnded(input.current_period_end) ||
    (input.catalog_plan && !isFreePlanId(input.catalog_plan))
  ) {
    return 'ended'
  }
  return 'free'
}

export async function applyStripeSubscriptionEnd(companiesId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('tb_subscriptions')
    .select('canceled_at, current_period_start, current_period_end')
    .eq('companies_id', companiesId)
    .maybeSingle()

  const { error } = await supabase
    .from('tb_subscriptions')
    .update({
      plan: FREE_PLAN_ID,
      status: 'inactive',
      canceled_at: existing?.canceled_at || new Date().toISOString(),
      current_period_start: existing?.current_period_start ?? null,
      current_period_end: existing?.current_period_end ?? null,
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
    canceled_at?: string | null
  },
  force = false
): Promise<SubscriptionRowPatch | null> {
  const stripeSubscriptionId = row.stripe_subscription_id?.trim()
  if (!stripeSubscriptionId) return null

  if (isStripeBillingSyncDisabled()) {
    logger.log('[stripe-subscription-sync] Sync Stripe desabilitado (BILLING_DISABLE_STRIPE_SYNC)')
    return null
  }

  const periodEndedLocally = isSubscriptionPeriodEnded(row.current_period_end)
  if (periodEndedLocally) {
    logger.log(
      `[stripe-subscription-sync] Ciclo local já expirou (${row.current_period_end}); não restaurar datas do Stripe`
    )
    return null
  }

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
