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

export function Home() {
    const { t } = useTranslation("navigation")
    const { firstName } = useAuth()
    const { navigate } = useNavigation()

    const greeting = firstName
        ? t("home.hero.greetingNamed", { name: firstName })
        : t("home.hero.greeting")

    const featureCards = [
        {
            icon: MessageCircle,
            title: t("home.features.multichannel.title"),
            desc: t("home.features.multichannel.desc"),
            accent: "text-white",
            bg: "bg-gradient-to-br from-emerald-500 to-emerald-600",
            border: "border-emerald-500/20",
        },
        {
            icon: GitBranch,
            title: t("home.features.flows.title"),
            desc: t("home.features.flows.desc"),
            accent: "text-white",
            bg: "bg-gradient-to-br from-blue-500 to-blue-600",
            border: "border-blue-500/20",
        },
        {
            icon: BarChart3,
            title: t("home.features.insights.title"),
            desc: t("home.features.insights.desc"),
            accent: "text-white",
            bg: "bg-gradient-to-br from-violet-500 to-violet-700",
            border: "border-violet-500/20",
        },
        {
            icon: Shield,
            title: t("home.features.trust.title"),
            desc: t("home.features.trust.desc"),
            accent: "text-white",
            bg: "bg-gradient-to-br from-amber-500 to-amber-600",
            border: "border-amber-500/20",
        },
    ]

    const quickLinks = [
        {
            title: t("home.quick.cockpit.title"),
            desc: t("home.quick.cockpit.desc"),
            icon: LayoutDashboard,
            route: "cockpit" as const,
        },
        {
            title: t("home.quick.inbox.title"),
            desc: t("home.quick.inbox.desc"),
            icon: MessageSquare,
            route: "inbox" as const,
        },
        {
            title: t("home.quick.insights.title"),
            desc: t("home.quick.insights.desc"),
            icon: PieChart,
            route: "insights" as const,
        },
        {
            title: t("home.quick.agents.title"),
            desc: t("home.quick.agents.desc"),
            icon: Bot,
            route: "agents" as const,
        },
    ]

    return (
        <div className="min-h-full w-full min-w-0 animate-in fade-in duration-500 px-3 py-4 sm:px-5 sm:py-6 md:px-6 md:py-8 lg:px-8 lg:py-10">
            <div className="mx-auto max-w-[1600px] space-y-10">

                <div className="relative space-y-5 pb-2">
                    <div className="hero-badge-animated inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-linear-to-r from-blue-500/12 via-violet-500/10 to-blue-500/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary dark:border-blue-400/20 dark:from-blue-500/10 dark:via-violet-500/8 dark:to-blue-500/10">
                        <Zap className="h-3 w-3" />
                        {t("home.hero.badge")}
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                            {greeting} —
                            <br />
                            <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-violet-400 dark:to-indigo-400">
                                {t("home.hero.headline")}
                            </span>{" "}
                            {t("home.hero.headlinePrefix")}
                        </h1>
                        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                            {t("home.hero.description")}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3 pt-1">
                        <Button
                            variant="gradient"
                            size="lg"
                            className="rounded-xl gap-2"
                            onClick={() => navigate("agents")}
                        >
                            <Bot className="h-4 w-4" />
                            {t("home.hero.manageAgents")}
                        </Button>
                        <Button
                            variant="outline"
                            size="lg"
                            className="rounded-xl gap-2 border-blue-200/60 bg-white/70 backdrop-blur-sm hover:border-blue-300/80 hover:bg-white/90 dark:bg-background/60 dark:border-border"
                            onClick={() => navigate("insights")}
                        >
                            <BarChart3 className="h-4 w-4" />
                            {t("home.hero.viewMetrics")}
                        </Button>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            {t("home.sectionFeatures")}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {featureCards.map((feature) => (
                            <Card
                                key={feature.title}
                                className={cn(
                                    cardChrome,
                                    "card-gradient-border",
                                )}
                            >
                                <CardHeader className="pb-3">
                                    <div className={cn(
                                        "flex h-10 w-10 items-center justify-center rounded-xl shadow-sm",
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

                <div className="space-y-4">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            {t("home.sectionQuick")}
                        </p>
                        <p className="text-xs text-muted-foreground/80">
                            {t("home.sectionQuickDescAlt")}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
                        {quickLinks.map((item) => (
                            <Card
                                key={item.route}
                                className={cn(
                                    cardChrome,
                                    "flex min-h-0 min-w-0 cursor-pointer flex-col"
                                )}
                                onClick={() => navigate(item.route)}
                            >
                                <CardHeader className="space-y-3 pb-2">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-blue-500/10 to-violet-500/10 border border-blue-200/50 text-primary dark:bg-muted/40 dark:border-border/70 dark:text-foreground">
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
                                        {t("home.open")}
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </span>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                <Card className={cn(cardChrome, "card-gradient-border")}>
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-blue-500/15 to-violet-500/15 border border-blue-200/50 text-primary dark:bg-primary/10 dark:border-transparent">
                                <Sparkles className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-medium text-foreground">
                                    {t("home.labCta.title")}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {t("home.labCta.desc")}
                                </p>
                            </div>
                        </div>
                        <Button className="shrink-0 rounded-lg" onClick={() => navigate("playground")}>
                            {t("home.labCta.button")}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
