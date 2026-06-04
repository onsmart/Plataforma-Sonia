import {
    ArrowRight,
    Bot,
    BarChart3,
    GitBranch,
    LayoutDashboard,
    MessageSquare,
    PieChart,
    Sparkles,
    Zap,
    MessageCircle,
    Shield,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { useAuth } from "../contexts/AuthContext"
import { useNavigation } from "../contexts/NavigationContext"
import { cn } from "../components/ui/utils"

const cardChrome =
    "rounded-xl border border-border/80 bg-card/90 text-card-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-border dark:border-border dark:bg-card/80 dark:shadow-none"

const featureCards = [
    {
        icon: MessageCircle,
        title: "Atendimento Multicanal",
        desc: "WhatsApp, webchat e e-mail unificados em um único painel. Respostas automáticas com IA e handoff para humanos quando necessário.",
        accent: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/10 dark:bg-emerald-500/10",
        border: "border-emerald-500/20",
    },
    {
        icon: GitBranch,
        title: "Fluxos Inteligentes",
        desc: "Construa jornadas de atendimento visuais com blocos de decisão, integrações de CRM e ativadores de IA sem escrever código.",
        accent: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-500/10 dark:bg-blue-500/10",
        border: "border-blue-500/20",
    },
    {
        icon: BarChart3,
        title: "Insights em Tempo Real",
        desc: "Acompanhe volume de atendimentos, custo por conversa, desempenho por canal e taxa de sucesso dos seus agentes.",
        accent: "text-violet-600 dark:text-violet-400",
        bg: "bg-violet-500/10 dark:bg-violet-500/10",
        border: "border-violet-500/20",
    },
    {
        icon: Shield,
        title: "Agentes Confiáveis",
        desc: "Agentes de IA com personalidade definida, base de conhecimento RAG e governança para garantir respostas precisas e seguras.",
        accent: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500/10 dark:bg-amber-500/10",
        border: "border-amber-500/20",
    },
]

const quickLinks = [
    {
        title: "Cabine de Operações",
        desc: "Monitoramento ao vivo e equipe de IA",
        icon: LayoutDashboard,
        route: "cockpit" as const,
    },
    {
        title: "Caixa de Entrada",
        desc: "Conversas e aprovações",
        icon: MessageSquare,
        route: "inbox" as const,
    },
    {
        title: "Insights",
        desc: "Métricas, dados e resumo da conta",
        icon: PieChart,
        route: "insights" as const,
    },
    {
        title: "Agentes",
        desc: "Central e templates",
        icon: Bot,
        route: "agents" as const,
    },
]

export function Home() {
    const { t } = useTranslation("navigation")
    const { firstName } = useAuth()
    const { navigate } = useNavigation()

    const greeting = firstName ? `Olá, ${firstName}` : "Bem-vindo"

    return (
        <div className="min-h-full w-full min-w-0 animate-in fade-in duration-500 px-3 py-4 sm:px-5 sm:py-6 md:px-6 md:py-8 lg:px-8 lg:py-10">
            <div className="mx-auto max-w-[1600px] space-y-10">

                {/* Hero */}
                <div className="relative space-y-5 pb-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
                        <Zap className="h-3 w-3" />
                        Plataforma de Atendimento com IA
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                            {greeting} —
                            <br />
                            <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-violet-400 dark:to-indigo-400">
                                sua IA de atendimento
                            </span>{" "}
                            está pronta.
                        </h1>
                        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                            A SONIA centraliza canais, automatiza fluxos e entrega inteligência conversacional para sua equipe operar com mais velocidade e menos esforço.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3 pt-1">
                        <Button
                            size="lg"
                            className="rounded-xl gap-2"
                            onClick={() => navigate("agents")}
                        >
                            <Bot className="h-4 w-4" />
                            Gerenciar Agentes
                        </Button>
                        <Button
                            variant="outline"
                            size="lg"
                            className="rounded-xl gap-2 bg-background/60 backdrop-blur-sm"
                            onClick={() => navigate("insights")}
                        >
                            <BarChart3 className="h-4 w-4" />
                            Ver Dados & Métricas
                        </Button>
                    </div>
                </div>

                {/* Platform Features */}
                <div className="space-y-4">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            O que a plataforma oferece
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {featureCards.map((feature) => (
                            <Card
                                key={feature.title}
                                className={cn(
                                    cardChrome,
                                    "border",
                                    feature.border,
                                )}
                            >
                                <CardHeader className="pb-3">
                                    <div className={cn(
                                        "flex h-10 w-10 items-center justify-center rounded-lg",
                                        feature.bg,
                                    )}>
                                        <feature.icon className={cn("h-5 w-5", feature.accent)} strokeWidth={2} />
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2 pt-0">
                                    <CardTitle className="text-sm font-semibold leading-snug">
                                        {feature.title}
                                    </CardTitle>
                                    <CardDescription className="text-xs leading-relaxed">
                                        {feature.desc}
                                    </CardDescription>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Quick Access */}
                <div className="space-y-4">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            {t("home.sectionQuick", { defaultValue: "Acesso rápido" })}
                        </p>
                        <p className="text-xs text-muted-foreground/80">
                            Atalhos para as áreas mais usadas da plataforma.
                        </p>
                    </div>
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

                {/* Lab CTA */}
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
