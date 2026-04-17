import React, { useCallback, useEffect, useState } from "react"
import {
    Activity,
    ArrowRight,
    Bot,
    LayoutDashboard,
    MessageSquare,
    PieChart,
    RefreshCw,
    Sparkles,
    Users,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { AgentService, DashboardData, KPIService, type KPIMetrics } from "../services/api"
import { useAuth } from "../contexts/AuthContext"
import { useNavigation } from "../contexts/NavigationContext"
import { cn } from "../components/ui/utils"

const cardChrome =
    "rounded-xl border border-border/80 bg-card text-card-foreground shadow-sm transition-colors hover:border-border dark:border-border dark:bg-card dark:shadow-none"

export function Home() {
    const { t } = useTranslation("navigation")
    const { firstName, lastName } = useAuth()
    const { navigate } = useNavigation()
    const [data, setData] = useState<DashboardData | null>(null)
    const [kpis, setKpis] = useState<KPIMetrics | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const displayName =
        firstName && lastName ? `${firstName} ${lastName}`.trim() : firstName || lastName || ""

    const load = useCallback(async () => {
        setRefreshing(true)
        try {
            const [dash, kpiRes] = await Promise.all([
                AgentService.getDashboardStats(),
                KPIService.getKPIs().catch(() => null),
            ])
            setData(dash)
            setKpis(kpiRes)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    const stats = data?.stats
    const agents = data?.agents ?? []
    const connectedAgents = agents.filter((a) => a.status_id === 1).length
    const dash = t("home.loadingPlaceholder", { defaultValue: "—" })

    const summaryTiles = [
        {
            label: t("home.metrics.interactions", { defaultValue: "Interações" }),
            hint: t("home.metrics.interactionsHint", { defaultValue: "Volume registrado na conta" }),
            value: stats?.totalInteractions ?? 0,
            icon: MessageSquare,
            route: "insights" as const,
        },
        {
            label: t("home.metrics.leads", { defaultValue: "Leads ativos" }),
            hint: t("home.metrics.leadsHint", { defaultValue: "Contatos em andamento" }),
            value: stats?.activeLeads ?? 0,
            icon: Users,
            route: "inbox" as const,
        },
        {
            label: t("home.metrics.agents", { defaultValue: "Agentes" }),
            hint: t("home.metrics.agentsHint", { defaultValue: "Configurados para você" }),
            value: agents.length,
            icon: Bot,
            route: "agents" as const,
        },
        {
            label: t("home.metrics.connected", { defaultValue: "Conectados agora" }),
            hint: t("home.metrics.connectedHint", { defaultValue: "Agentes em operação" }),
            value: connectedAgents,
            icon: Activity,
            route: "cockpit" as const,
        },
    ]

    const quickLinks = [
        {
            title: t("home.quick.cockpit.title", { defaultValue: "Cabine de Operações" }),
            desc: t("home.quick.cockpit.desc", { defaultValue: "Monitoramento ao vivo e equipe de IA" }),
            icon: LayoutDashboard,
            route: "cockpit" as const,
        },
        {
            title: t("home.quick.inbox.title", { defaultValue: "Caixa de entrada" }),
            desc: t("home.quick.inbox.desc", { defaultValue: "Conversas e aprovações" }),
            icon: MessageSquare,
            route: "inbox" as const,
        },
        {
            title: t("home.quick.insights.title", { defaultValue: "Insights" }),
            desc: t("home.quick.insights.desc", { defaultValue: "Custos, canais e resumo" }),
            icon: PieChart,
            route: "insights" as const,
        },
        {
            title: t("home.quick.agents.title", { defaultValue: "Agentes" }),
            desc: t("home.quick.agents.desc", { defaultValue: "Central e templates" }),
            icon: Bot,
            route: "agents" as const,
        },
    ]

    return (
        <div className="min-h-full w-full min-w-0 animate-in fade-in duration-500 bg-background px-3 py-4 sm:px-5 sm:py-5 md:px-6 md:py-7 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-[1600px] space-y-6 sm:space-y-8">
                <div className="flex flex-col gap-4 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                            {t("home.title", { defaultValue: "Início" })}
                        </h1>
                        <p className="text-sm text-muted-foreground sm:text-base">
                            {displayName
                                ? t("home.welcomeNamed", {
                                      defaultValue: "Olá, {{name}} — visão geral da sua conta na SONIA.",
                                      name: displayName,
                                  })
                                : t("home.welcome", {
                                      defaultValue: "Visão geral da sua conta na SONIA.",
                                  })}
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 shrink-0 gap-2 self-start rounded-lg"
                        onClick={() => void load()}
                        disabled={refreshing}
                    >
                        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                        {t("home.refresh", { defaultValue: "Atualizar" })}
                    </Button>
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                        {t("home.sectionSummary", { defaultValue: "Resumo da conta" })}
                    </p>
                    <p className="max-w-3xl text-[11px] leading-relaxed text-pretty text-muted-foreground/90 sm:text-xs">
                        {t("home.sectionSummaryDesc", {
                            defaultValue:
                                "Números consolidados do que está associado ao seu login. Toque em um card para abrir a área relacionada.",
                        })}
                    </p>
                    <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 md:grid-cols-4 md:gap-4">
                        {summaryTiles.map((tile) => (
                            <Card
                                key={tile.label}
                                role="button"
                                tabIndex={0}
                                onClick={() => navigate(tile.route)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault()
                                        navigate(tile.route)
                                    }
                                }}
                                className={cn(
                                    cardChrome,
                                    "min-h-0 min-w-0 cursor-pointer hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                )}
                            >
                                <CardContent className="flex items-start gap-3 p-4 sm:p-5">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/50 dark:bg-muted/30">
                                        <tile.icon className="h-5 w-5 text-foreground" strokeWidth={2.25} />
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <p className="text-2xl font-semibold tabular-nums text-foreground">
                                            {loading ? dash : tile.value}
                                        </p>
                                        <p className="text-xs font-medium text-foreground">{tile.label}</p>
                                        <p className="text-[11px] leading-snug text-muted-foreground">{tile.hint}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {(kpis || !loading) && (
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                            {t("home.sectionKpi", { defaultValue: "Desempenho (KPIs)" })}
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                            <Card className={cn(cardChrome, "min-w-0")}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        {t("home.kpi.success", { defaultValue: "Taxa de sucesso" })}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold tabular-nums">
                                        {kpis ? `${kpis.taskSuccessRate.toFixed(1)}%` : dash}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className={cn(cardChrome, "min-w-0")}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        {t("home.kpi.latency", { defaultValue: "Tempo médio de resposta" })}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold tabular-nums">
                                        {kpis && kpis.averageResponseTime > 0
                                            ? `${(kpis.averageResponseTime / 1000).toFixed(1)}s`
                                            : dash}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className={cn(cardChrome, "min-w-0")}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        {t("home.kpi.cost", { defaultValue: "Custo por interação" })}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold tabular-nums break-all sm:break-normal">
                                        {kpis && kpis.costPerInteraction > 0
                                            ? `R$ ${kpis.costPerInteraction.toFixed(4)}`
                                            : dash}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                        {t("home.sectionQuick", { defaultValue: "Acesso rápido" })}
                    </p>
                    <p className="max-w-3xl text-[11px] leading-relaxed text-pretty text-muted-foreground/90 sm:text-xs">
                        {t("home.sectionQuickDesc", {
                            defaultValue: "Atalhos para as áreas mais usadas; o mesmo visual das outras telas da plataforma.",
                        })}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
                        {quickLinks.map((item) => (
                            <Card
                                key={item.route}
                                className={cn(
                                    cardChrome,
                                    "flex min-h-0 min-w-0 cursor-pointer flex-col hover:bg-muted/25 dark:hover:bg-muted/15"
                                )}
                                onClick={() => navigate(item.route)}
                            >
                                <CardHeader className="space-y-3 pb-2">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/70 bg-muted/40">
                                        <item.icon className="h-5 w-5" strokeWidth={2.25} />
                                    </div>
                                    <div className="min-w-0 space-y-1">
                                        <CardTitle className="text-base font-semibold leading-tight">
                                            {item.title}
                                        </CardTitle>
                                        <CardDescription className="text-xs leading-relaxed">
                                            {item.desc}
                                        </CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent className="mt-auto flex justify-end pt-0">
                                    <span className="flex items-center gap-1 text-xs font-medium text-primary">
                                        {t("home.open", { defaultValue: "Abrir" })}
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </span>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                <Card className={cn(cardChrome, "border-dashed")}>
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Sparkles className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-medium text-foreground">
                                    {t("home.labCta.title", { defaultValue: "Laboratório" })}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {t("home.labCta.desc", {
                                        defaultValue: "Teste mensagens e fluxos sem afetar o atendimento real.",
                                    })}
                                </p>
                            </div>
                        </div>
                        <Button className="shrink-0 rounded-lg" onClick={() => navigate("playground")}>
                            {t("home.labCta.button", { defaultValue: "Ir ao laboratório" })}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
