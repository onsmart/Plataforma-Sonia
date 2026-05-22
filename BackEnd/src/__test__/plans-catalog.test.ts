import { describe, expect, it } from 'vitest'
import {
  normalizePlanId,
  getPlanCatalogEntry,
  SONIA_PLANS,
} from '../config/plans.catalog'

describe('plans.catalog', () => {
  it('expõe 6 planos oficiais', () => {
    expect(SONIA_PLANS).toHaveLength(6)
    expect(SONIA_PLANS.map((p) => p.id)).toEqual([
      'rec_start',
      'rec_growth',
      'rec_enterprise',
      'com_start',
      'com_growth',
      'com_enterprise',
    ])
  })

  it('mapeia planos legados', () => {
    expect(normalizePlanId('pro')).toBe('rec_start')
    expect(normalizePlanId('plus')).toBe('com_growth')
    expect(normalizePlanId('enterprise')).toBe('com_enterprise')
  })

  it('define limites de conversa start e growth', () => {
    expect(getPlanCatalogEntry('rec_start').monthlyConversations).toBe(200)
    expect(getPlanCatalogEntry('com_growth').monthlyConversations).toBe(1500)
    expect(getPlanCatalogEntry('rec_enterprise').monthlyConversations).toBeNull()
  })

  it('somente linha completa tem outbound ativo', () => {
    expect(getPlanCatalogEntry('rec_start').hasActiveOutbound).toBe(false)
    expect(getPlanCatalogEntry('com_start').hasActiveOutbound).toBe(true)
  })
})
