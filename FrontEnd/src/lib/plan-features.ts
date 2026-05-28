import type { PlanId } from './plan-catalog'

export type PlanFeatureItem = {
  id: string
  label: string
  enabled: boolean
}

type FeatureKey =
  | 'whatsapp'
  | 'agents'
  | 'conversations'
  | 'rag'
  | 'governance'
  | 'outbound'
  | 'sso'

const FEATURE_LABELS: Record<FeatureKey, string> = {
  whatsapp: 'WhatsApp e Inbox',
  agents: 'Agentes de IA',
  conversations: 'Atendimentos no mês',
  rag: 'Base de conhecimento (RAG)',
  governance: 'Governança avançada',
  outbound: 'Operação ativa / SDR',
  sso: 'SSO corporativo',
}

export function buildPlanFeatureList(params: {
  plan: PlanId
  agentsLimit: number | null
  conversationsLimit: number | null
  hasRag: boolean
  hasGovernance: boolean
  hasActiveOutbound: boolean
  hasSso?: boolean
  isPaid: boolean
}): PlanFeatureItem[] {
  const { plan, agentsLimit, conversationsLimit, hasRag, hasGovernance, hasActiveOutbound, hasSso, isPaid } =
    params

  if (!isPaid || plan === 'free') {
    return [
      { id: 'free', label: 'Acesso limitado — assine um plano para operar', enabled: false },
    ]
  }

  const agentsLabel =
    agentsLimit == null
      ? `${FEATURE_LABELS.agents}: ilimitados`
      : `${FEATURE_LABELS.agents}: até ${agentsLimit}`

  const convLabel =
    conversationsLimit == null
      ? `${FEATURE_LABELS.conversations}: sob medida`
      : `${FEATURE_LABELS.conversations}: até ${conversationsLimit.toLocaleString('pt-BR')}`

  return [
    { id: 'whatsapp', label: FEATURE_LABELS.whatsapp, enabled: true },
    { id: 'agents', label: agentsLabel, enabled: (agentsLimit ?? 1) > 0 },
    { id: 'conversations', label: convLabel, enabled: (conversationsLimit ?? 1) > 0 },
    { id: 'rag', label: FEATURE_LABELS.rag, enabled: hasRag },
    { id: 'governance', label: FEATURE_LABELS.governance, enabled: hasGovernance },
    { id: 'outbound', label: FEATURE_LABELS.outbound, enabled: hasActiveOutbound },
    { id: 'sso', label: FEATURE_LABELS.sso, enabled: Boolean(hasSso) },
  ]
}

export type BillingPeriodInfo = {
  label: string
  dateText: string | null
  tone: 'default' | 'success' | 'warning' | 'muted'
}

export function resolveBillingPeriod(params: {
  subscriptionStatus: string
  currentPeriodEnd: string | null
  isEffectivelyPaid: boolean
  locale?: string
}): BillingPeriodInfo {
  const { subscriptionStatus, currentPeriodEnd, isEffectivelyPaid, locale = 'pt-BR' } = params

  if (!currentPeriodEnd) {
    if (isEffectivelyPaid) {
      return {
        label: 'Ciclo de cobrança',
        dateText: 'Ativo — data de renovação não informada',
        tone: 'default',
      }
    }
    return {
      label: 'Assinatura',
      dateText: 'Sem renovação automática (plano gratuito ou inativo)',
      tone: 'muted',
    }
  }

  const end = new Date(currentPeriodEnd)
  if (Number.isNaN(end.getTime())) {
    return { label: 'Período', dateText: null, tone: 'muted' }
  }

  const formatted = end.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const now = Date.now()
  const expired = end.getTime() <= now

  if (subscriptionStatus === 'canceled' || subscriptionStatus === 'past_due') {
    return {
      label: subscriptionStatus === 'past_due' ? 'Pagamento pendente' : 'Cancelada',
      dateText: `Referência: ${formatted}`,
      tone: 'warning',
    }
  }

  if (!isEffectivelyPaid || expired) {
    return {
      label: 'Período encerrado',
      dateText: formatted,
      tone: 'warning',
    }
  }

  return {
    label: 'Renova em',
    dateText: formatted,
    tone: 'success',
  }
}

export function subscriptionStatusLabel(status: string): string {
  const map: Record<string, string> = {
    active: 'Ativa',
    trialing: 'Período de teste',
    inactive: 'Inativa',
    canceled: 'Cancelada',
    past_due: 'Pagamento pendente',
  }
  return map[status] || status
}
