/**
 * Catálogo oficial de planos — Plataforma Sonia (2026).
 * Preços Stripe ainda opcionais (env STRIPE_PRICE_*); limites de conversa conforme tabela comercial.
 */

export type PlanProductLine = 'rec' | 'com'
export type PlanTier = 'start' | 'growth' | 'enterprise'

export type PlanId =
  | 'rec_start'
  | 'rec_growth'
  | 'rec_enterprise'
  | 'com_start'
  | 'com_growth'
  | 'com_enterprise'

export interface PlanCatalogEntry {
  id: PlanId
  code: string
  productLine: PlanProductLine
  tier: PlanTier
  commercialLevel: string
  title: string
  description: string
  /** Atendimentos = contatos distintos com conversa no mês (inbound e/ou outbound). null = sob medida / ilimitado operacional */
  monthlyConversations: number | null
  volumeLabel: string
  usageCriterion: string
  agents: number | null
  messages: number | null
  hasRAG: boolean
  hasSSO: boolean
  hasGovernance: boolean
  hasCustomDeployment: boolean
  /** IA ativa / SDR / campanhas outbound */
  hasActiveOutbound: boolean
  stripePriceKeyMonthly: string
  stripePriceKeyYearly: string
  priceDisplayMonthly: string
  priceDisplayYearly: string
}

const OFFICIAL_PLAN_IDS: readonly PlanId[] = [
  'rec_start',
  'rec_growth',
  'rec_enterprise',
  'com_start',
  'com_growth',
  'com_enterprise',
] as const

export function isOfficialPlanId(value: string): value is PlanId {
  return (OFFICIAL_PLAN_IDS as readonly string[]).includes(value)
}

/** Aceita apenas os 6 IDs oficiais (rec_* / com_*). Valores desconhecidos → rec_start. */
export function normalizePlanId(raw: string | null | undefined): PlanId {
  const value = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')

  if (isOfficialPlanId(value)) {
    return value
  }

  return 'rec_start'
}

export const SONIA_PLANS: PlanCatalogEntry[] = [
  {
    id: 'rec_start',
    code: 'REC_START',
    productLine: 'rec',
    tier: 'start',
    commercialLevel: 'Start',
    title: 'Sonia Receptiva — Start',
    description: 'IA receptiva: inbound, FAQ e triagem. Sem operação SDR/ativa.',
    monthlyConversations: 200,
    volumeLabel: 'Até 200 atendimentos/mês',
    usageCriterion: 'Atendimentos (sessões de atendimento no mês)',
    agents: 1,
    messages: null,
    hasRAG: false,
    hasSSO: false,
    hasGovernance: false,
    hasCustomDeployment: false,
    hasActiveOutbound: false,
    stripePriceKeyMonthly: 'price_rec_start_monthly',
    stripePriceKeyYearly: 'price_rec_start_yearly',
    priceDisplayMonthly: 'A definir',
    priceDisplayYearly: 'A definir',
  },
  {
    id: 'rec_growth',
    code: 'REC_GROWTH',
    productLine: 'rec',
    tier: 'growth',
    commercialLevel: 'Growth',
    title: 'Sonia Receptiva — Growth',
    description: 'IA receptiva com fluxos, CRM/API e maior volume.',
    monthlyConversations: 1500,
    volumeLabel: '201 a 1.500 atendimentos/mês',
    usageCriterion: 'Atendimentos (sessões de atendimento no mês)',
    agents: 3,
    messages: null,
    hasRAG: true,
    hasSSO: false,
    hasGovernance: false,
    hasCustomDeployment: false,
    hasActiveOutbound: false,
    stripePriceKeyMonthly: 'price_rec_growth_monthly',
    stripePriceKeyYearly: 'price_rec_growth_yearly',
    priceDisplayMonthly: 'A definir',
    priceDisplayYearly: 'A definir',
  },
  {
    id: 'rec_enterprise',
    code: 'REC_ENTERPRISE',
    productLine: 'rec',
    tier: 'enterprise',
    commercialLevel: 'Enterprise',
    title: 'Sonia Receptiva — Enterprise',
    description: 'Operação receptiva multicanal, governança e SLA.',
    monthlyConversations: null,
    volumeLabel: 'Acima de 1.500 (sob medida)',
    usageCriterion: 'Unidade customizada',
    agents: null,
    messages: null,
    hasRAG: true,
    hasSSO: true,
    hasGovernance: true,
    hasCustomDeployment: true,
    hasActiveOutbound: false,
    stripePriceKeyMonthly: 'price_rec_enterprise_monthly',
    stripePriceKeyYearly: 'price_rec_enterprise_yearly',
    priceDisplayMonthly: 'Sob proposta',
    priceDisplayYearly: 'Sob proposta',
  },
  {
    id: 'com_start',
    code: 'COM_START',
    productLine: 'com',
    tier: 'start',
    commercialLevel: 'Start',
    title: 'Sonia Completa — Start',
    description: 'IA receptiva + ativa (cadências SDR leves) no mesmo pacote.',
    monthlyConversations: 200,
    volumeLabel: 'Até 200 atendimentos + contatos/mês',
    usageCriterion: 'Atendimentos (sessões de atendimento no mês)',
    agents: 1,
    messages: null,
    hasRAG: false,
    hasSSO: false,
    hasGovernance: false,
    hasCustomDeployment: false,
    hasActiveOutbound: true,
    stripePriceKeyMonthly: 'price_com_start_monthly',
    stripePriceKeyYearly: 'price_com_start_yearly',
    priceDisplayMonthly: 'A definir',
    priceDisplayYearly: 'A definir',
  },
  {
    id: 'com_growth',
    code: 'COM_GROWTH',
    productLine: 'com',
    tier: 'growth',
    commercialLevel: 'Growth',
    title: 'Sonia Completa — Growth',
    description: 'IA completa com prospecção ativa e automações avançadas.',
    monthlyConversations: 1500,
    volumeLabel: '201 a 1.500 atendimentos + contatos/mês',
    usageCriterion: 'Atendimentos (sessões de atendimento no mês)',
    agents: 5,
    messages: null,
    hasRAG: true,
    hasSSO: false,
    hasGovernance: false,
    hasCustomDeployment: false,
    hasActiveOutbound: true,
    stripePriceKeyMonthly: 'price_com_growth_monthly',
    stripePriceKeyYearly: 'price_com_growth_yearly',
    priceDisplayMonthly: 'A definir',
    priceDisplayYearly: 'A definir',
  },
  {
    id: 'com_enterprise',
    code: 'COM_ENTERPRISE',
    productLine: 'com',
    tier: 'enterprise',
    commercialLevel: 'Enterprise',
    title: 'Sonia Completa — Enterprise',
    description: 'Operação ativa + receptiva em escala, governança e SLA dedicado.',
    monthlyConversations: null,
    volumeLabel: 'Acima de 1.500 (sob medida)',
    usageCriterion: 'Unidade / outcome customizado',
    agents: null,
    messages: null,
    hasRAG: true,
    hasSSO: true,
    hasGovernance: true,
    hasCustomDeployment: true,
    hasActiveOutbound: true,
    stripePriceKeyMonthly: 'price_com_enterprise_monthly',
    stripePriceKeyYearly: 'price_com_enterprise_yearly',
    priceDisplayMonthly: 'Sob proposta',
    priceDisplayYearly: 'Sob proposta',
  },
]

export const SONIA_PLAN_BY_ID: Record<PlanId, PlanCatalogEntry> = SONIA_PLANS.reduce(
  (acc, plan) => {
    acc[plan.id] = plan
    return acc
  },
  {} as Record<PlanId, PlanCatalogEntry>
)

export function getPlanCatalogEntry(planId: string | null | undefined): PlanCatalogEntry {
  return SONIA_PLAN_BY_ID[normalizePlanId(planId)]
}

export function inferPlanIdFromStripePriceKey(priceKey: string): PlanId {
  const normalized = String(priceKey || '').toLowerCase()
  const match = SONIA_PLANS.find(
    (p) =>
      p.stripePriceKeyMonthly === normalized ||
      p.stripePriceKeyYearly === normalized ||
      normalized.includes(p.id.replace('_', ''))
  )
  return match?.id || 'rec_start'
}

export function planLimitsFromCatalog(planId: string | null | undefined) {
  const entry = getPlanCatalogEntry(planId)
  return {
    agents: entry.agents,
    messages: entry.messages,
    conversations: entry.monthlyConversations,
    hasRAG: entry.hasRAG,
    hasSSO: entry.hasSSO,
    hasGovernance: entry.hasGovernance,
    hasCustomDeployment: entry.hasCustomDeployment,
    hasActiveOutbound: entry.hasActiveOutbound,
    productLine: entry.productLine,
  }
}

/** Self-serve Stripe checkout: apenas REC Start e REC Growth no MVP receptivo. */
export function isStripeCheckoutAvailable(planId: PlanId): boolean {
  return planId === 'rec_start' || planId === 'rec_growth'
}

export function isSalesAssistedPlan(planId: PlanId): boolean {
  return planId === 'rec_enterprise' || planId === 'com_enterprise'
}

const DISPLAY_PRICE_ENV: Partial<Record<PlanId, { monthly?: string; yearly?: string }>> = {
  rec_start: {
    monthly: process.env.PLAN_DISPLAY_REC_START_MONTHLY,
    yearly: process.env.PLAN_DISPLAY_REC_START_YEARLY,
  },
  rec_growth: {
    monthly: process.env.PLAN_DISPLAY_REC_GROWTH_MONTHLY,
    yearly: process.env.PLAN_DISPLAY_REC_GROWTH_YEARLY,
  },
  rec_enterprise: {
    monthly: process.env.PLAN_DISPLAY_REC_ENTERPRISE_MONTHLY,
    yearly: process.env.PLAN_DISPLAY_REC_ENTERPRISE_YEARLY,
  },
  com_start: {
    monthly: process.env.PLAN_DISPLAY_COM_START_MONTHLY,
    yearly: process.env.PLAN_DISPLAY_COM_START_YEARLY,
  },
  com_growth: {
    monthly: process.env.PLAN_DISPLAY_COM_GROWTH_MONTHLY,
    yearly: process.env.PLAN_DISPLAY_COM_GROWTH_YEARLY,
  },
  com_enterprise: {
    monthly: process.env.PLAN_DISPLAY_COM_ENTERPRISE_MONTHLY,
    yearly: process.env.PLAN_DISPLAY_COM_ENTERPRISE_YEARLY,
  },
}

export function getPlanForApi(plan: PlanCatalogEntry) {
  const envPrices = DISPLAY_PRICE_ENV[plan.id]
  return {
    ...plan,
    priceDisplayMonthly: envPrices?.monthly?.trim() || plan.priceDisplayMonthly,
    priceDisplayYearly: envPrices?.yearly?.trim() || plan.priceDisplayYearly,
    checkout_available: isStripeCheckoutAvailable(plan.id),
    sales_assisted: isSalesAssistedPlan(plan.id),
  }
}

export function getPlansCatalogForApi() {
  return SONIA_PLANS.map(getPlanForApi)
}
