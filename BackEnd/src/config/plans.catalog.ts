/**
 * Catálogo oficial de planos — Plataforma Sonia (2026).
 * Preços Stripe ainda opcionais (env STRIPE_PRICE_*); limites de conversa conforme tabela comercial.
 */

export type PlanProductLine = 'rec' | 'com'
export type PlanTier = 'start' | 'growth' | 'enterprise'

export type PlanId =
  | 'free'
  | 'rec_start'
  | 'rec_growth'
  | 'rec_enterprise'
  | 'com_start'
  | 'com_growth'
  | 'com_enterprise'

/** Plano efetivo sem assinatura paga (não aparece no catálogo comercial Stripe). */
export const FREE_PLAN_ID = 'free' as const

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
  'free',
  'rec_start',
  'rec_growth',
  'rec_enterprise',
  'com_start',
  'com_growth',
  'com_enterprise',
] as const

const PAID_CATALOG_PLAN_IDS: readonly PlanId[] = [
  'rec_start',
  'rec_growth',
  'rec_enterprise',
  'com_start',
  'com_growth',
  'com_enterprise',
] as const

export function isPaidSubscriptionStatus(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due'
}

export type SubscriptionAccessRow = {
  plan?: string | null
  status?: string | null
  current_period_end?: string | null
  canceled_at?: string | null
}

export type PaidAccessOptions = {
  cancelAtPeriodEnd?: boolean
  usageLimitReached?: boolean
}

/** Renovação desativada no Stripe (cancel_at_period_end) — ainda dentro do ciclo pago. */
export function isCancelAtPeriodEnd(row: {
  status?: string | null
  canceled_at?: string | null
}): boolean {
  const status = String(row.status || 'inactive')
  return Boolean(row.canceled_at?.trim()) && (status === 'active' || status === 'trialing')
}

/** Benefícios do plano pago enquanto o ciclo vigente não expirou (inclui cancelamento agendado). */
export function hasEffectivePaidAccess(
  row: SubscriptionAccessRow,
  options?: PaidAccessOptions
): boolean {
  const plan = normalizePlanId(row.plan)
  if (isFreePlanId(plan)) return false

  const status = String(row.status || 'inactive')
  const periodEndMs = row.current_period_end
    ? new Date(row.current_period_end).getTime()
    : Number.NaN
  const periodEnded = !Number.isNaN(periodEndMs) && periodEndMs <= Date.now()

  if (periodEnded) return false

  let hasBaseAccess = false
  if (isPaidSubscriptionStatus(status)) {
    hasBaseAccess = true
  } else if (!Number.isNaN(periodEndMs) && periodEndMs > Date.now() && status === 'canceled') {
    hasBaseAccess = true
  }

  if (!hasBaseAccess) return false

  const cancelScheduled = options?.cancelAtPeriodEnd ?? isCancelAtPeriodEnd(row)
  if (cancelScheduled && options?.usageLimitReached) {
    return false
  }

  return true
}

export function isFreePlanId(planId: string | null | undefined): boolean {
  return String(planId || '').toLowerCase() === FREE_PLAN_ID
}

export function isOfficialPlanId(value: string): value is PlanId {
  return (OFFICIAL_PLAN_IDS as readonly string[]).includes(value)
}

const LEGACY_PLAN_MAP: Record<string, PlanId> = {
  pro: 'rec_start',
  plus: 'com_growth',
  enterprise: 'com_enterprise',
}

/** IDs de plano pagos (rec_* / com_*). `free` e legados são normalizados para uso em catálogo pago. */
export function normalizePlanId(raw: string | null | undefined): PlanId {
  const value = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')

  if (value === FREE_PLAN_ID) {
    return FREE_PLAN_ID
  }

  if (LEGACY_PLAN_MAP[value]) {
    return LEGACY_PLAN_MAP[value]
  }

  if ((PAID_CATALOG_PLAN_IDS as readonly string[]).includes(value)) {
    return value as PlanId
  }

  return 'rec_start'
}

export const FREE_PLAN_LIMITS = {
  agents: 0,
  messages: 0,
  conversations: 0,
  hasRAG: false,
  hasSSO: false,
  hasGovernance: false,
  hasCustomDeployment: false,
  hasActiveOutbound: false,
  productLine: 'rec' as PlanProductLine,
}

/** Entrada de catálogo para contas sem assinatura paga (não listada em SONIA_PLANS / checkout). */
export const FREE_PLAN_CATALOG: PlanCatalogEntry = {
  id: 'free',
  code: 'FREE',
  productLine: 'rec',
  tier: 'start',
  commercialLevel: 'Gratuito',
  title: 'Plano gratuito',
  description: 'Conta sem assinatura paga. Contrate um plano para liberar atendimentos.',
  monthlyConversations: 0,
  volumeLabel: 'Nenhum atendimento incluso',
  usageCriterion: 'Contrate um plano para iniciar atendimentos',
  agents: 0,
  messages: 0,
  hasRAG: false,
  hasSSO: false,
  hasGovernance: false,
  hasCustomDeployment: false,
  hasActiveOutbound: false,
  stripePriceKeyMonthly: '',
  stripePriceKeyYearly: '',
  priceDisplayMonthly: 'Gratuito',
  priceDisplayYearly: 'Gratuito',
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
  const normalized = normalizePlanId(planId)
  if (isFreePlanId(normalized)) {
    return FREE_PLAN_CATALOG
  }
  return SONIA_PLAN_BY_ID[normalized as Exclude<PlanId, 'free'>]
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

const DISPLAY_PRICE_ENV: Partial<Record<PlanId, string>> = {
  rec_start:
    process.env.PLAN_DISPLAY_REC_START?.trim() ||
    process.env.PLAN_DISPLAY_REC_START_MONTHLY?.trim(),
  rec_growth:
    process.env.PLAN_DISPLAY_REC_GROWTH?.trim() ||
    process.env.PLAN_DISPLAY_REC_GROWTH_MONTHLY?.trim(),
  rec_enterprise:
    process.env.PLAN_DISPLAY_REC_ENTERPRISE?.trim() ||
    process.env.PLAN_DISPLAY_REC_ENTERPRISE_MONTHLY?.trim(),
  com_start:
    process.env.PLAN_DISPLAY_COM_START?.trim() ||
    process.env.PLAN_DISPLAY_COM_START_MONTHLY?.trim(),
  com_growth:
    process.env.PLAN_DISPLAY_COM_GROWTH?.trim() ||
    process.env.PLAN_DISPLAY_COM_GROWTH_MONTHLY?.trim(),
  com_enterprise:
    process.env.PLAN_DISPLAY_COM_ENTERPRISE?.trim() ||
    process.env.PLAN_DISPLAY_COM_ENTERPRISE_MONTHLY?.trim(),
}

/** Ciclo comercial atual: somente assinatura mensal no checkout Stripe. */
export const BILLING_INTERVAL = 'month' as const

export function getPlanForApi(plan: PlanCatalogEntry) {
  const displayMonthly = DISPLAY_PRICE_ENV[plan.id] || plan.priceDisplayMonthly
  return {
    id: plan.id,
    code: plan.code,
    productLine: plan.productLine,
    tier: plan.tier,
    commercialLevel: plan.commercialLevel,
    title: plan.title,
    description: plan.description,
    monthlyConversations: plan.monthlyConversations,
    volumeLabel: plan.volumeLabel,
    usageCriterion: plan.usageCriterion,
    agents: plan.agents,
    messages: plan.messages,
    hasRAG: plan.hasRAG,
    hasSSO: plan.hasSSO,
    hasGovernance: plan.hasGovernance,
    hasCustomDeployment: plan.hasCustomDeployment,
    hasActiveOutbound: plan.hasActiveOutbound,
    priceDisplayMonthly: displayMonthly,
    billing_interval: BILLING_INTERVAL,
    stripe_price_key: plan.stripePriceKeyMonthly,
    checkout_available: isStripeCheckoutAvailable(plan.id),
    sales_assisted: isSalesAssistedPlan(plan.id),
  }
}

export function getPlansCatalogForApi() {
  return SONIA_PLANS.map(getPlanForApi)
}

export function getFreePlanDisplay() {
  return {
    id: FREE_PLAN_ID,
    code: 'FREE',
    title: 'Plano gratuito',
    productLine: 'rec' as PlanProductLine,
    status: 'inactive' as const,
    limits: FREE_PLAN_LIMITS,
  }
}
