import Stripe from 'stripe'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { getPlanCatalogEntry, isCancelAtPeriodEnd, isFreePlanId, normalizePlanId } from '../../config/plans.catalog'
import { getCompanyAdminEmails } from '../atendimento-limit-notify.service'
import { isPlatformEmailConfigured, sendPlatformEmail } from '../platform-email.service'
import {
  buildSubscriptionBillingEmail,
  type SubscriptionBillingEmailKind,
} from './subscription-billing-email.template'
import {
  applyStripeSubscriptionEnd,
  inferPlanFromStripeSubscription,
  resolveTenantIdFromStripeSubscription,
  unixToIso,
} from './stripe-subscription-sync.service'

export type SubscriptionEndReason = 'user_cancel' | 'payment_failed' | 'other'

export function inferSubscriptionEndReason(subscription: Stripe.Subscription): SubscriptionEndReason {
  const cancellationReason = subscription.cancellation_details?.reason
  if (cancellationReason === 'payment_failed' || cancellationReason === 'payment_disputed') {
    return 'payment_failed'
  }
  if (subscription.cancel_at_period_end) return 'user_cancel'
  if (cancellationReason === 'cancellation_requested') return 'user_cancel'
  if (subscription.status === 'unpaid') return 'payment_failed'
  if (subscription.canceled_at && subscription.status === 'canceled') {
    return 'user_cancel'
  }
  return 'other'
}

export function endReasonToEmailKind(endReason: SubscriptionEndReason): SubscriptionBillingEmailKind {
  return endReason === 'payment_failed' ? 'ended_payment_failed' : 'ended_user_cancel'
}

async function findBillingNotificationByDedupe(
  dedupeKey: string
): Promise<{ id: string; metadata: Record<string, unknown> | null } | null> {
  const { data, error } = await supabase
    .from('tb_notifications')
    .select('id, metadata')
    .eq('type', 'plan_billing_email')
    .contains('metadata', { dedupe_key: dedupeKey })
    .limit(1)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    logger.warn('[subscription.billing] dedupe check erro', { error: error.message })
  }

  return data ? { id: data.id, metadata: (data.metadata as Record<string, unknown>) || null } : null
}

async function createInAppBillingNotification(
  companiesId: string,
  title: string,
  body: string,
  metadata: Record<string, unknown>
): Promise<string | null> {
  const { data, error } = await supabase
    .from('tb_notifications')
    .insert({
      companies_id: companiesId,
      type: 'plan_billing_email',
      title,
      body,
      read: false,
      metadata: { ...metadata, email_sent: false },
    })
    .select('id')
    .maybeSingle()

  if (error) {
    logger.warn('[subscription.billing] Falha ao criar notificação in-app', {
      companiesId,
      error: error.message,
    })
    return null
  }

  return data?.id || null
}

async function markBillingEmailSent(notificationId: string): Promise<void> {
  const { data: row } = await supabase
    .from('tb_notifications')
    .select('metadata')
    .eq('id', notificationId)
    .maybeSingle()

  await supabase
    .from('tb_notifications')
    .update({
      metadata: {
        ...((row?.metadata as Record<string, unknown>) || {}),
        email_sent: true,
        email_sent_at: new Date().toISOString(),
      },
    })
    .eq('id', notificationId)
}

async function sendBillingEmailToAdmins(
  companiesId: string,
  email: { subject: string; text: string; html: string }
): Promise<boolean> {
  if (!isPlatformEmailConfigured()) {
    logger.warn(
      '[subscription.billing] Resend não configurado (RESEND_API_KEY / RESEND_FROM_EMAIL)'
    )
    return false
  }

  const adminEmails = await getCompanyAdminEmails(companiesId)
  if (adminEmails.length === 0) {
    logger.warn('[subscription.billing] Nenhum owner/admin com e-mail', { companiesId })
    return false
  }

  let anySent = false
  for (const adminEmail of adminEmails) {
    try {
      await sendPlatformEmail({
        to: adminEmail,
        subject: email.subject,
        text: email.text,
        html: email.html,
      })
      anySent = true
      logger.info('[subscription.billing] E-mail enviado', { companiesId, adminEmail })
    } catch (err: unknown) {
      logger.warn('[subscription.billing] Falha ao enviar e-mail', {
        companiesId,
        adminEmail,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return anySent
}

/** Notifica owners/admins in-app + e-mail quando a assinatura paga encerra de fato. */
export async function notifySubscriptionEnded(params: {
  companiesId: string
  kind: SubscriptionBillingEmailKind
  dedupeKey: string
  planTitle: string
  periodEndIso?: string | null
  stripeEventId?: string
}): Promise<void> {
  const { companiesId, kind, dedupeKey } = params

  const existing = await findBillingNotificationByDedupe(dedupeKey)
  if (existing) {
    if (existing.metadata?.email_sent !== true) {
      const email = buildSubscriptionBillingEmail({
        kind,
        planTitle: params.planTitle,
        periodEndLabel: params.periodEndIso,
      })
      const sent = await sendBillingEmailToAdmins(companiesId, email)
      if (sent) await markBillingEmailSent(existing.id)
    }
    return
  }

  const email = buildSubscriptionBillingEmail({
    kind,
    planTitle: params.planTitle,
    periodEndLabel: params.periodEndIso,
  })

  const notificationId = await createInAppBillingNotification(
    companiesId,
    email.inAppTitle,
    email.inAppBody,
    {
      dedupe_key: dedupeKey,
      email_kind: kind,
      plan_title: params.planTitle,
      period_end: params.periodEndIso || null,
      stripe_event_id: params.stripeEventId || null,
    }
  )

  const sent = await sendBillingEmailToAdmins(companiesId, email)
  if (sent && notificationId) {
    await markBillingEmailSent(notificationId)
  } else if (notificationId) {
    logger.info('[subscription.billing] Notificação in-app criada; e-mail pendente ou não configurado', {
      companiesId,
      dedupeKey,
    })
  }
}

export async function notifySubscriptionEndedFromStripe(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  endReason: SubscriptionEndReason,
  stripeEventId?: string
): Promise<void> {
  const companiesId = await resolveTenantIdFromStripeSubscription(stripe, subscription)
  if (!companiesId) return

  const planId = inferPlanFromStripeSubscription(subscription)
  const planTitle = getPlanCatalogEntry(planId).title
  const periodEndIso =
    unixToIso(subscription.items?.data?.[0]?.current_period_end) ||
    unixToIso((subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end)

  const kind = endReasonToEmailKind(endReason)
  const dedupeKey = `ended:${subscription.id}:${periodEndIso || 'unknown'}:${kind}`

  await notifySubscriptionEnded({
    companiesId,
    kind,
    dedupeKey,
    planTitle,
    periodEndIso,
    stripeEventId,
  })
}

/** Detecta fim de ciclo no banco (ex.: testes manuais) e notifica admins uma vez. */
export async function maybeNotifyLocalSubscriptionPeriodEnded(companiesId: string): Promise<void> {
  const { data: sub, error } = await supabase
    .from('tb_subscriptions')
    .select('plan, status, current_period_end, canceled_at, stripe_subscription_id')
    .eq('companies_id', companiesId)
    .maybeSingle()

  if (error || !sub || isFreePlanId(sub.plan)) return

  const periodEndIso = sub.current_period_end || null
  if (!periodEndIso) return

  const periodEndMs = new Date(periodEndIso).getTime()
  if (Number.isNaN(periodEndMs) || periodEndMs > Date.now()) return

  const cancelAtPeriodEnd = isCancelAtPeriodEnd(sub)
  const status = String(sub.status || 'inactive')
  const kind: SubscriptionBillingEmailKind =
    cancelAtPeriodEnd
      ? 'ended_user_cancel'
      : status === 'unpaid'
        ? 'ended_payment_failed'
        : 'ended_user_cancel'

  const planTitle = getPlanCatalogEntry(normalizePlanId(sub.plan)).title
  const dedupeKey = `ended:local:${companiesId}:${periodEndIso}:${kind}`

  await notifySubscriptionEnded({
    companiesId,
    kind,
    dedupeKey,
    planTitle,
    periodEndIso,
  })

  if (!isFreePlanId(sub.plan)) {
    await applyStripeSubscriptionEnd(companiesId)
  }
}
