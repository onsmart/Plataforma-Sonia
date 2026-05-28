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

  it('mapeia IDs legados para planos pagos e free para desconhecido', () => {
    expect(normalizePlanId('pro')).toBe('rec_start')
    expect(normalizePlanId('plus')).toBe('com_growth')
    expect(normalizePlanId('enterprise')).toBe('com_enterprise')
    expect(normalizePlanId('free')).toBe('free')
    expect(normalizePlanId('xyz_invalid')).toBe('rec_start')
    expect(normalizePlanId('rec_growth')).toBe('rec_growth')
    expect(normalizePlanId('COM_GROWTH')).toBe('com_growth')
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
