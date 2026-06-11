import { useState, useEffect, useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import {
    Shield,
    Lock,
    EyeOff,
    FileText,
    AlertTriangle,
    Save,
    Loader2,
    Clock,
    CreditCard,
    Mail,
    Phone,
    IdCard,
    CheckCircle2,
    ArrowRight,
    Sparkles,
    Terminal,
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Switch } from "../components/ui/switch"
import { Label } from "../components/ui/label"
import { Badge } from "../components/ui/badge"
import { Input } from "../components/ui/input"
import { Separator } from "../components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert"
import { AgentService, GovernanceConfig } from "../services/api"
import { queryCache } from "../lib/query-cache"
import { useNavigation } from "../contexts/NavigationContext"
import { Textarea } from "../components/ui/textarea"
import { toast } from "sonner"
import { cn } from "../components/ui/utils"

const cardChrome =
    "rounded-xl border border-border/60 bg-white/85 backdrop-blur-sm text-card-foreground shadow-sm transition-all hover:bg-white/95 hover:shadow-md dark:border-white/[0.07] dark:bg-card/60 dark:shadow-none dark:hover:bg-card/75"

const BASELINE_ITEMS = [
    { icon: Lock, key: "dlp" },
    { icon: Shield, key: "injection" },
    { icon: FileText, key: "tone" },
] as const

const DLP_TYPES = [
    { icon: CreditCard, key: "card" },
    { icon: IdCard, key: "ssn" },
    { icon: Mail, key: "email" },
    { icon: Phone, key: "phone" },
] as const

const RETENTION_PRESETS = [7, 30, 90, 365, 9999] as const

type TestPanelState = Record<string, { kind: "blocked" | "allowed" | "info"; text: string } | null>

function snapshotConfig(
    config: GovernanceConfig,
    chatLogsRetention: number,
    voiceRetention: number,
): string {
    return JSON.stringify({
        antiHallucination: config.filters.antiHallucination,
        jailbreakProtection: config.filters.jailbreakProtection,
        chatLogsRetention,
        voiceRetention,
    })
}

function SafetyScoreGauge({
    grade,
    percentage,
    color,
    label,
    statusLabel,
}: {
    grade: string
    percentage: number
    color: string
    label: string
    statusLabel: string
}) {
    const radius = 48
    const circumference = 2 * Math.PI * radius

    return (
        <div className="flex w-full items-center gap-4 sm:w-auto sm:flex-col sm:gap-3">
            <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
                <svg
                    viewBox="0 0 112 112"
                    className="h-full w-full -rotate-90"
                    aria-hidden
                >
                    <circle
                        cx="56"
                        cy="56"
                        r={radius}
                        fill="none"
                        className="stroke-muted"
                        strokeWidth="10"
                    />
                    <circle
                        cx="56"
                        cy="56"
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth="10"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference * (1 - percentage / 100)}
                        strokeLinecap="round"
                        className="transition-[stroke-dashoffset] duration-700 ease-out"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold sm:text-3xl" style={{ color }}>
                        {grade}
                    </span>
                    <span className="mt-0.5 text-xs font-semibold text-muted-foreground">
                        {percentage.toFixed(0)}%
                    </span>
                </div>
            </div>
            <div className="min-w-0 text-left sm:text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {label}
                </p>
                <div className="mt-1 flex items-center gap-2 sm:justify-center">
                    <Shield className="h-4 w-4 shrink-0" style={{ color }} />
                    <span className="text-sm font-semibold" style={{ color }}>
                        {statusLabel}
                    </span>
                </div>
            </div>
        </div>
    )
}

function PlanUpgradeGate({
    planError,
    onUpgrade,
    t,
}: {
    planError: string
    onUpgrade: () => void
    t: (key: string, opts?: Record<string, unknown>) => string
}) {
    return (
        <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                        <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                            {t("header.title")}
                        </h1>
                        <p className="text-sm text-muted-foreground">{t("header.description")}</p>
                    </div>
                </div>
            </div>

            <Alert className="rounded-xl border-amber-500/30 bg-amber-500/5">
                <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="font-semibold">
                    {t("planGate.title", { defaultValue: "Personalização avançada — Enterprise" })}
                </AlertTitle>
                <AlertDescription className="text-sm">{planError}</AlertDescription>
            </Alert>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className={cn(cardChrome, "border-emerald-500/20")}>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            {t("planGate.alwaysActive.title", { defaultValue: "Já ativo no seu plano" })}
                        </CardTitle>
                        <CardDescription>
                            {t("planGate.alwaysActive.description", {
                                defaultValue:
                                    "Estas camadas rodam automaticamente em todo atendimento, sem configuração manual.",
                            })}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {BASELINE_ITEMS.map(({ icon: Icon, key }) => (
                            <div
                                key={key}
                                className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3"
                            >
                                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <p className="text-sm text-muted-foreground">
                                    {t(`planGate.alwaysActive.${key}`, {
                                        defaultValue:
                                            key === "dlp"
                                                ? "DLP: mascaramento de cartão, CPF, e-mail e telefone nas respostas."
                                                : key === "injection"
                                                  ? "Bloqueio crítico contra injeção de prompt e pedidos de revelar instruções internas."
                                                  : "Tom profissional e regras base de segurança no prompt do agente.",
                                    })}
                                </p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className={cn(cardChrome, "border-primary/20")}>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Lock className="h-4 w-4 text-primary" />
                            {t("planGate.enterprise.title", { defaultValue: "Com Enterprise você configura" })}
                        </CardTitle>
                        <CardDescription>
                            {t("planGate.enterprise.description", {
                                defaultValue:
                                    "Ajuste políticas globais da empresa e simule regras antes de publicar nos agentes.",
                            })}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                        <p>• {t("guardrails.rules.antiHallucination")}</p>
                        <p>• {t("guardrails.rules.jailbreakProtection")}</p>
                        <p>• {t("privacy.retention.title")}</p>
                        <p>• {t("guardrails.rules.testLabel")} + {t("privacy.preview.title")}</p>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full gap-2" onClick={onUpgrade}>
                            {t("planGate.upgradeCta", { defaultValue: "Ver planos e upgrade" })}
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}

export function Governance() {
    const { navigate } = useNavigation()
    const { t, i18n } = useTranslation("governance")
    const [config, setConfig] = useState<GovernanceConfig | null>(null)
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [testInputs, setTestInputs] = useState<{ [key: string]: string }>({})
    const [testPanel, setTestPanel] = useState<TestPanelState>({})
    const [testBusyKey, setTestBusyKey] = useState<string | null>(null)
    const [chatLogsRetention, setChatLogsRetention] = useState(90)
    const [voiceRetention, setVoiceRetention] = useState(30)
    const [previewMessage, setPreviewMessage] = useState("")
    const [planError, setPlanError] = useState<string | null>(null)
    const [savedSnapshot, setSavedSnapshot] = useState("")

    useEffect(() => {
        const checkTranslations = async () => {
            const currentLang = i18n.language || "pt-BR"
            const governanceTranslations = i18n.getResourceBundle(currentLang, "governance")

            if (!governanceTranslations || Object.keys(governanceTranslations).length === 0) {
                const { loadTranslationsFromDatabase } = await import("../i18n/config")
                const companiesId = localStorage.getItem("companies_id") || undefined
                await loadTranslationsFromDatabase(currentLang, companiesId)
                i18n.emit("loaded")
            }

            setPreviewMessage((prev) =>
                prev || t("audit.preview.default", { defaultValue: "Meu cartão é 4111 1111 1111 1111 e meu e-mail é cliente@empresa.com" }),
            )
        }

        void checkTranslations()

        const handleReload = () => void checkTranslations()
        i18n.on("languageChanged", handleReload)
        i18n.on("loaded", handleReload)
        i18n.on("added", handleReload)

        return () => {
            i18n.off("languageChanged", handleReload)
            i18n.off("loaded", handleReload)
            i18n.off("added", handleReload)
        }
    }, [i18n, t])

    const applyGovernanceData = (data: GovernanceConfig) => {
        setConfig(data)
        const chatDays = data.retention?.chatLogsRetentionDays ?? 90
        const voiceDays = data.retention?.voiceRetentionDays ?? 30
        setChatLogsRetention(chatDays)
        setVoiceRetention(voiceDays)
        setSavedSnapshot(snapshotConfig(data, chatDays, voiceDays))
    }

    const loadConfig = useCallback(async (force = false) => {
        const companiesId = localStorage.getItem('companies_id') || 'unknown'
        const cacheKey = `governance-config:${companiesId}`
        if (!force) {
            const cached = queryCache.get<GovernanceConfig>(cacheKey)
            if (cached) { applyGovernanceData(cached); setLoading(false); return }
        }
        setLoading(true)
        setPlanError(null)
        try {
            const data = await AgentService.getGovernanceConfig()
            queryCache.set(cacheKey, data, 5 * 60 * 1000)
            applyGovernanceData(data)
        } catch (err: unknown) {
            const e = err as Error & { code?: string }
            if (e.code === "PLAN_GOVERNANCE_REQUIRED") {
                setPlanError(e.message)
                setConfig(null)
            } else {
                toast.error(e.message || "Erro ao carregar governança")
            }
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadConfig()
    }, [loadConfig])

    const isDirty = useMemo(() => {
        if (!config) return false
        return savedSnapshot !== snapshotConfig(config, chatLogsRetention, voiceRetention)
    }, [config, chatLogsRetention, voiceRetention, savedSnapshot])

    const handleSave = async () => {
        if (!config) return
        setIsSaving(true)
        try {
            const configToSave: GovernanceConfig = {
                ...config,
                safetyThresholds: { hateSpeech: 100, sexualContent: 100, dangerousContent: 100 },
                filters: {
                    competitorBlocking: false,
                    antiHallucination: config.filters.antiHallucination,
                    jailbreakProtection: config.filters.jailbreakProtection,
                },
                dlp: { creditCard: true, ssn: true, email: true, phone: true },
                retention: {
                    chatLogsRetentionDays: chatLogsRetention,
                    voiceRetentionDays: voiceRetention,
                },
            }
            const updatedConfig = await AgentService.updateGovernanceConfig(configToSave)
            const companiesId = localStorage.getItem('companies_id') || 'unknown'
            queryCache.set(`governance-config:${companiesId}`, updatedConfig, 5 * 60 * 1000)
            setConfig(updatedConfig)
            const chatDays = updatedConfig.retention?.chatLogsRetentionDays ?? chatLogsRetention
            const voiceDays = updatedConfig.retention?.voiceRetentionDays ?? voiceRetention
            setChatLogsRetention(chatDays)
            setVoiceRetention(voiceDays)
            setSavedSnapshot(snapshotConfig(updatedConfig, chatDays, voiceDays))
            toast.success(t("governance.success.save", { defaultValue: "Configurações salvas com sucesso!" }))
        } catch (error: unknown) {
            const e = error as Error
            toast.error(e?.message || t("governance.error.save", { defaultValue: "Erro ao salvar configurações" }))
        } finally {
            setIsSaving(false)
        }
    }

    const updateFilter = (key: keyof GovernanceConfig["filters"], value: boolean) => {
        if (!config) return
        setConfig({
            ...config,
            filters: { ...config.filters, [key]: value },
        })
    }

    const calculateSafetyScore = () => {
        if (!config) return { score: 0, grade: "F", color: "#ef4444", percentage: 0 }

        let totalScore = 0
        if (config.filters.antiHallucination) totalScore += 50
        if (config.filters.jailbreakProtection) totalScore += 50

        const percentage = totalScore
        let grade = "F"
        let color = "#ef4444"

        if (percentage >= 95) {
            grade = "A+"
            color = "#10b981"
        } else if (percentage >= 90) {
            grade = "A"
            color = "#10b981"
        } else if (percentage >= 75) {
            grade = "B"
            color = "#eab308"
        } else if (percentage >= 50) {
            grade = "D"
            color = "#f97316"
        }

        return { score: totalScore, grade, color, percentage }
    }

    const runGovernanceTest = async (ruleKey: string) => {
        if (!config) return
        const input = (testInputs[ruleKey] || "").trim()
        const apiRule = ruleKey === "jailbreakProtection" ? "jailbreak" : "antiHallucination"

        if (apiRule === "jailbreak" && !input) {
            toast.error(
                t("guardrails.rules.jailbreakNeedMessage", {
                    defaultValue: "Digite uma mensagem para simular o jailbreak (é o mesmo pré-processamento do chat).",
                }),
            )
            return
        }

        setTestBusyKey(ruleKey)
        try {
            const filterPayload = {
                antiHallucination: config.filters.antiHallucination,
                jailbreakProtection: config.filters.jailbreakProtection,
            }
            const r = await AgentService.testGovernanceRule(apiRule, input, { filters: filterPayload })

            if (apiRule === "jailbreak") {
                const layerHint =
                    r.layer === "critical"
                        ? t("guardrails.rules.layerCritical", {
                              defaultValue: "Camada crítica — bloqueado mesmo com jailbreak desligado.",
                          })
                        : r.layer === "extended"
                          ? t("guardrails.rules.layerExtended", {
                                defaultValue: "Heurísticas estendidas (interruptor de jailbreak ligado).",
                            })
                          : ""
                const headline = r.blocked
                    ? t("guardrails.rules.testBlocked")
                    : t("guardrails.rules.testAllowed")
                const sim = r.simulation
                const parts = [
                    `— ${t("guardrails.rules.simulationHeader", { defaultValue: "Simulação (igual ao agente)" })} —`,
                    "",
                    headline,
                    layerHint ? `• ${layerHint}` : "",
                    sim?.usesSamePreProcessingAsChat
                        ? `• ${t("guardrails.rules.samePreProcess", { defaultValue: "Mesmo applyPreProcessing que o chat antes de chamar o modelo." })}`
                        : "",
                    r.blocked && sim?.blockedResponsePreview
                        ? `\n${t("guardrails.rules.userWouldSee", { defaultValue: "Resposta ao utilizador:" })}\n${sim.blockedResponsePreview}`
                        : "",
                ].filter(Boolean)
                setTestPanel((p) => ({
                    ...p,
                    [ruleKey]: {
                        kind: r.blocked ? "blocked" : "allowed",
                        text: parts.join("\n"),
                    },
                }))
            } else {
                const sim = r.simulation
                const lines: string[] = [
                    `— ${t("guardrails.rules.simulationHeader", { defaultValue: "Simulação (igual ao agente)" })} —`,
                    "",
                    `• ${t("guardrails.rules.antiInputNeverBlocked", { defaultValue: "Entrada: a mensagem do utilizador não é bloqueada (anti-alucinação não age no pré-processamento)." })}`,
                    sim?.antiHallucinationActive
                        ? `• ${t("guardrails.rules.antiSwitchOn", { defaultValue: "Interruptores nesta página: anti-alucinação LIGADA (reflete o teste)." })}`
                        : `• ${t("guardrails.rules.antiSwitchOff", { defaultValue: "Interruptores nesta página: anti-alucinação DESLIGADA." })}`,
                    sim?.usesSameInjectionAsChat
                        ? `• ${t("guardrails.rules.sameInject", { defaultValue: "Injeção: mesma função injectGovernanceRules usada no chatWithAgent." })}`
                        : "",
                    "",
                    t("guardrails.rules.extraPromptLabel", { defaultValue: "Trecho anti-alucinação no system prompt (quando ativo):" }),
                    sim?.extraPromptWhenActive || "—",
                    "",
                    t("guardrails.rules.expectedLabel", { defaultValue: "Comportamento esperado no agente:" }),
                    sim?.expectedBehavior ||
                        t("guardrails.rules.antiFallback", {
                            defaultValue:
                                "Com anti-alucinação ativa, o modelo deve priorizar RAG quando existir e evitar inventar dados da empresa quando o pedido não estiver coberto.",
                        }),
                ]
                if (sim?.fullGovernancePromptLengthChars != null) {
                    lines.push(
                        "",
                        `(${t("guardrails.rules.promptChars", { defaultValue: "Tamanho do prompt base + governança (simulação)" })}: ${sim.fullGovernancePromptLengthChars} ${t("guardrails.rules.chars", { defaultValue: "caracteres" })})`,
                    )
                }
                setTestPanel((p) => ({
                    ...p,
                    [ruleKey]: {
                        kind: "info",
                        text: lines.join("\n"),
                    },
                }))
            }
        } catch (e: unknown) {
            const err = e as Error
            toast.error(err?.message || "Erro ao testar")
            setTestPanel((p) => ({ ...p, [ruleKey]: null }))
        } finally {
            setTestBusyKey(null)
        }
    }

    const getRedactedMessage = (message: string) => {
        let redacted = message
        redacted = redacted.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "**** **** **** 7777")
        redacted = redacted.replace(/\b\d{13,19}\b/g, (match) => {
            if (match.length >= 13 && match.length <= 19) {
                return "**** **** **** " + match.slice(-4)
            }
            return match
        })
        redacted = redacted.replace(
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
            "[EMAIL PROTEGIDO]",
        )
        redacted = redacted.replace(
            /\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[\s-]?\d{4}\b/g,
            "[TELEFONE PROTEGIDO]",
        )
        redacted = redacted.replace(/\b\+?\d{1,3}[\s-]?\d{2,4}[\s-]?\d{4,9}\b/g, "[TELEFONE PROTEGIDO]")
        redacted = redacted.replace(/\b\d{3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{2}\b/g, "[CPF PROTEGIDO]")
        redacted = redacted.replace(/\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/g, "[SSN PROTEGIDO]")
        return redacted
    }

    const safetyScore = calculateSafetyScore()
    const safetyStatusLabel =
        safetyScore.grade === "A+"
            ? t("header.safetyScore.excellent")
            : safetyScore.grade.startsWith("A")
              ? t("header.safetyScore.veryGood")
              : safetyScore.grade.startsWith("B")
                ? t("header.safetyScore.good")
                : safetyScore.grade.startsWith("C")
                  ? t("header.safetyScore.attention")
                  : t("header.safetyScore.critical")

    const guardrailRules = [
        {
            key: "antiHallucination" as const,
            title: t("guardrails.rules.antiHallucination"),
            desc: t("guardrails.rules.antiHallucinationDesc"),
            icon: FileText,
            testPlaceholder: t("guardrails.rules.antiHallucinationTest"),
        },
        {
            key: "jailbreakProtection" as const,
            title: t("guardrails.rules.jailbreakProtection"),
            desc: t("guardrails.rules.jailbreakProtectionDesc"),
            icon: Lock,
            testPlaceholder: t("guardrails.rules.jailbreakProtectionTest"),
        },
    ]

    const retentionPresetLabel = (days: number) => {
        if (days === 7) return t("privacy.retention.days7")
        if (days === 30) return t("privacy.retention.days30")
        if (days === 90) return t("privacy.retention.days90")
        if (days === 365) return t("privacy.retention.year1")
        return t("privacy.retention.eternal")
    }

    if (loading) {
        return (
            <div className="flex h-[min(60vh,32rem)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (planError) {
        return (
            <PlanUpgradeGate
                planError={planError}
                onUpgrade={() => navigate("configuration?tab=billing")}
                t={t}
            />
        )
    }

    if (!config) {
        return (
            <div className="flex h-[min(60vh,32rem)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="relative mx-auto w-full max-w-7xl space-y-6 p-4 pb-24 sm:p-6 lg:p-8">
            {/* Hero */}
            <div className={cn(cardChrome, "overflow-hidden p-5 sm:p-6 lg:p-8")}>
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-md border-primary/30 bg-primary/5 text-primary">
                                {t("guardrails.alert.title")}
                            </Badge>
                            {config.lastUpdated ? (
                                <span className="text-xs text-muted-foreground">
                                    {t("header.lastUpdated", {
                                        defaultValue: "Atualizado",
                                    })}{" "}
                                    {new Date(config.lastUpdated).toLocaleString()}
                                </span>
                            ) : null}
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("header.title")}</h1>
                        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                            {t("header.description")}
                        </p>
                    </div>
                    <Card className={cn(cardChrome, "w-full shrink-0 border-emerald-500/25 p-4 lg:w-[240px]")}>
                        <SafetyScoreGauge
                            grade={safetyScore.grade}
                            percentage={safetyScore.percentage}
                            color={safetyScore.color}
                            label={t("header.safetyScore")}
                            statusLabel={safetyStatusLabel}
                        />
                    </Card>
                </div>
            </div>

            {/* Baseline protections strip */}
            <div className="grid gap-3 sm:grid-cols-3">
                {BASELINE_ITEMS.map(({ icon: Icon, key }) => (
                    <div
                        key={key}
                        className={cn(
                            cardChrome,
                            "flex items-start gap-3 p-4",
                            "border-emerald-500/15 bg-emerald-500/[0.03]",
                        )}
                    >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                            <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                                {t("baseline.alwaysOn", { defaultValue: "Sempre ativo" })}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {t(`baseline.${key}`, {
                                    defaultValue:
                                        key === "dlp"
                                            ? "DLP em respostas (cartão, CPF, e-mail, telefone)"
                                            : key === "injection"
                                              ? "Bloqueio crítico de injeção de prompt"
                                              : "Tom profissional e regras base de segurança",
                                })}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            <Tabs defaultValue="guardrails" className="space-y-5">
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
                    <TabsTrigger
                        value="guardrails"
                        className="rounded-lg py-2.5 text-[10px] font-semibold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:text-xs"
                    >
                        {t("tabs.guardrails")}
                    </TabsTrigger>
                    <TabsTrigger
                        value="privacy"
                        className="rounded-lg py-2.5 text-[10px] font-semibold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:text-xs"
                    >
                        {t("tabs.privacy")}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="guardrails" className="mt-0 space-y-5">
                    <Alert className="rounded-xl border-primary/20 bg-primary/5">
                        <Shield className="h-4 w-4 text-primary" />
                        <AlertTitle>{t("guardrails.alert.title")}</AlertTitle>
                        <AlertDescription>{t("guardrails.alert.description")}</AlertDescription>
                    </Alert>

                    <p className="rounded-xl border border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                        {t("guardrails.baselineSecureNote", {
                            defaultValue:
                                "Tom profissional e DLP (cartão, CPF, e-mail, telefone) estão sempre ativos no servidor. Uma camada crítica contra injeção de prompt bloqueia sempre, mesmo com o interruptor de jailbreak desligado. Com o interruptor ligado, entram heurísticas extras. Anti-alucinação reforça o prompt do agente (RAG); não bloqueia mensagens do utilizador.",
                        })}
                    </p>

                    <div className="grid gap-4 xl:grid-cols-2">
                        {guardrailRules.map((rule) => {
                            const isActive = config.filters[rule.key]
                            const Icon = rule.icon
                            const panel = testPanel[rule.key]

                            return (
                                <Card
                                    key={rule.key}
                                    className={cn(
                                        cardChrome,
                                        "overflow-hidden transition-colors",
                                        isActive && "border-primary/30 ring-1 ring-primary/10",
                                    )}
                                >
                                    <CardHeader className="space-y-0 pb-4">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="flex min-w-0 items-start gap-3">
                                                <div
                                                    className={cn(
                                                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                                                        isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                                                    )}
                                                >
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <CardTitle className="text-base">{rule.title}</CardTitle>
                                                    <CardDescription className="mt-1">{rule.desc}</CardDescription>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "shrink-0",
                                                        isActive
                                                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                                            : "text-muted-foreground",
                                                    )}
                                                >
                                                    {isActive
                                                        ? t("guardrails.status.on", { defaultValue: "Ativo" })
                                                        : t("guardrails.status.off", { defaultValue: "Inativo" })}
                                                </Badge>
                                                <Switch
                                                    checked={isActive}
                                                    onCheckedChange={(v) => updateFilter(rule.key, v)}
                                                />
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3 border-t border-border/60 pt-4">
                                        <Label className="text-xs font-semibold uppercase tracking-wide">
                                            {t("guardrails.rules.testLabel")}
                                        </Label>
                                        {rule.key === "antiHallucination" ? (
                                            <p className="text-xs text-muted-foreground">
                                                {t("guardrails.rules.antiOptionalHint", {
                                                    defaultValue:
                                                        "Opcional: escreva uma pergunta de exemplo. O teste mostra o trecho injetado no prompt (pode deixar vazio).",
                                                })}
                                            </p>
                                        ) : null}
                                        <Textarea
                                            placeholder={rule.testPlaceholder}
                                            value={testInputs[rule.key] || ""}
                                            onChange={(e) =>
                                                setTestInputs({ ...testInputs, [rule.key]: e.target.value })
                                            }
                                            className="min-h-[80px] resize-y bg-muted/30 text-sm"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="w-full sm:w-auto"
                                            disabled={testBusyKey === rule.key}
                                            onClick={() => void runGovernanceTest(rule.key)}
                                        >
                                            {testBusyKey === rule.key ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : null}
                                            {t("guardrails.rules.runTest", { defaultValue: "Testar" })}
                                        </Button>
                                        {panel ? (
                                            <div
                                                className={cn(
                                                    "max-h-[min(50vh,20rem)] overflow-y-auto whitespace-pre-wrap rounded-lg border p-3 text-xs leading-relaxed",
                                                    panel.kind === "blocked" &&
                                                        "border-red-500/25 bg-red-500/5 text-red-700 dark:text-red-400",
                                                    panel.kind === "allowed" &&
                                                        "border-emerald-500/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
                                                    panel.kind === "info" &&
                                                        "border-primary/20 bg-primary/5 text-foreground",
                                                )}
                                            >
                                                {panel.text}
                                            </div>
                                        ) : null}
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>

                    <Card className={cn(cardChrome, "border-primary/15")}>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Terminal className="h-4 w-4 text-primary" />
                                {t("guardrails.realTest.title", {
                                    defaultValue: "Teste real com o agente (Laboratório)",
                                })}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground marker:text-primary">
                                <li>{t("guardrails.realTest.step1")}</li>
                                <li>{t("guardrails.realTest.step2")}</li>
                                <li>{t("guardrails.realTest.step3")}</li>
                                <li>{t("guardrails.realTest.step4")}</li>
                            </ol>
                            <Button
                                variant="outline"
                                className="gap-2"
                                onClick={() => navigate("playground")}
                            >
                                {t("guardrails.openPlayground", { defaultValue: "Abrir Laboratório" })}
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="privacy" className="mt-0 space-y-5">
                    <div className="grid gap-5 lg:grid-cols-3">
                        <Card className={cn(cardChrome, "lg:col-span-2")}>
                            <CardHeader>
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Lock className="h-5 w-5 text-primary" />
                                            {t("privacy.dlp.title")}
                                        </CardTitle>
                                        <CardDescription className="mt-2">
                                            {t("privacy.dlp.alwaysOnDescription", {
                                                defaultValue:
                                                    "Mascaramento de cartão, CPF/documentos, e-mail e telefone nas respostas do agente está sempre ativo.",
                                            })}
                                        </CardDescription>
                                    </div>
                                    <Badge className="w-fit shrink-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                                        4 {t("privacy.dlp.protected")}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {DLP_TYPES.map(({ icon: Icon, key }) => (
                                        <div
                                            key={key}
                                            className="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3 text-center"
                                        >
                                            <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                {t(`privacy.dlp.types.${key}`, {
                                                    defaultValue:
                                                        key === "card"
                                                            ? "Cartão"
                                                            : key === "ssn"
                                                              ? "CPF/SSN"
                                                              : key === "email"
                                                                ? "E-mail"
                                                                : "Telefone",
                                                })}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <Alert className="rounded-xl border-emerald-500/20 bg-emerald-500/5">
                                    <AlertDescription className="text-sm text-muted-foreground">
                                        {t("privacy.dlp.typesList", {
                                            defaultValue:
                                                "Tipos cobertos: números de cartão, CPF/SSN, endereços de e-mail e telefones. Não é possível desativar pelo painel.",
                                        })}
                                    </AlertDescription>
                                </Alert>

                                <Card className={cn(cardChrome, "bg-muted/20")}>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-sm">
                                            <EyeOff className="h-4 w-4 text-primary" />
                                            {t("privacy.preview.title")}
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            {t("privacy.preview.description")}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="rounded-xl border border-border/60 bg-white/70 backdrop-blur-sm p-4 dark:border-white/[0.07] dark:bg-card/60">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                                                    U
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                                                        {t("privacy.preview.user")}
                                                    </p>
                                                    <Input
                                                        value={previewMessage}
                                                        onChange={(e) => setPreviewMessage(e.target.value)}
                                                        placeholder={t("privacy.preview.placeholder")}
                                                        className="bg-background"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="rounded-xl border border-border/60 bg-white/70 backdrop-blur-sm p-4 dark:border-white/[0.07] dark:bg-card/60">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                                    <Shield className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                                                        {t("privacy.preview.sonia")}
                                                        <Badge
                                                            variant="outline"
                                                            className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-400"
                                                        >
                                                            {t("privacy.dlp.protecting")}
                                                        </Badge>
                                                    </p>
                                                    <p className="text-sm italic text-muted-foreground">
                                                        {getRedactedMessage(previewMessage)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </CardContent>
                        </Card>

                        <Card className={cn(cardChrome, "h-fit")}>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                                        <Clock className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base">{t("privacy.retention.title")}</CardTitle>
                                        <CardDescription>{t("privacy.retention.description")}</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {(
                                    [
                                        {
                                            label: t("privacy.retention.chatLogs"),
                                            value: chatLogsRetention,
                                            setValue: setChatLogsRetention,
                                        },
                                        {
                                            label: t("privacy.retention.voiceRecordings"),
                                            value: voiceRetention,
                                            setValue: setVoiceRetention,
                                        },
                                    ] as const
                                ).map(({ label, value, setValue }) => (
                                    <div key={label} className="space-y-2">
                                        <Label className="flex items-center gap-2 text-sm font-medium">
                                            <Lock className="h-3.5 w-3.5 text-primary" />
                                            {label}
                                        </Label>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Input
                                                type="number"
                                                value={value === 9999 ? "" : value}
                                                onChange={(e) => {
                                                    const val = e.target.value === "" ? 9999 : Number(e.target.value)
                                                    setValue(val)
                                                }}
                                                placeholder={
                                                    value === 9999 ? t("privacy.retention.eternal") : undefined
                                                }
                                                className="w-20 bg-muted/30"
                                            />
                                            <span className="text-sm text-muted-foreground">
                                                {value === 9999
                                                    ? t("privacy.retention.eternal")
                                                    : t("privacy.retention.days")}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {RETENTION_PRESETS.map((days) => (
                                                <Button
                                                    key={days}
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className={cn(
                                                        "h-7 px-2.5 text-xs",
                                                        value === days &&
                                                            "border-primary bg-primary/10 text-primary",
                                                    )}
                                                    onClick={() => setValue(days)}
                                                >
                                                    {retentionPresetLabel(days)}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                <Separator />

                                <Alert variant="destructive" className="rounded-xl">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle className="text-xs font-semibold">
                                        {t("privacy.retention.purge.title")}
                                    </AlertTitle>
                                    <AlertDescription className="text-xs">
                                        {t("privacy.retention.purge.description")}
                                    </AlertDescription>
                                </Alert>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Sticky save bar */}
            <div
                className={cn(
                    "fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 px-4 py-3 backdrop-blur-md transition-transform duration-300 sm:px-6",
                    isDirty ? "translate-y-0" : "translate-y-full pointer-events-none",
                )}
            >
                <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                        {t("unsavedChanges", { defaultValue: "Alterações não salvas nas políticas de governança." })}
                    </p>
                    <Button className="w-full gap-2 sm:w-auto" onClick={() => void handleSave()} disabled={isSaving}>
                        {isSaving ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t("governance.button.saving")}
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                {t("guardrails.button.save")}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
