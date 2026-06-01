import { describe, expect, it } from 'vitest'
import {
  normalizePlanId,
  getPlanCatalogEntry,
  SONIA_PLANS,
  isPlanComingSoon,
  isStripeCheckoutAvailable,
  getPlanForApi,
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

  it('plano gratuito não concede atendimentos nem agentes', () => {
    const free = getPlanCatalogEntry('free')
    expect(free.id).toBe('free')
    expect(free.title).toBe('Plano gratuito')
    expect(free.monthlyConversations).toBe(0)
    expect(free.agents).toBe(0)
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

  it('Start receptivo: FAQ/triagem/handoff sem RAG, fluxos ou CRM', () => {
    const start = getPlanCatalogEntry('rec_start')
    expect(start.hasRAG).toBe(false)
    expect(start.hasFlows).toBe(false)
    expect(start.hasCrmApi).toBe(false)
  })

  it('Growth receptivo: fluxos, CRM/API e RAG', () => {
    const growth = getPlanCatalogEntry('rec_growth')
    expect(growth.hasRAG).toBe(true)
    expect(growth.hasFlows).toBe(true)
    expect(growth.hasCrmApi).toBe(true)
  })

  it('checkout self-serve apenas rec_start e rec_growth', () => {
    expect(isStripeCheckoutAvailable('rec_start')).toBe(true)
    expect(isStripeCheckoutAvailable('rec_growth')).toBe(true)
    expect(isStripeCheckoutAvailable('rec_enterprise')).toBe(false)
    expect(isStripeCheckoutAvailable('com_start')).toBe(false)
  })

  it('demais planos pagos aparecem como em breve na API', () => {
    expect(isPlanComingSoon('rec_enterprise')).toBe(true)
    expect(isPlanComingSoon('com_growth')).toBe(true)
    expect(isPlanComingSoon('rec_start')).toBe(false)
    expect(isPlanComingSoon('rec_growth')).toBe(false)

    const growthApi = getPlanForApi(getPlanCatalogEntry('rec_growth'))
    expect(growthApi.coming_soon).toBe(false)
    expect(growthApi.checkout_available).toBe(true)

    const enterpriseApi = getPlanForApi(getPlanCatalogEntry('rec_enterprise'))
    expect(enterpriseApi.coming_soon).toBe(true)
  })
})
