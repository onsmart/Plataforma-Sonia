import { describe, expect, it } from 'vitest'
import { hasEffectivePaidAccess } from '../config/plans.catalog'
import { buildSubscriptionPatchFromStripe } from '../services/billing/stripe-subscription-sync.service'

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
