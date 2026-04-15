import { describe, expect, it } from 'vitest'
import { computeCustomerCareWindow } from '../services/integrations/whatsapp/whatsapp-session-window'

describe('computeCustomerCareWindow', () => {
  it('sem inbound: conservador — fora da janela', () => {
    const r = computeCustomerCareWindow({ lastInboundAt: null, now: new Date('2026-01-10T12:00:00Z') })
    expect(r.insideWindow).toBe(false)
    expect(r.conservativeUnknown).toBe(true)
    expect(r.expiresAt).toBeNull()
  })

  it('dentro de 24h apos ultimo inbound', () => {
    const last = new Date('2026-01-10T10:00:00Z')
    const now = new Date('2026-01-10T11:00:00Z')
    const r = computeCustomerCareWindow({ lastInboundAt: last, now })
    expect(r.insideWindow).toBe(true)
    expect(r.conservativeUnknown).toBe(false)
    expect(r.expiresAt?.toISOString()).toBe(new Date(last.getTime() + 24 * 60 * 60 * 1000).toISOString())
  })

  it('apos expiracao: fora da janela', () => {
    const last = new Date('2026-01-10T10:00:00Z')
    const now = new Date('2026-01-11T10:01:00Z')
    const r = computeCustomerCareWindow({ lastInboundAt: last, now })
    expect(r.insideWindow).toBe(false)
    expect(r.conservativeUnknown).toBe(false)
  })
})
