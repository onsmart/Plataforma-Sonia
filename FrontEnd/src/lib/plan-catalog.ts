export type PlanId =
  | 'rec_start'
  | 'rec_growth'
  | 'rec_enterprise'
  | 'com_start'
  | 'com_growth'
  | 'com_enterprise'

const OFFICIAL_PLAN_IDS: readonly PlanId[] = [
  'rec_start',
  'rec_growth',
  'rec_enterprise',
  'com_start',
  'com_growth',
  'com_enterprise',
]

export function normalizePlanId(raw?: string | null): PlanId {
  const value = String(raw || 'rec_start')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
  if ((OFFICIAL_PLAN_IDS as readonly string[]).includes(value)) {
    return value as PlanId
  }
  return 'rec_start'
}

export function planHasRag(planId: string): boolean {
  const id = normalizePlanId(planId)
  return id === 'rec_growth' || id === 'rec_enterprise' || id === 'com_growth' || id === 'com_enterprise'
}

export function planTitle(planId: string): string {
  const id = normalizePlanId(planId)
  const titles: Record<PlanId, string> = {
    rec_start: 'Sonia Receptiva — Start',
    rec_growth: 'Sonia Receptiva — Growth',
    rec_enterprise: 'Sonia Receptiva — Enterprise',
    com_start: 'Sonia Completa — Start',
    com_growth: 'Sonia Completa — Growth',
    com_enterprise: 'Sonia Completa — Enterprise',
  }
  return titles[id]
}
