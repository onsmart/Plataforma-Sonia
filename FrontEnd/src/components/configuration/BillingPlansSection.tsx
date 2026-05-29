import { useEffect, useState } from 'react'
import {
  Bot,
  Check,
  Crown,
  Headphones,
  Loader2,
  MessageSquare,
  Minus,
  Shield,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react'
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
  commercialLevel?: string
  title: string
  description: string
  monthlyConversations: number | null
  volumeLabel: string
  usageCriterion?: string
  agents: number | null
  hasRAG: boolean
  hasSSO?: boolean
  hasGovernance?: boolean
  hasCustomDeployment?: boolean
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

type PlanDetail = {
  label: string
  included: boolean
  emphasis?: boolean
}

type ProductLineTheme = {
  lineLabel: string
  lineBadge: string
  sectionShell: string
  sectionHeaderStripe: string
  sectionIconWell: string
  sectionIconClass: string
  sectionBadgeClass: string
  popularBadgeClass: string
  currentRingClass: string
  subscribeButtonClass: string
  salesButtonClass: string
  checkClass: string
  minusClass: string
  priceBlockClass: string
  sdrBadgeClass: string
  chipClass: string
  tierAccent: (tier: string) => {
    stripeClass: string
    iconWellClass: string
    iconClass: string
    tierBadgeClass: string
  }
}

/** Receptiva: neutros frios (slate) + borda sólida */
const REC_THEME: ProductLineTheme = {
  lineLabel: 'Linha receptiva',
  lineBadge: 'Inbound · FAQ · Triagem',
  sectionShell:
    'rounded-[1.75rem] border border-slate-300/50 bg-gradient-to-b from-slate-100/80 to-transparent p-4 sm:p-5 dark:border-slate-600/35 dark:from-slate-900/50 dark:to-transparent',
  sectionHeaderStripe: 'from-slate-400/80 via-slate-300/60 to-slate-400/70 dark:from-slate-600 dark:via-slate-500 dark:to-slate-600',
  sectionIconWell: 'bg-slate-500/10 ring-1 ring-slate-400/25 dark:ring-slate-500/30',
  sectionIconClass: 'text-slate-600 dark:text-slate-300',
  sectionBadgeClass:
    'border-slate-300/60 bg-slate-100 text-slate-700 dark:border-slate-600/50 dark:bg-slate-800/80 dark:text-slate-300',
  popularBadgeClass:
    'border-slate-400/50 bg-slate-200/80 text-slate-800 dark:border-slate-500/40 dark:bg-slate-800 dark:text-slate-200',
  currentRingClass: 'ring-1 ring-slate-400/40 shadow-lg shadow-slate-900/5 dark:ring-slate-500/35',
  subscribeButtonClass:
    'bg-slate-900 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white',
  salesButtonClass: 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800/60',
  checkClass: 'text-slate-700 dark:text-slate-300',
  minusClass: 'text-muted-foreground/45',
  priceBlockClass: 'border-slate-200/80 bg-slate-50/90 dark:border-slate-700/50 dark:bg-slate-900/40',
  sdrBadgeClass: '',
  chipClass: 'border-slate-200/80 bg-slate-100/80 text-slate-600 dark:border-slate-700/50 dark:bg-slate-800/60 dark:text-slate-300',
  tierAccent: (tier) => {
    if (tier === 'enterprise') {
      return {
        stripeClass: 'from-zinc-500/90 via-slate-400/70 to-zinc-500/80 dark:from-zinc-400 dark:via-zinc-500 dark:to-zinc-400',
        iconWellClass: 'bg-zinc-500/10 ring-1 ring-zinc-400/25',
        iconClass: 'text-zinc-700 dark:text-zinc-300',
        tierBadgeClass: 'border-zinc-300/60 bg-zinc-100 text-zinc-800 dark:border-zinc-600/50 dark:bg-zinc-800 dark:text-zinc-200',
      }
    }
    if (tier === 'growth') {
      return {
        stripeClass: 'from-slate-500/80 via-slate-400/70 to-slate-500/80 dark:from-slate-500 dark:via-slate-400 dark:to-slate-500',
        iconWellClass: 'bg-slate-500/10 ring-1 ring-slate-400/25',
        iconClass: 'text-slate-700 dark:text-slate-300',
        tierBadgeClass: 'border-slate-300/60 bg-slate-100 text-slate-800 dark:border-slate-600/50 dark:bg-slate-800 dark:text-slate-200',
      }
    }
    return {
      stripeClass: 'from-slate-300/70 via-slate-200/50 to-slate-300/70 dark:from-zinc-700/80 dark:via-zinc-600/50 dark:to-zinc-700/80',
      iconWellClass: 'bg-muted/70 ring-1 ring-border/60',
      iconClass: 'text-muted-foreground',
      tierBadgeClass: 'border-border/70 bg-muted/50 text-muted-foreground',
    }
  },
}

/** Completa: neutros quentes (stone) + borda tracejada */
const COM_THEME: ProductLineTheme = {
  lineLabel: 'Linha completa',
  lineBadge: 'Receptiva + SDR · Outbound',
  sectionShell:
    'rounded-[1.75rem] border border-dashed border-stone-400/45 bg-gradient-to-b from-stone-100/70 to-transparent p-4 sm:p-5 dark:border-stone-500/30 dark:from-stone-950/40 dark:to-transparent',
  sectionHeaderStripe: 'from-stone-500/75 via-neutral-400/55 to-stone-500/70 dark:from-stone-600 dark:via-neutral-500 dark:to-stone-600',
  sectionIconWell: 'bg-stone-500/10 ring-1 ring-stone-400/25 dark:ring-stone-500/30',
  sectionIconClass: 'text-stone-600 dark:text-stone-300',
  sectionBadgeClass:
    'border-stone-300/60 bg-stone-100 text-stone-700 dark:border-stone-600/50 dark:bg-stone-900/70 dark:text-stone-300',
  popularBadgeClass:
    'border-stone-400/50 bg-stone-200/80 text-stone-800 dark:border-stone-500/40 dark:bg-stone-900 dark:text-stone-200',
  currentRingClass: 'ring-1 ring-stone-400/40 shadow-lg shadow-stone-900/5 dark:ring-stone-500/35',
  subscribeButtonClass:
    'bg-zinc-700 text-white hover:bg-zinc-600 dark:bg-zinc-300 dark:text-zinc-900 dark:hover:bg-zinc-200',
  salesButtonClass: 'border-stone-300 text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-900/60',
  checkClass: 'text-stone-700 dark:text-stone-300',
  minusClass: 'text-muted-foreground/45',
  priceBlockClass: 'border-stone-200/80 bg-stone-50/90 dark:border-stone-700/45 dark:bg-stone-950/35',
  sdrBadgeClass:
    'border-stone-300/70 bg-stone-100 text-stone-700 dark:border-stone-600/50 dark:bg-stone-900/80 dark:text-stone-300',
  chipClass: 'border-stone-200/80 bg-stone-100/80 text-stone-600 dark:border-stone-700/50 dark:bg-stone-900/60 dark:text-stone-300',
  tierAccent: (tier) => {
    if (tier === 'enterprise') {
      return {
        stripeClass: 'from-neutral-500/90 via-stone-400/70 to-neutral-500/80 dark:from-neutral-400 dark:via-stone-500 dark:to-neutral-400',
        iconWellClass: 'bg-neutral-500/10 ring-1 ring-neutral-400/25',
        iconClass: 'text-neutral-700 dark:text-neutral-300',
        tierBadgeClass: 'border-neutral-300/60 bg-neutral-100 text-neutral-800 dark:border-neutral-600/50 dark:bg-neutral-900 dark:text-neutral-200',
      }
    }
    if (tier === 'growth') {
      return {
        stripeClass: 'from-stone-500/80 via-neutral-400/65 to-stone-500/80 dark:from-stone-500 dark:via-neutral-400 dark:to-stone-500',
        iconWellClass: 'bg-stone-500/10 ring-1 ring-stone-400/25',
        iconClass: 'text-stone-700 dark:text-stone-300',
        tierBadgeClass: 'border-stone-300/60 bg-stone-100 text-stone-800 dark:border-stone-600/50 dark:bg-stone-900 dark:text-stone-200',
      }
    }
    return {
      stripeClass: 'from-stone-300/70 via-neutral-300/50 to-stone-300/70 dark:from-stone-700/80 dark:via-neutral-600/45 dark:to-stone-700/80',
      iconWellClass: 'bg-stone-500/8 ring-1 ring-stone-400/20',
      iconClass: 'text-stone-600/90 dark:text-stone-300/90',
      tierBadgeClass: 'border-stone-300/50 bg-stone-100/80 text-stone-700 dark:border-stone-600/40 dark:bg-stone-900/70 dark:text-stone-300',
    }
  },
}

function getLineTheme(productLine: 'rec' | 'com'): ProductLineTheme {
  return productLine === 'com' ? COM_THEME : REC_THEME
}

function PlanIcon({ plan, className }: { plan: PlanCatalogEntry; className?: string }) {
  if (plan.tier === 'enterprise') {
    return <Crown className={cn('h-5 w-5', className)} />
  }
  if (plan.productLine === 'com') {
    return <Sparkles className={cn('h-5 w-5', className)} />
  }
  return <MessageSquare className={cn('h-5 w-5', className)} />
}

function buildPlanDetails(plan: PlanCatalogEntry): PlanDetail[] {
  const isEnterprise = plan.tier === 'enterprise'
  const isGrowth = plan.tier === 'growth'

  const items: PlanDetail[] = [
    { label: plan.volumeLabel, included: true, emphasis: true },
    {
      label: plan.usageCriterion || 'Atendimentos medidos por sessão no mês',
      included: true,
    },
    {
      label:
        plan.agents == null
          ? 'Agentes de IA ilimitados'
          : `${plan.agents} agente(s) de IA simultâneo(s)`,
      included: true,
    },
    {
      label: 'WhatsApp, Caixa de Entrada e Playground',
      included: true,
    },
    {
      label: 'Fluxos visuais e editor de automações',
      included: isGrowth || isEnterprise || plan.productLine === 'com',
    },
  ]

  if (plan.hasActiveOutbound) {
    items.push(
      {
        label: 'IA ativa (SDR): cadências, prospecção e campanhas outbound',
        included: true,
        emphasis: true,
      },
      { label: 'Contatos ativos incluídos no volume mensal', included: true }
    )
  } else {
    items.push(
      { label: 'IA receptiva: inbound, FAQ e triagem automatizada', included: true, emphasis: true },
      { label: 'Operação SDR / outbound', included: false }
    )
  }

  if (isGrowth || isEnterprise) {
    items.push({ label: 'Integrações CRM, API e webhooks', included: true })
  }

  items.push(
    { label: 'Base de conhecimento (RAG)', included: plan.hasRAG },
    { label: 'Governança e aprovações de resposta', included: Boolean(plan.hasGovernance) },
    { label: 'SSO corporativo (SAML / OIDC)', included: Boolean(plan.hasSSO) },
    {
      label: isEnterprise ? 'Deploy dedicado, SLA e onboarding assistido' : 'Deploy dedicado / SLA',
      included: Boolean(plan.hasCustomDeployment),
    }
  )

  if (isEnterprise) {
    items.push({ label: 'Suporte prioritário e account manager', included: true })
  }

  return items
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
  const isDark = theme === 'dark'

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

  const cardShellClass = cn(
    'relative flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-border/80 shadow-soft transition-all duration-200',
    isDark ? 'bg-[#18181b]' : 'bg-[#F8FAFC]'
  )

  const renderPlanCard = (plan: PlanCatalogEntry, lineTheme: ProductLineTheme) => {
    const isCurrent = isPaid && normalizedCatalog === plan.id
    const isGrowth = plan.tier === 'growth'
    const accent = lineTheme.tierAccent(plan.tier)
    const details = buildPlanDetails(plan)
    const priceKey = plan.stripe_price_key || plan.stripePriceKeyMonthly
    const isCheckingOut = checkoutPlanId === priceKey
    const needsSales = plan.sales_assisted || plan.tier === 'enterprise' || plan.checkout_available === false

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
          cardShellClass,
          isCurrent && lineTheme.currentRingClass,
          isGrowth && !isCurrent && 'md:-translate-y-0.5'
        )}
      >
        <div className={cn('h-1 w-full bg-gradient-to-r', accent.stripeClass)} />

        <CardHeader className="space-y-3 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                  accent.iconWellClass
                )}
              >
                <PlanIcon plan={plan} className={accent.iconClass} />
              </div>
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn(
                      'rounded-full px-2 py-0 text-[9px] font-semibold uppercase tracking-[0.14em]',
                      accent.tierBadgeClass
                    )}
                  >
                    {plan.commercialLevel || plan.tier}
                  </Badge>
                  {plan.productLine === 'com' && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'rounded-full px-2 py-0 text-[9px] font-semibold uppercase tracking-[0.12em]',
                        lineTheme.sdrBadgeClass ||
                          'border-border/70 bg-muted/40 text-muted-foreground'
                      )}
                    >
                      + SDR
                    </Badge>
                  )}
                </div>
                <CardTitle
                  className={cn(
                    'text-base leading-snug sm:text-lg',
                    isDark ? 'text-slate-50' : 'text-slate-900'
                  )}
                >
                  {plan.title}
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed sm:text-sm">
                  {plan.description}
                </CardDescription>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {isCurrent && (
                <Badge className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
                  {labels.currentPlanBadge}
                </Badge>
              )}
              {isGrowth && !isCurrent && (
                <Badge
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
                    lineTheme.popularBadgeClass
                  )}
                >
                  {labels.popular}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-4 pt-0">
          <div className={cn('rounded-xl border px-3 py-2.5', lineTheme.priceBlockClass)}>
            <div
              className={cn(
                'text-3xl font-bold tracking-tight',
                isDark ? 'text-slate-50' : 'text-slate-900'
              )}
            >
              {plan.priceDisplayMonthly}
              <span className="ml-1 text-sm font-normal text-muted-foreground">{labels.perMonth}</span>
            </div>
            {plan.monthlyConversations != null && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Medição: {plan.monthlyConversations.toLocaleString('pt-BR')} atendimentos/mês no tier{' '}
                {plan.commercialLevel || plan.tier}
              </p>
            )}
          </div>

          {showUsage && (
            <div
              className={cn(
                'rounded-xl border p-3 text-xs',
                overLimit
                  ? 'border-red-500/30 bg-red-500/10'
                  : 'border-border/60 bg-background/50 dark:bg-zinc-900/40'
              )}
            >
              <div className="mb-1 flex items-center justify-between font-semibold text-foreground">
                <span>{labels.conversations}</span>
                <span>
                  {loadingUsage ? '…' : `${usageStats.conversationsUsed}/${usageStats.conversationsLimit}`}
                </span>
              </div>
              {overLimit && <p className="text-red-500">{labels.usageLimitReached}</p>}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              O que inclui
            </p>
            <ul className="space-y-2 text-[13px] leading-snug text-muted-foreground">
              {details.map((item) => (
                <li
                  key={item.label}
                  className={cn(
                    'flex items-start gap-2',
                    !item.included && 'opacity-70',
                    item.emphasis && item.included && 'font-medium text-foreground'
                  )}
                >
                  {item.included ? (
                    <Check className={cn('mt-0.5 h-4 w-4 shrink-0', lineTheme.checkClass)} />
                  ) : (
                    <Minus className={cn('mt-0.5 h-4 w-4 shrink-0', lineTheme.minusClass)} />
                  )}
                  <span className={cn(!item.included && 'line-through decoration-muted-foreground/40')}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-auto flex flex-wrap gap-2 pt-1">
            {plan.hasActiveOutbound ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium',
                  lineTheme.chipClass
                )}
              >
                <Zap className="h-3 w-3" />
                Outbound
              </span>
            ) : (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium',
                  lineTheme.chipClass
                )}
              >
                <MessageSquare className="h-3 w-3" />
                Só inbound
              </span>
            )}
            {plan.hasRAG && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium',
                  lineTheme.chipClass
                )}
              >
                <Bot className="h-3 w-3" />
                RAG
              </span>
            )}
            {plan.hasGovernance && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium',
                  lineTheme.chipClass
                )}
              >
                <Shield className="h-3 w-3" />
                Governança
              </span>
            )}
            {plan.tier === 'enterprise' && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium',
                  lineTheme.chipClass
                )}
              >
                <Headphones className="h-3 w-3" />
                SLA
              </span>
            )}
            {(plan.tier === 'growth' || plan.tier === 'enterprise') && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium',
                  lineTheme.chipClass
                )}
              >
                <Workflow className="h-3 w-3" />
                Integrações
              </span>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-2">
          {isCurrent ? (
            <div className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">
              <Check className="h-4 w-4" />
              {labels.acquired}
            </div>
          ) : needsSales ? (
            <Button
              className={cn(
                'h-11 w-full rounded-xl text-[11px] font-bold uppercase tracking-[0.08em]',
                lineTheme.salesButtonClass
              )}
              variant="outline"
              asChild={plan.checkout_available !== false}
              disabled={plan.checkout_available === false}
            >
              {plan.checkout_available === false ? (
                <span>{labels.contactSales}</span>
              ) : (
                <a href={ONSMART_SALES_URL} target="_blank" rel="noopener noreferrer">
                  {labels.contactSales}
                </a>
              )}
            </Button>
          ) : (
            <Button
              className={cn(
                'h-11 w-full rounded-xl text-[11px] font-bold uppercase tracking-[0.08em]',
                lineTheme.subscribeButtonClass
              )}
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

  const renderLineSection = (
    title: string,
    description: string,
    linePlans: PlanCatalogEntry[],
    productLine: 'rec' | 'com'
  ) => {
    const lineTheme = getLineTheme(productLine)
    const SectionIcon = productLine === 'com' ? Sparkles : MessageSquare

    return (
      <section className={cn('space-y-5', lineTheme.sectionShell)}>
        <div className="space-y-4">
          <div className={cn('h-1 w-full rounded-full bg-gradient-to-r', lineTheme.sectionHeaderStripe)} />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
                  lineTheme.sectionIconWell
                )}
              >
                <SectionIcon className={cn('h-6 w-6', lineTheme.sectionIconClass)} />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    className={cn(
                      'text-lg font-semibold tracking-tight',
                      isDark ? 'text-slate-50' : 'text-slate-900'
                    )}
                  >
                    {title}
                  </h3>
                  <Badge
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
                      lineTheme.sectionBadgeClass
                    )}
                  >
                    {lineTheme.lineBadge}
                  </Badge>
                </div>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                  {lineTheme.lineLabel}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {linePlans.map((plan) => renderPlanCard(plan, lineTheme))}
        </div>
      </section>
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
      {renderLineSection(labels.recLineTitle, labels.recLineDescription, recPlans, 'rec')}
      {renderLineSection(labels.comLineTitle, labels.comLineDescription, comPlans, 'com')}
    </div>
  )
}
