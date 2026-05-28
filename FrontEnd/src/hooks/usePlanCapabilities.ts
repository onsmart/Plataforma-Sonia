import { useCallback, useEffect, useState } from 'react'
import { AgentService } from '../services/api'
import { normalizePlanId, planTitle, type PlanId } from '../lib/plan-catalog'

export type PlanCapabilities = {
  plan: PlanId
  planTitle: string
  productLine: 'rec' | 'com'
  status: string
  hasRag: boolean
  hasGovernance: boolean
  hasActiveOutbound: boolean
  conversationsUsed: number
  conversationsLimit: number | null
  agentsUsed: number
  agentsLimit: number | null
  usageLimitReached: boolean
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function usePlanCapabilities(): PlanCapabilities {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState({
    plan: 'free' as PlanId,
    planTitle: 'Plano gratuito',
    productLine: 'rec' as 'rec' | 'com',
    status: 'inactive',
    hasRag: false,
    hasGovernance: false,
    hasActiveOutbound: false,
    conversationsUsed: 0,
    conversationsLimit: null as number | null,
    agentsUsed: 0,
    agentsLimit: null as number | null,
    usageLimitReached: false,
  })

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const usage = await AgentService.getSubscriptionUsage()
      const effectivePlan = normalizePlanId(usage?.effective_plan ?? usage?.plan ?? usage?.plan_name)
      const subscriptionStatus = String(
        usage?.subscription_status ?? usage?.status ?? 'inactive'
      )
      const isPaid =
        subscriptionStatus === 'active' || subscriptionStatus === 'trialing'
      setState({
        plan: isPaid ? effectivePlan : ('free' as PlanId),
        planTitle: isPaid
          ? String(usage?.plan_title || usage?.planTitle || planTitle(effectivePlan))
          : 'Plano gratuito',
        productLine: usage?.product_line === 'com' ? 'com' : 'rec',
        status: subscriptionStatus,
        hasRag: Boolean(usage?.has_rag) && isPaid,
        hasGovernance: Boolean(usage?.has_governance) && isPaid,
        hasActiveOutbound: Boolean(usage?.has_active_outbound) && isPaid,
        conversationsUsed: Number(usage?.conversations_used ?? 0),
        conversationsLimit:
          usage?.conversations_limit != null ? Number(usage.conversations_limit) : null,
        agentsUsed: Number(usage?.agents_used ?? 0),
        agentsLimit: usage?.agents_limit != null ? Number(usage.agents_limit) : null,
        usageLimitReached: Boolean(usage?.usage_limit_reached),
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar plano')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { ...state, loading, error, refresh }
}
