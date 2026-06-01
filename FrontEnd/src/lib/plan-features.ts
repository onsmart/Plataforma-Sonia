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
  | 'flows'
  | 'crmApi'
  | 'governance'
  | 'outbound'
  | 'sso'

const FEATURE_LABELS: Record<FeatureKey, string> = {
  whatsapp: 'WhatsApp e Inbox',
  agents: 'Agentes de IA',
  conversations: 'Atendimentos no mês',
  rag: 'Base de conhecimento (RAG)',
  flows: 'Fluxos visuais e automações',
  crmApi: 'Integrações CRM e API',
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
  hasFlows?: boolean
  hasCrmApi?: boolean
  hasSso?: boolean
  isPaid: boolean
}): PlanFeatureItem[] {
  const {
    plan,
    agentsLimit,
    conversationsLimit,
    hasRag,
    hasGovernance,
    hasActiveOutbound,
    hasFlows = false,
    hasCrmApi = false,
    hasSso,
    isPaid,
  } = params

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
    { id: 'flows', label: FEATURE_LABELS.flows, enabled: hasFlows },
    { id: 'crmApi', label: FEATURE_LABELS.crmApi, enabled: hasCrmApi },
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

export type SubscriptionTimelineItem = BillingPeriodInfo

function formatBillingDate(value: string | null, locale: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function buildSubscriptionTimeline(params: {
  subscriptionStatus: string
  subscribedAt: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  canceledAt: string | null
  cancelAtPeriodEnd: boolean
  hasPaidAccess: boolean
  locale?: string
}): SubscriptionTimelineItem[] {
  const {
    subscriptionStatus,
    subscribedAt,
    currentPeriodStart,
    currentPeriodEnd,
    canceledAt,
    cancelAtPeriodEnd,
    hasPaidAccess,
    locale = 'pt-BR',
  } = params

  const items: SubscriptionTimelineItem[] = []
  const contractedAt = formatBillingDate(subscribedAt, locale)
  const periodStart = formatBillingDate(currentPeriodStart, locale)
  const periodEnd = formatBillingDate(currentPeriodEnd, locale)
  const cancelRequestedAt = formatBillingDate(canceledAt, locale)

  if (!hasPaidAccess) {
    if (contractedAt || periodEnd || cancelRequestedAt) {
      if (contractedAt) {
        items.push({
          label: 'Contratado em',
          dateText: contractedAt,
          tone: 'default',
        })
      }
      if (periodStart) {
        items.push({
          label: 'Última renovação',
          dateText: periodStart,
          tone: 'default',
        })
      }
      if (cancelAtPeriodEnd) {
        items.push({
          label: 'Cancelamento agendado',
          dateText: cancelRequestedAt
            ? `Solicitado em ${cancelRequestedAt}`
            : 'Renovação automática desativada',
          tone: 'warning',
        })
      }
      if (periodEnd) {
        items.push({
          label: 'Encerrada em',
          dateText: periodEnd,
          tone: 'muted',
        })
      }
      return items
    }

    items.push({
      label: 'Assinatura',
      dateText: 'Sem renovação automática (plano gratuito ou inativo)',
      tone: 'muted',
    })
    return items
  }

  if (contractedAt) {
    items.push({
      label: 'Contratado em',
      dateText: contractedAt,
      tone: 'default',
    })
  }

  if (periodStart) {
    const sameAsContract =
      contractedAt &&
      currentPeriodStart &&
      formatBillingDate(subscribedAt, locale) === periodStart

    items.push({
      label: sameAsContract ? 'Início do ciclo atual' : 'Última renovação',
      dateText: periodStart,
      tone: 'default',
    })
  }

  if (cancelAtPeriodEnd && periodEnd) {
    items.push({
      label: 'Cancelamento agendado',
      dateText: cancelRequestedAt
        ? `Solicitado em ${cancelRequestedAt}`
        : 'Renovação automática desativada',
      tone: 'warning',
    })
    items.push({
      label: 'Acesso até',
      dateText: periodEnd,
      tone: 'warning',
    })
    return items
  }

  if (periodEnd) {
    items.push({
      label: subscriptionStatus === 'trialing' ? 'Fim do período de teste' : 'Renova em',
      dateText: periodEnd,
      tone: 'success',
    })
    return items
  }

  items.push({
    label: 'Ciclo de cobrança',
    dateText: 'Ativo — data de renovação não informada',
    tone: 'default',
  })

  return items
}

export function resolveBillingPeriod(params: {
  subscriptionStatus: string
  currentPeriodEnd: string | null
  isEffectivelyPaid: boolean
  locale?: string
}): BillingPeriodInfo {
  const [primary] = buildSubscriptionTimeline({
    subscriptionStatus: params.subscriptionStatus,
    subscribedAt: null,
    currentPeriodStart: null,
    currentPeriodEnd: params.currentPeriodEnd,
    canceledAt: null,
    cancelAtPeriodEnd: false,
    hasPaidAccess: params.isEffectivelyPaid,
    locale: params.locale,
  })

  return (
    primary || {
      label: 'Assinatura',
      dateText: null,
      tone: 'muted',
    }
  )
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
