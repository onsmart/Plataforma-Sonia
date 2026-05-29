import { describe, expect, it } from 'vitest'
import { buildSubscriptionBillingEmail } from '../services/billing/subscription-billing-email.template'
import {
  endReasonToEmailKind,
  inferSubscriptionEndReason,
} from '../services/billing/subscription-billing-notify.service'

describe('subscription-billing-email.template', () => {
  it('gera assunto de encerramento por cancelamento', () => {
    const { subject, inAppTitle } = buildSubscriptionBillingEmail({
      kind: 'ended_user_cancel',
      planTitle: 'Sonia Receptiva — Growth',
      periodEndLabel: '2026-05-29T12:00:00.000Z',
    })
    expect(subject).toContain('Assinatura encerrada')
    expect(subject).toContain('Growth')
    expect(inAppTitle).toBe('Assinatura encerrada')
  })

  it('gera assunto de encerramento por falha de pagamento', () => {
    const { subject, inAppBody } = buildSubscriptionBillingEmail({
      kind: 'ended_payment_failed',
      planTitle: 'Sonia Receptiva — Growth',
      periodEndLabel: '2026-05-29T12:00:00.000Z',
    })
    expect(subject).toContain('falha de pagamento')
    expect(inAppBody).toMatch(/plano gratuito/i)
  })
})

describe('inferSubscriptionEndReason', () => {
  it('identifica cancelamento solicitado', () => {
    expect(
      inferSubscriptionEndReason({
        id: 'sub_1',
        cancel_at_period_end: true,
        status: 'canceled',
      } as any)
    ).toBe('user_cancel')
    expect(endReasonToEmailKind('user_cancel')).toBe('ended_user_cancel')
  })

  it('identifica falha de pagamento', () => {
    expect(
      inferSubscriptionEndReason({
        id: 'sub_1',
        status: 'unpaid',
        cancellation_details: { reason: 'payment_failed' },
      } as any)
    ).toBe('payment_failed')
    expect(endReasonToEmailKind('payment_failed')).toBe('ended_payment_failed')
  })
})
