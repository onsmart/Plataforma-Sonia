import { useEffect, useState } from 'react'
import { Bot, Check, Crown, Loader2, MessageSquare, Sparkles, Zap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { AgentService } from '../../services/api'
import { normalizePlanId, type PlanId } from '../../lib/plan-catalog'
import { cn } from '../../lib/utils'

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
  stripe_price_key?: string
  billing_interval?: 'month'
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

type PlanVisual = {
  accent: string
  ring: string
  iconBg: string
  gradient: string
  buttonClass: string
}

function getPlanVisual(plan: PlanCatalogEntry, theme: string): PlanVisual {
  const dark = theme === 'dark'
  if (plan.tier === 'enterprise') {
    return {
      accent: dark ? '#fbbf24' : '#b45309',
      ring: dark ? 'rgba(251, 191, 36, 0.45)' : 'rgba(180, 83, 9, 0.35)',
      iconBg: dark ? 'rgba(251, 191, 36, 0.12)' : 'rgba(251, 191, 36, 0.18)',
      gradient: dark
        ? 'linear-gradient(165deg, rgba(251,191,36,0.12) 0%, rgba(24,24,27,0.95) 38%, rgba(9,9,11,1) 100%)'
        : 'linear-gradient(165deg, rgba(254,243,199,0.95) 0%, #ffffff 42%, #fffbeb 100%)',
      buttonClass: 'border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300',
    }
  }
  if (plan.tier === 'growth') {
    return {
      accent: plan.productLine === 'com' ? (dark ? '#c4b5fd' : '#7c3aed') : dark ? '#22d3ee' : '#0891b2',
      ring: plan.productLine === 'com' ? 'rgba(167, 139, 250, 0.45)' : 'rgba(34, 211, 238, 0.42)',
      iconBg: plan.productLine === 'com' ? 'rgba(139, 92, 246, 0.14)' : 'rgba(6, 182, 212, 0.14)',
      gradient: plan.productLine === 'com'
        ? dark
          ? 'linear-gradient(165deg, rgba(109,40,217,0.18) 0%, rgba(24,24,27,0.95) 40%, rgba(9,9,11,1) 100%)'
          : 'linear-gradient(165deg, rgba(237,233,254,0.95) 0%, #ffffff 42%, #f5f3ff 100%)'
        : dark
          ? 'linear-gradient(165deg, rgba(6,182,212,0.16) 0%, rgba(24,24,27,0.95) 40%, rgba(9,9,11,1) 100%)'
          : 'linear-gradient(165deg, rgba(207,250,254,0.9) 0%, #ffffff 42%, #ecfeff 100%)',
      buttonClass: 'bg-primary text-primary-foreground hover:bg-primary/90',
    }
  }
  return {
    accent: plan.productLine === 'com' ? (dark ? '#a78bfa' : '#6d28d9') : dark ? '#94a3b8' : '#475569',
    ring: plan.productLine === 'com' ? 'rgba(139, 92, 246, 0.22)' : 'rgba(148, 163, 184, 0.28)',
    iconBg: plan.productLine === 'com' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(148, 163, 184, 0.12)',
    gradient: dark
      ? 'linear-gradient(165deg, rgba(39,39,42,0.9) 0%, rgba(24,24,27,0.98) 100%)'
      : 'linear-gradient(165deg, #f8fafc 0%, #ffffff 55%, #f1f5f9 100%)',
    buttonClass: 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white',
  }
}

interface BillingPlansSectionProps {
  theme?: string
  catalogPlan: string
  hasPaidAccess?: boolean
  subscriptionStatus: string
  checkoutPlanId: string | null
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
    currentPlanBadge: string
  }
}

export function BillingPlansSection({
  theme = 'light',
  catalogPlan,
  hasPaidAccess = false,
  subscriptionStatus,
  checkoutPlanId,
  usageStats,
  loadingUsage,
  onUpgrade,
  labels,
}: BillingPlansSectionProps) {
  const [plans, setPlans] = useState<PlanCatalogEntry[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const normalizedCatalog = normalizePlanId(catalogPlan)
  const isPaid = hasPaidAccess

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingPlans(true)
      try {
        const data = await AgentService.getBillingPlans()
        if (!cancelled) setPlans((data?.plans || []) as PlanCatalogEntry[])
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

  const renderPlanCard = (plan: PlanCatalogEntry) => {
    const isCurrent = isPaid && normalizedCatalog === plan.id
    const isGrowth = plan.tier === 'growth'
    const isEnterprise = plan.tier === 'enterprise'
    const visual = getPlanVisual(plan, theme)
    const priceKey = plan.stripe_price_key || plan.stripePriceKeyMonthly
    const isCheckingOut = checkoutPlanId === priceKey

    const convLimit = plan.monthlyConversations
    const showUsage = isCurrent && convLimit !== null
    const overLimit =
      showUsage &&
      usageStats.conversationsLimit !== null &&
      usageStats.conversationsUsed >= usageStats.conversationsLimit

    return (
      <Card
        key={plan.id}
        className={cn(
          'relative flex h-full flex-col overflow-hidden rounded-2xl border transition-all duration-200',
          isCurrent && 'shadow-lg shadow-primary/10',
          isGrowth && !isCurrent && 'md:-translate-y-0.5 md:shadow-md'
        )}
        style={{
          background: visual.gradient,
          borderColor: isCurrent ? visual.ring : `${visual.ring}`,
          boxShadow: isCurrent ? `0 0 0 1px ${visual.ring}, 0 18px 40px -28px ${visual.ring}` : undefined,
        }}
      >
        {isCurrent && (
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: visual.accent }} />
        )}

        <CardHeader className="space-y-3 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: visual.iconBg }}
              >
                {isEnterprise ? (
                  <Crown className="h-5 w-5" style={{ color: visual.accent }} />
                ) : plan.productLine === 'com' ? (
                  <Sparkles className="h-5 w-5" style={{ color: visual.accent }} />
                ) : (
                  <MessageSquare className="h-5 w-5" style={{ color: visual.accent }} />
                )}
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg" style={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>
                  {plan.title}
                </CardTitle>
                <CardDescription className="mt-1 text-xs sm:text-sm">{plan.description}</CardDescription>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {isCurrent && (
                <Badge className="rounded-full bg-emerald-500/15 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  {labels.currentPlanBadge}
                </Badge>
              )}
              {isGrowth && !isCurrent && (
                <Badge variant="secondary" className="rounded-full text-[10px] font-bold uppercase tracking-[0.14em]">
                  {labels.popular}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-4 pt-0">
          <div>
            <div className="text-3xl font-bold tracking-tight" style={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>
              {plan.priceDisplayMonthly}
              <span className="ml-1 text-sm font-normal text-muted-foreground">{labels.perMonth}</span>
            </div>
          </div>

          {showUsage && (
            <div
              className={cn(
                'rounded-xl border p-3 text-xs',
                overLimit ? 'border-red-500/30 bg-red-500/10' : 'border-border/60 bg-background/40'
              )}
            >
              <div className="mb-1 flex items-center justify-between font-semibold">
                <span>{labels.conversations}</span>
                <span>
                  {loadingUsage ? '…' : `${usageStats.conversationsUsed}/${usageStats.conversationsLimit}`}
                </span>
              </div>
              {overLimit && <p className="text-red-500">{labels.usageLimitReached}</p>}
            </div>
          )}

          <ul className="space-y-2.5 text-sm text-muted-foreground">
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
            {plan.hasActiveOutbound ? (
              <li className="flex items-center gap-2">
                <Zap className="h-4 w-4 shrink-0 text-violet-500" />
                <span>IA receptiva + ativa (SDR)</span>
              </li>
            ) : (
              <li className="opacity-80">Somente IA receptiva (sem SDR)</li>
            )}
            {plan.hasRAG && (
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>RAG / Base de conhecimento</span>
              </li>
            )}
          </ul>
        </CardContent>

        <CardFooter className="pt-2">
          {isCurrent ? (
            <div className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">
              <Check className="h-4 w-4" />
              {labels.acquired}
            </div>
          ) : plan.sales_assisted || plan.tier === 'enterprise' ? (
            <Button className={cn('h-11 w-full rounded-xl text-[11px] font-bold uppercase tracking-[0.08em]', visual.buttonClass)} variant="outline" asChild>
              <a href={ONSMART_SALES_URL} target="_blank" rel="noopener noreferrer">
                {labels.contactSales}
              </a>
            </Button>
          ) : plan.checkout_available === false ? (
            <Button className="h-11 w-full rounded-xl" disabled>
              {labels.contactSales}
            </Button>
          ) : (
            <Button
              className={cn('h-11 w-full rounded-xl text-[11px] font-bold uppercase tracking-[0.08em]', visual.buttonClass)}
              onClick={() => onUpgrade(priceKey)}
              disabled={Boolean(checkoutPlanId)}
            >
              {isCheckingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : labels.subscribe}
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
          <h3 className="text-lg font-semibold">{labels.recLineTitle}</h3>
          <p className="text-sm text-muted-foreground">{labels.recLineDescription}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{recPlans.map(renderPlanCard)}</div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{labels.comLineTitle}</h3>
          <p className="text-sm text-muted-foreground">{labels.comLineDescription}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{comPlans.map(renderPlanCard)}</div>
      </div>
    </div>
  )
}
