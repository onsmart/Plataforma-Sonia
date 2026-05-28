import { useEffect, useState } from 'react'
import { Bot, Check, Loader2, MessageSquare, Sparkles, Zap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { AgentService } from '../../services/api'
import { normalizePlanId, type PlanId } from '../../lib/plan-catalog'

type PlanCatalogEntry = {
  id: PlanId
  code: string
  productLine: 'rec' | 'com'
  tier: string
  title: string
  description: string
  monthlyConversations: number | null
  volumeLabel: string
  agents: number | null
  hasRAG: boolean
  hasActiveOutbound: boolean
  priceDisplayMonthly: string
  stripePriceKeyMonthly: string
  checkout_available?: boolean
  sales_assisted?: boolean
}

const ONSMART_SALES_URL =
  (import.meta.env.VITE_ONSMART_SALES_URL as string | undefined)?.trim() || 'https://www.onsmart.ai'

type UsageStats = {
  conversationsUsed: number
  conversationsLimit: number | null
  agentsUsed: number
  agentsLimit: number | null
}

interface BillingPlansSectionProps {
  theme?: string
  currentPlan: string
  hasActiveSubscription: boolean
  saving: boolean
  usageStats: UsageStats
  loadingUsage: boolean
  onUpgrade: (priceId: string) => void
  labels: {
    recLineTitle: string
    recLineDescription: string
    comLineTitle: string
    comLineDescription: string
    conversations: string
    agents: string
    unlimited: string
    acquired: string
    subscribe: string
    popular: string
    usageLimitReached: string
    perMonth: string
    contactSales: string
  }
}

export function BillingPlansSection({
  theme = 'light',
  currentPlan,
  hasActiveSubscription,
  saving,
  usageStats,
  loadingUsage,
  onUpgrade,
  labels,
}: BillingPlansSectionProps) {
  const [plans, setPlans] = useState<PlanCatalogEntry[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const normalizedCurrent = normalizePlanId(currentPlan)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingPlans(true)
      try {
        const data = await AgentService.getBillingPlans()
        if (!cancelled) {
          setPlans((data?.plans || []) as PlanCatalogEntry[])
        }
      } catch {
        if (!cancelled) setPlans([])
      } finally {
        if (!cancelled) setLoadingPlans(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const recPlans = plans.filter((p) => p.productLine === 'rec')
  const comPlans = plans.filter((p) => p.productLine === 'com')

  const renderPlanCard = (plan: PlanCatalogEntry, accent: 'cyan' | 'violet') => {
    const isCurrent = hasActiveSubscription && normalizedCurrent === plan.id
    const isGrowth = plan.tier === 'growth'
    const convLimit = plan.monthlyConversations
    const showUsage = isCurrent && convLimit !== null
    const overLimit =
      showUsage &&
      usageStats.conversationsLimit !== null &&
      usageStats.conversationsUsed >= usageStats.conversationsLimit

    const accentBorder =
      accent === 'cyan'
        ? theme === 'dark'
          ? 'rgba(34, 211, 238, 0.2)'
          : 'rgba(6, 182, 212, 0.18)'
        : theme === 'dark'
          ? 'rgba(167, 139, 250, 0.24)'
          : 'rgba(139, 92, 246, 0.2)'

    return (
      <Card
        key={plan.id}
        className="relative flex flex-col rounded-[1.25rem] border transition-shadow duration-150 hover:shadow-lg"
        style={{
          background:
            theme === 'dark'
              ? accent === 'cyan'
                ? 'linear-gradient(180deg, rgba(8, 145, 178, 0.14) 0%, #151821 28%, #101827 100%)'
                : 'linear-gradient(180deg, rgba(109, 40, 217, 0.14) 0%, #151821 28%, #101827 100%)'
              : accent === 'cyan'
                ? 'linear-gradient(180deg, rgba(207, 250, 254, 0.72) 0%, #ffffff 34%, #f8fafc 100%)'
                : 'linear-gradient(180deg, rgba(237, 233, 254, 0.85) 0%, #ffffff 34%, #f8fafc 100%)',
          borderColor: accentBorder,
        }}
      >
        {isGrowth && (
          <div className="absolute right-5 top-5">
            <Badge className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]">
              {labels.popular}
            </Badge>
          </div>
        )}
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                backgroundColor:
                  theme === 'dark'
                    ? accent === 'cyan'
                      ? 'rgba(34, 211, 238, 0.14)'
                      : 'rgba(167, 139, 250, 0.14)'
                    : accent === 'cyan'
                      ? 'rgba(8, 145, 178, 0.14)'
                      : 'rgba(139, 92, 246, 0.14)',
              }}
            >
              {accent === 'cyan' ? (
                <MessageSquare className="h-5 w-5" style={{ color: theme === 'dark' ? '#22d3ee' : '#0f172a' }} />
              ) : (
                <Sparkles className="h-5 w-5" style={{ color: theme === 'dark' ? '#c4b5fd' : '#6d28d9' }} />
              )}
            </div>
            <div>
              <CardTitle style={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>{plan.title}</CardTitle>
              <CardDescription style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
                {plan.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="mb-5 text-3xl font-bold tracking-tight" style={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>
            {plan.priceDisplayMonthly}
            <span className="ml-1 text-sm font-normal" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
              {labels.perMonth}
            </span>
          </div>

          {showUsage && (
            <div
              className="mb-5 rounded-xl border p-4"
              style={{
                backgroundColor: overLimit
                  ? theme === 'dark'
                    ? 'rgba(127, 29, 29, 0.22)'
                    : 'rgba(254, 226, 226, 0.9)'
                  : theme === 'dark'
                    ? 'rgba(15, 23, 42, 0.54)'
                    : 'rgba(240, 249, 255, 0.9)',
                borderColor: overLimit ? 'rgba(239, 68, 68, 0.32)' : accentBorder,
              }}
            >
              <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                <span>{labels.conversations}</span>
                <span>
                  {loadingUsage ? '…' : `${usageStats.conversationsUsed}/${usageStats.conversationsLimit}`}
                </span>
              </div>
              {overLimit && (
                <p className="text-xs text-red-500">{labels.usageLimitReached}</p>
              )}
            </div>
          )}

          <ul className="space-y-3 text-sm" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>
            <li className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
              <span>{plan.volumeLabel}</span>
            </li>
            <li className="flex items-center gap-2">
              <Bot className="h-4 w-4 shrink-0 opacity-70" />
              <span>
                {labels.agents}: {plan.agents === null ? labels.unlimited : plan.agents}
              </span>
            </li>
            {plan.hasActiveOutbound && (
              <li className="flex items-center gap-2">
                <Zap className="h-4 w-4 shrink-0 opacity-70" />
                <span>IA receptiva + ativa (SDR)</span>
              </li>
            )}
            {!plan.hasActiveOutbound && (
              <li className="flex items-center gap-2 opacity-80">
                <span>Somente IA receptiva (sem SDR)</span>
              </li>
            )}
            {plan.hasRAG && (
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>RAG / Base de conhecimento</span>
              </li>
            )}
          </ul>
        </CardContent>
        <CardFooter>
          {isCurrent ? (
            <div className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-[11px] font-black uppercase tracking-[0.08em] text-emerald-700">
              <Check className="h-4 w-4" />
              {labels.acquired}
            </div>
          ) : plan.sales_assisted || plan.tier === 'enterprise' ? (
            <Button
              className="h-11 w-full rounded-xl text-[11px] font-black uppercase tracking-[0.08em]"
              variant="outline"
              asChild
            >
              <a href={ONSMART_SALES_URL} target="_blank" rel="noopener noreferrer">
                {labels.contactSales}
              </a>
            </Button>
          ) : plan.checkout_available === false ? (
            <Button className="h-11 w-full rounded-xl text-[11px] font-black uppercase tracking-[0.08em]" disabled>
              {labels.contactSales}
            </Button>
          ) : (
            <Button
              className="h-11 w-full rounded-xl text-[11px] font-black uppercase tracking-[0.08em]"
              onClick={() => onUpgrade(plan.stripePriceKeyMonthly)}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : labels.subscribe}
            </Button>
          )}
        </CardFooter>
      </Card>
    )
  }

  if (loadingPlans) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
            {labels.recLineTitle}
          </h3>
          <p className="text-sm text-muted-foreground">{labels.recLineDescription}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">{recPlans.map((p) => renderPlanCard(p, 'cyan'))}</div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
            {labels.comLineTitle}
          </h3>
          <p className="text-sm text-muted-foreground">{labels.comLineDescription}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">{comPlans.map((p) => renderPlanCard(p, 'violet'))}</div>
      </div>
    </div>
  )
}
