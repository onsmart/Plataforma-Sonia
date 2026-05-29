import { describe, expect, it } from 'vitest'
import { hasEffectivePaidAccess } from '../config/plans.catalog'
import {
  buildSubscriptionPatchFromStripe,
  isRealStripeSubscriptionId,
  isSubscriptionPeriodEnded,
  resolveSubscriptionAccessState,
} from '../services/billing/stripe-subscription-sync.service'

describe('hasEffectivePaidAccess', () => {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  it('libera rec_start com status active', () => {
    expect(hasEffectivePaidAccess({ plan: 'rec_start', status: 'active' })).toBe(true)
  })

  it('libera trialing', () => {
    expect(hasEffectivePaidAccess({ plan: 'rec_growth', status: 'trialing' })).toBe(true)
  })

  it('libera cancelado dentro do periodo pago', () => {
    expect(
      hasEffectivePaidAccess({
        plan: 'rec_start',
        status: 'canceled',
        current_period_end: future,
      })
    ).toBe(true)
  })

  it('bloqueia free/inactive', () => {
    expect(hasEffectivePaidAccess({ plan: 'free', status: 'inactive' })).toBe(false)
  })

  it('bloqueia cancelado apos fim do periodo', () => {
    expect(
      hasEffectivePaidAccess({
        plan: 'rec_start',
        status: 'canceled',
        current_period_end: past,
      })
    ).toBe(false)
  })

  it('bloqueia cancelamento agendado quando limite de atendimentos esgotou', () => {
    expect(
      hasEffectivePaidAccess(
        {
          plan: 'rec_start',
          status: 'active',
          current_period_end: future,
          canceled_at: new Date().toISOString(),
        },
        { cancelAtPeriodEnd: true, usageLimitReached: true }
      )
    ).toBe(false)
  })

  it('mantem acesso com cancelamento agendado dentro do ciclo e com saldo de atendimentos', () => {
    expect(
      hasEffectivePaidAccess(
        {
          plan: 'rec_start',
          status: 'active',
          current_period_end: future,
          canceled_at: new Date().toISOString(),
        },
        { cancelAtPeriodEnd: true, usageLimitReached: false }
      )
    ).toBe(true)
  })
})

describe('buildSubscriptionPatchFromStripe', () => {
  const subscriptionItems = {
    object: 'list' as const,
    has_more: false,
    url: '',
    data: [
      {
        id: 'si_123',
        object: 'subscription_item' as const,
        current_period_start: 1_699_000_000,
        current_period_end: 1_701_000_000,
      },
    ],
  }

  it('preserva datas do ciclo e cancelamento agendado', () => {
    const patch = buildSubscriptionPatchFromStripe({
      id: 'sub_123',
      object: 'subscription',
      status: 'active',
      cancel_at_period_end: true,
      canceled_at: 1_700_000_000,
      customer: 'cus_123',
      metadata: { plan: 'rec_start' },
      items: subscriptionItems,
    } as any)

    expect(patch.status).toBe('active')
    expect(patch.plan).toBe('rec_start')
    expect(patch.current_period_start).toBeTruthy()
    expect(patch.current_period_end).toBeTruthy()
    expect(patch.canceled_at).toBeTruthy()
  })

  it('limpa canceled_at quando assinatura reativa', () => {
    const patch = buildSubscriptionPatchFromStripe({
      id: 'sub_123',
      object: 'subscription',
      status: 'active',
      cancel_at_period_end: false,
      canceled_at: null,
      customer: 'cus_123',
      metadata: { plan: 'rec_growth' },
      items: subscriptionItems,
    } as any)

    expect(patch.canceled_at).toBeNull()
  })
})

describe('subscription access state & period', () => {
  const past = new Date(Date.now() - 60_000).toISOString()
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  it('resolve cancel_scheduled vs ended vs active', () => {
    expect(
      resolveSubscriptionAccessState({
        has_paid_access: true,
        cancel_at_period_end: true,
        has_stripe_subscription: true,
        current_period_end: future,
      })
    ).toBe('cancel_scheduled')

    expect(
      resolveSubscriptionAccessState({
        has_paid_access: false,
        cancel_at_period_end: true,
        has_stripe_subscription: true,
        current_period_end: past,
        catalog_plan: 'rec_growth',
      })
    ).toBe('ended')

    expect(
      resolveSubscriptionAccessState({
        has_paid_access: true,
        cancel_at_period_end: false,
        has_stripe_subscription: true,
        current_period_end: future,
      })
    ).toBe('active')
  })

  it('detecta periodo expirado', () => {
    expect(isSubscriptionPeriodEnded(past)).toBe(true)
    expect(isSubscriptionPeriodEnded(future)).toBe(false)
  })

  it('valida ids reais do Stripe', () => {
    expect(isRealStripeSubscriptionId('sub_1TcPucBoK4Em3YqtbRP6xgif')).toBe(true)
    expect(isRealStripeSubscriptionId('free_local_abc')).toBe(false)
    expect(isRealStripeSubscriptionId('')).toBe(false)
  })
})
