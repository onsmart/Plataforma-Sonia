export type PlanId =
  | 'free'
  | 'rec_start'
  | 'rec_growth'
  | 'rec_enterprise'
  | 'com_start'
  | 'com_growth'
  | 'com_enterprise'

const OFFICIAL_PLAN_IDS: readonly PlanId[] = [
  'free',
  'rec_start',
  'rec_growth',
  'rec_enterprise',
  'com_start',
  'com_growth',
  'com_enterprise',
]

export function normalizePlanId(raw?: string | null): PlanId {
  const value = String(raw || 'free')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
  if (value === 'free') return 'free'
  if (value === 'enterprise' || value === 'pro' || value === 'plus') {
    if (value === 'enterprise') return 'com_enterprise'
    if (value === 'plus') return 'com_growth'
    return 'rec_start'
  }
  if ((OFFICIAL_PLAN_IDS as readonly string[]).includes(value)) {
    return value as PlanId
  }
  return 'free'
}

export function planHasRag(planId: string): boolean {
  const id = normalizePlanId(planId)
  return id === 'rec_growth' || id === 'rec_enterprise' || id === 'com_growth' || id === 'com_enterprise'
}

export function planTitle(planId: string): string {
  const id = normalizePlanId(planId)
  if (id === 'free') return 'Plano gratuito'
  const titles: Record<Exclude<PlanId, 'free'>, string> = {
    rec_start: 'Sonia Receptiva — Start',
    rec_growth: 'Sonia Receptiva — Growth',
    rec_enterprise: 'Sonia Receptiva — Enterprise',
    com_start: 'Sonia Completa — Start',
    com_growth: 'Sonia Completa — Growth',
    com_enterprise: 'Sonia Completa — Enterprise',
  }
  return titles[id]
}
