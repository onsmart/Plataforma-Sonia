import { describe, expect, it } from 'vitest'
import { buildAtendimentoLimitEmail } from '../services/atendimento-limit-email.template'

describe('buildAtendimentoLimitEmail', () => {
  it('inclui branding Onsmart, resumo de uso e CTAs', () => {
    const { subject, text, html } = buildAtendimentoLimitEmail({
      planTitle: 'Sonia Receptiva — Growth',
      used: 1500,
      limit: 1500,
      billingMonth: '2026-05-01',
    })

    expect(subject).toContain('Sonia Receptiva — Growth')
    expect(text).toContain('Onsmart.ai')
    expect(text).toContain('1500 de 1500')
    expect(html).toContain('www.onsmart.ai')
    expect(html).toContain('Plataforma Sonia')
    expect(html).toContain('1500 / 1500')
    expect(html).toContain('100%')
    expect(html).toContain('Limite atingido')
  })
})
