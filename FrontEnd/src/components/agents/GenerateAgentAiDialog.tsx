import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useTheme } from "next-themes"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Textarea } from "../ui/textarea"
import { Switch } from "../ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import { toast } from "sonner"
import {
  Sparkles,
  CheckCircle2,
  Loader2,
  Circle,
  Wand2,
  Headphones,
  HelpCircle,
  Rocket,
  Lock,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Plug,
  FileText,
  ShieldCheck,
} from "lucide-react"
import { cn } from "../ui/utils"
import { buildToolKey } from "../../lib/agent-extra-features"
import {
  SUPPORTED_AGENT_LANGUAGES,
  coerceToSupportedAgentLanguage,
} from "../../lib/agent-language"
import { IntegrationBrandIcon } from "../integrations/IntegrationBrandIcon"

export type AgentAiArchetype = "faq" | "receptive" | "sdr"

export type SelectedToolRow = {
  toolKey: string
  provider: string
  toolName: string
  enabled: boolean
  integrationId?: string
  crmIntegrationId?: string
}

type CatalogTool = {
  toolKey: string
  provider: string
  toolName: string
  displayName: string
  description: string
  requiresIntegrationId?: boolean
  requiresCrmIntegrationId?: boolean
}

type IntegrationOption = { id: string; label: string; isActive?: boolean }

type CatalogResponse = {
  tools: CatalogTool[]
  availableProviders: string[]
  setupProviders?: string[]
  integrationsByProvider: Record<string, IntegrationOption[]>
  providerLabels: Record<string, string>
}

type ValidationReport = {
  ok: boolean
  checks: { id: string; label: string; status: "ok" | "warn" | "fail"; message: string }[]
  chatTurn?: {
    userMessage: string
    replyPreview: string
    status: string
    message: string
  }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (agentId: string, options?: { navigateToConfig?: boolean }) => void
  defaultAgentLanguage?: string
}

type WizardPhase = "archetype" | "integrations" | "brief" | "generating" | "validation" | "done"

const SETUP_PROVIDER_ORDER = ["calendly", "hubspot", "whatsapp", "email"] as const

const WIZARD_STEPS: { id: WizardPhase; label: string }[] = [
  { id: "archetype", label: "Tipo" },
  { id: "integrations", label: "Integrações" },
  { id: "brief", label: "Descrição" },
  { id: "generating", label: "Gerar" },
  { id: "validation", label: "Resultado" },
]

const RECEPTIVE_DEFAULT_TOOLS: Record<string, string[]> = {
  calendly: [
    "check_availability",
    "book_appointment",
    "list_upcoming_appointments",
    "cancel_appointment",
  ],
  hubspot: ["lookup_contact", "create_contact", "update_contact"],
  whatsapp: ["send_session_message"],
}

function defaultToolsForArchetype(
  archetype: AgentAiArchetype,
  catalog: CatalogResponse | null
): SelectedToolRow[] {
  if (!catalog || archetype === "sdr") return []
  const connected = catalog.availableProviders || []
  const rows: SelectedToolRow[] = []

  const addProviderTools = (
    provider: string,
    toolNames: string[],
    useCrm: boolean
  ) => {
    if (!connected.includes(provider)) return
    const accounts = catalog.integrationsByProvider?.[provider] || []
    const binding = accounts.find((a) => a.isActive !== false) || accounts[0]
    if (!binding?.id) return

    for (const toolName of toolNames) {
      const cat = catalog.tools.find(
        (t) => t.provider === provider && t.toolName === toolName
      )
      if (!cat) continue
      rows.push({
        toolKey: cat.toolKey || buildToolKey(provider, toolName),
        provider,
        toolName,
        enabled: true,
        ...(useCrm ? { crmIntegrationId: binding.id } : { integrationId: binding.id }),
      })
    }
  }

  if (archetype === "receptive") {
    addProviderTools("calendly", RECEPTIVE_DEFAULT_TOOLS.calendly, false)
    addProviderTools("hubspot", RECEPTIVE_DEFAULT_TOOLS.hubspot, true)
    addProviderTools("whatsapp", RECEPTIVE_DEFAULT_TOOLS.whatsapp, false)
  }

  if (archetype === "faq" && connected.includes("hubspot")) {
    addProviderTools("hubspot", ["lookup_contact"], true)
  }

  return rows
}

function wizardStepIndex(phase: WizardPhase): number {
  const idx = WIZARD_STEPS.findIndex((s) => s.id === phase)
  return idx >= 0 ? idx : 0
}

function WizardStepper({
  phase,
  isDark,
  borderColor,
}: {
  phase: WizardPhase
  isDark: boolean
  borderColor: string
}) {
  const current = wizardStepIndex(phase)

  return (
    <nav
      className="flex flex-wrap items-center gap-1.5 sm:gap-2"
      aria-label="Etapas do assistente"
    >
      {WIZARD_STEPS.map((step, index) => {
        const done = index < current
        const active = index === current
        return (
          <div key={step.id} className="flex items-center gap-1.5 sm:gap-2">
            {index > 0 && (
              <span
                className="hidden h-px w-3 sm:block sm:w-5"
                style={{
                  background: done || active ? "hsl(var(--primary) / 0.45)" : borderColor,
                }}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors sm:px-3 sm:text-xs",
                active && "border-primary/40 bg-primary/10 text-foreground",
                done && !active && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                !done && !active && "border-border/80 bg-muted/20 text-muted-foreground"
              )}
            >
              {done && !active ? (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
              ) : (
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                    active
                      ? "bg-primary text-primary-foreground"
                      : isDark
                        ? "bg-zinc-800 text-zinc-400"
                        : "bg-zinc-200 text-zinc-600"
                  )}
                >
                  {index + 1}
                </span>
              )}
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{step.label.slice(0, 4)}</span>
            </span>
          </div>
        )
      })}
      <span className="sr-only">
        Etapa {current + 1} de {WIZARD_STEPS.length}: {WIZARD_STEPS[current]?.label}
      </span>
    </nav>
  )
}

function WizardFooter({
  children,
  borderColor,
  isDark,
}: {
  children: React.ReactNode
  borderColor: string
  isDark: boolean
}) {
  return (
    <DialogFooter
      className={cn(
        "shrink-0 flex-col-reverse gap-2 border-t px-4 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-6",
        isDark ? "bg-zinc-950/80" : "bg-slate-50/95"
      )}
      style={{ borderColor }}
    >
      {children}
    </DialogFooter>
  )
}

export function GenerateAgentAiDialog({
  open,
  onOpenChange,
  onCreated,
  defaultAgentLanguage = "pt-BR",
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  const [phase, setPhase] = useState<WizardPhase>("archetype")
  const [archetype, setArchetype] = useState<AgentAiArchetype>("receptive")
  const [agentName, setAgentName] = useState("")
  const [agentLanguage, setAgentLanguage] = useState(() =>
    coerceToSupportedAgentLanguage(defaultAgentLanguage, "pt-BR")
  )
  const [description, setDescription] = useState("")
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null)
  const [selectedTools, setSelectedTools] = useState<SelectedToolRow[]>([])
  const [claudeAvailable, setClaudeAvailable] = useState(false)
  const [refiningDescription, setRefiningDescription] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null)
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)

  const panelBorder = isDark ? "hsl(var(--border))" : "hsl(var(--border) / 0.85)"
  const panelMuted = isDark ? "#a1a1aa" : "#64748b"
  const inputClass = cn(
    "h-11 rounded-lg border shadow-none",
    isDark
      ? "border-white/10 bg-zinc-900/90 text-zinc-100 placeholder:text-zinc-500"
      : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
  )
  const selectTriggerClass = cn(
    "h-11 w-full rounded-lg border shadow-none",
    isDark
      ? "border-white/10 bg-zinc-900/90 text-zinc-100"
      : "border-slate-200 bg-white text-slate-900"
  )
  const cardSurface = cn(
    "rounded-xl border transition-colors",
    isDark ? "border-white/10 bg-zinc-900/50" : "border-slate-200/90 bg-slate-50/80"
  )

  const resetWizard = useCallback(() => {
    setPhase("archetype")
    setArchetype("receptive")
    setAgentName("")
    setDescription("")
    setSelectedTools([])
    setValidationReport(null)
    setCreatedAgentId(null)
    setGenerationError(null)
    setElapsedSec(0)
  }, [])

  useEffect(() => {
    if (!open) return
    resetWizard()
    setAgentLanguage(coerceToSupportedAgentLanguage(defaultAgentLanguage, "pt-BR"))

    ;(async () => {
      try {
        const { BASE_URL, getAuthHeaders } = await import("../../services/api")
        const res = await fetch(`${BASE_URL}/agents/generate-ai/status`, {
          headers: await getAuthHeaders(false),
        })
        const body = await res.json().catch(() => ({}))
        if (res.ok) {
          setCatalog(body.catalog || null)
          setClaudeAvailable(Boolean(body.claudeAvailable))
        }
      } catch {
        setCatalog(null)
      }
    })()
  }, [open, defaultAgentLanguage, resetWizard])

  useEffect(() => {
    if (phase !== "generating") return
    setElapsedSec(0)
    const timer = window.setInterval(() => setElapsedSec((s) => s + 1), 1000)
    return () => window.clearInterval(timer)
  }, [phase])

  const toolsByProvider = useMemo(() => {
    const map = new Map<string, CatalogTool[]>()
    for (const t of catalog?.tools || []) {
      const list = map.get(t.provider) || []
      list.push(t)
      map.set(t.provider, list)
    }
    return map
  }, [catalog])

  const selectedMap = useMemo(() => {
    const m = new Map<string, SelectedToolRow>()
    for (const row of selectedTools) m.set(row.toolKey, row)
    return m
  }, [selectedTools])

  const applyArchetypePresets = useCallback(
    (nextArchetype: AgentAiArchetype) => {
      if (!catalog) return
      setSelectedTools(defaultToolsForArchetype(nextArchetype, catalog))
    },
    [catalog]
  )

  const getBindingForProvider = (provider: string): string => {
    const row = selectedTools.find(
      (t) => t.provider === provider && (t.integrationId || t.crmIntegrationId)
    )
    if (provider === "hubspot") return row?.crmIntegrationId || ""
    return row?.integrationId || ""
  }

  const setBindingForProvider = (provider: string, bindingId: string) => {
    setSelectedTools((prev) =>
      prev.map((t) => {
        if (t.provider !== provider) return t
        if (provider === "hubspot") return { ...t, crmIntegrationId: bindingId }
        return { ...t, integrationId: bindingId }
      })
    )
  }

  const toggleTool = (tool: CatalogTool, enabled: boolean) => {
    const key = tool.toolKey || buildToolKey(tool.provider, tool.toolName)
    setSelectedTools((prev) => {
      const without = prev.filter((t) => t.toolKey !== key)
      if (!enabled) return without

      const bindingId =
        getBindingForProvider(tool.provider) ||
        catalog?.integrationsByProvider?.[tool.provider]?.[0]?.id ||
        ""

      return [
        ...without,
        {
          toolKey: key,
          provider: tool.provider,
          toolName: tool.toolName,
          enabled: true,
          ...(tool.provider === "hubspot"
            ? { crmIntegrationId: bindingId }
            : { integrationId: bindingId }),
        },
      ]
    })
  }

  const integrationsPayload = useMemo(() => {
    const calendlyId = getBindingForProvider("calendly")
    const whatsappId = getBindingForProvider("whatsapp")
    const crmId = getBindingForProvider("hubspot")
    return {
      calendlyIntegrationId: calendlyId || null,
      whatsappIntegrationId: whatsappId || null,
      crmIntegrationId: crmId || null,
    }
  }, [selectedTools])

  const loadingSteps = useMemo(
    () => [
      { title: "Brief de design (Claude)", detail: "Consolidar arquétipo, integrações e negócio." },
      { title: "Template profissional (GPT)", detail: "Gerar papel, personalidade e mensagem inicial." },
      { title: "Criar agente no banco", detail: "Template + agente + ferramentas configuradas." },
      { title: "Testar integrações e chat", detail: "Validar Calendly, WhatsApp e um turno de conversa." },
    ],
    []
  )

  const activeLoadingStep = Math.min(
    loadingSteps.length - 1,
    phase === "generating" ? Math.floor(elapsedSec / 8) : 0
  )

  const phaseTitle = useMemo(() => {
    switch (phase) {
      case "archetype":
        return "Tipo de agente"
      case "integrations":
        return "Integrações e ferramentas"
      case "brief":
        return "Descrição do agente"
      case "generating":
        return "Gerando agente"
      case "validation":
        return validationReport?.ok ? "Agente validado" : "Agente criado com avisos"
      default:
        return "Criar agente com IA"
    }
  }, [phase, validationReport?.ok])

  const phaseIcon = useMemo(() => {
    if (phase === "generating") return Loader2
    if (phase === "validation") return ShieldCheck
    if (phase === "integrations") return Plug
    if (phase === "brief") return FileText
    return Sparkles
  }, [phase])

  const PhaseIcon = phaseIcon

  async function handleRefineDescription() {
    const desc = description.trim()
    if (!desc) {
      toast.error("Escreva uma descrição antes de melhorar.")
      return
    }
    setRefiningDescription(true)
    try {
      const { BASE_URL, getAuthHeaders } = await import("../../services/api")
      const res = await fetch(`${BASE_URL}/flows/refine-description`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ description: desc, language: agentLanguage }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body?.error || "Não foi possível melhorar a descrição.")
        return
      }
      const refined = String(body.refinedDescription || "").trim()
      if (refined) setDescription(refined)
      toast.success("Descrição melhorada.")
    } catch {
      toast.error("Erro de rede ao melhorar a descrição.")
    } finally {
      setRefiningDescription(false)
    }
  }

  async function handleGenerate() {
    const desc = description.trim()
    if (!desc) {
      toast.error("Descreva o tema e a finalidade do agente.")
      return
    }

    const enabled = selectedTools.filter((t) => t.enabled !== false)
    if (archetype === "receptive" && enabled.length === 0) {
      toast.error("Selecione ao menos uma ferramenta de integração.")
      return
    }

    for (const t of enabled) {
      if (t.provider === "hubspot" && !t.crmIntegrationId) {
        toast.error("Selecione a conta HubSpot para as ferramentas marcadas.")
        return
      }
      if (["calendly", "whatsapp", "email"].includes(t.provider) && !t.integrationId) {
        toast.error(`Selecione a conta de ${t.provider} para as ferramentas marcadas.`)
        return
      }
    }

    setPhase("generating")
    setGenerationError(null)

    try {
      const { BASE_URL, getAuthHeaders } = await import("../../services/api")
      const res = await fetch(`${BASE_URL}/agents/generate-ai`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          description: desc,
          language: agentLanguage,
          archetype,
          agentName: agentName.trim() || undefined,
          selectedTools: enabled,
          integrations: integrationsPayload,
        }),
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok && res.status !== 207) {
        setPhase("brief")
        setGenerationError(body?.details || body?.error || "Falha ao gerar agente.")
        toast.error(body?.error || "Não foi possível gerar o agente.")
        return
      }

      const agentId = body?.agent?.id
      if (agentId) {
        setCreatedAgentId(agentId)
        onCreated(agentId, { navigateToConfig: false })
      }

      setValidationReport(body.validationReport || null)
      setPhase("validation")

      if (body.validationReport?.ok) {
        toast.success("Agente criado e validado com sucesso.")
      } else {
        toast.warning("Agente criado, mas alguns testes falharam. Revise antes de usar em produção.")
      }
    } catch (error) {
      console.error(error)
      setPhase("brief")
      toast.error("Erro de rede ao gerar o agente.")
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && (phase === "generating" || refiningDescription)) return
    if (!next) resetWizard()
    onOpenChange(next)
  }

  function goNextFromArchetype() {
    applyArchetypePresets(archetype)
    setPhase("integrations")
  }

  const statusIcon = (status: string) => {
    if (status === "ok") return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
    if (status === "warn") return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
    return <Circle className="h-4 w-4 shrink-0 text-red-500" />
  }

  const primaryBtnClass =
    "h-10 gap-2 rounded-lg px-5 text-sm font-semibold shadow-none bg-primary text-primary-foreground hover:bg-primary/90"
  const outlineBtnClass = cn(
    "h-10 gap-2 rounded-lg px-4 text-sm font-medium shadow-none",
    isDark
      ? "border-white/15 bg-transparent text-zinc-100 hover:bg-white/5"
      : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "flex w-[calc(100vw-1.25rem)] max-w-[calc(100vw-1.25rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-2xl lg:max-w-[720px]",
          "max-h-[min(92vh,880px)] rounded-xl border shadow-xl",
          isDark ? "border-white/10 bg-zinc-950" : "border-slate-200/90 bg-white"
        )}
        onPointerDownOutside={(e) =>
          (phase === "generating" || refiningDescription) && e.preventDefault()
        }
        onEscapeKeyDown={(e) =>
          (phase === "generating" || refiningDescription) && e.preventDefault()
        }
      >
        <div
          className={cn(
            "shrink-0 space-y-4 border-b px-4 pb-4 pt-5 sm:px-6 sm:pt-6",
            isDark ? "border-white/10 bg-zinc-950" : "border-slate-100 bg-white"
          )}
        >
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
                  isDark
                    ? "border-cyan-500/25 bg-cyan-500/10"
                    : "border-cyan-500/20 bg-cyan-500/10"
                )}
              >
                <PhaseIcon
                  className={cn(
                    "h-5 w-5 text-cyan-500",
                    phase === "generating" && "animate-spin"
                  )}
                  aria-hidden
                />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <DialogTitle className="text-lg font-semibold tracking-tight sm:text-xl">
                  {phase === "generating" || phase === "validation"
                    ? phaseTitle
                    : "Criar agente com IA"}
                </DialogTitle>
                <DialogDescription
                  className="text-sm leading-relaxed"
                  style={{ color: panelMuted }}
                >
                  {phase === "archetype" &&
                    "Escolha o perfil do agente. Em seguida, conecte integrações e descreva o atendimento."}
                  {phase === "integrations" &&
                    "Selecione contas conectadas e as ferramentas que o agente poderá usar no chat."}
                  {phase === "brief" &&
                    "Descreva negócio, tom e objetivos. A IA gera template, agente e validação automática."}
                  {phase === "generating" &&
                    "Isso costuma levar alguns segundos. Não feche esta janela."}
                  {phase === "validation" &&
                    "Revise os testes abaixo antes de colocar o agente em produção."}
                </DialogDescription>
              </div>
            </div>
            <WizardStepper phase={phase} isDark={isDark} borderColor={panelBorder} />
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          {phase === "archetype" && (
            <div className="space-y-4">
              <Label className="text-sm font-semibold">Tipo de agente</Label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setArchetype("faq")}
                  className={cn(
                    cardSurface,
                    "p-4 text-left hover:border-primary/30",
                    archetype === "faq" && "border-violet-500/40 bg-violet-500/10 ring-1 ring-violet-500/20"
                  )}
                >
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <HelpCircle className="h-4 w-4 text-violet-500" />
                    FAQ
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Responde dúvidas e orienta o usuário sem fluxo rígido de vendas.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setArchetype("receptive")}
                  className={cn(
                    cardSurface,
                    "p-4 text-left hover:border-primary/30",
                    archetype === "receptive" &&
                      "border-cyan-500/40 bg-cyan-500/10 ring-1 ring-cyan-500/20"
                  )}
                >
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <Headphones className="h-4 w-4 text-cyan-500" />
                    Receptivo
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Atendimento, dados do cliente, agenda Calendly e CRM.
                  </p>
                </button>

                <button
                  type="button"
                  disabled
                  className={cn(
                    cardSurface,
                    "relative border-dashed p-4 text-left opacity-55 sm:col-span-2 lg:col-span-1"
                  )}
                >
                  <Lock className="absolute right-3 top-3 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="mb-2 flex flex-wrap items-center gap-2 font-medium">
                    <Rocket className="h-4 w-4" />
                    SDR
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Em breve
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">Em desenvolvimento.</p>
                </button>
              </div>
            </div>
          )}

          {phase === "integrations" && (
            <div className="space-y-4">
              {SETUP_PROVIDER_ORDER.map((provider) => {
                const tools = toolsByProvider.get(provider) || []
                const accounts = catalog?.integrationsByProvider?.[provider] || []
                const hasAccounts = accounts.length > 0
                const label = catalog?.providerLabels?.[provider] || provider
                const enabledCount = tools.filter((t) =>
                  selectedMap.has(t.toolKey || buildToolKey(t.provider, t.toolName))
                ).length

                return (
                  <section key={provider} className={cn(cardSurface, "overflow-hidden")}>
                    <div
                      className={cn(
                        "flex flex-col gap-3 border-b px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between",
                        isDark ? "border-white/10 bg-zinc-900/40" : "border-slate-100 bg-slate-50/90"
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <IntegrationBrandIcon provider={provider} size="sm" boxed />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{label}</p>
                          {!hasAccounts ? (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Nenhuma conta conectada — configure em Integrações.
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {enabledCount} de {tools.length} ferramenta
                              {tools.length === 1 ? "" : "s"} ativa
                              {enabledCount === 1 ? "" : "s"}
                            </p>
                          )}
                        </div>
                      </div>
                      {hasAccounts && (
                        <div className="w-full sm:max-w-[240px]">
                          <Select
                            value={getBindingForProvider(provider) || accounts[0]?.id}
                            onValueChange={(v) => setBindingForProvider(provider, v)}
                          >
                            <SelectTrigger className={selectTriggerClass}>
                              <SelectValue placeholder="Conta" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[min(280px,45vh)]">
                              {accounts.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {hasAccounts && tools.length > 0 && (
                      <ul className="divide-y divide-border/60">
                        {tools.map((tool) => {
                          const key = tool.toolKey || buildToolKey(tool.provider, tool.toolName)
                          const on = selectedMap.has(key)
                          return (
                            <li
                              key={key}
                              className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                            >
                              <div className="min-w-0 flex-1 pr-2">
                                <p className="text-sm font-medium leading-snug">
                                  {tool.displayName}
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2 sm:line-clamp-none">
                                  {tool.description}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                                <span
                                  className={cn(
                                    "text-xs font-medium tabular-nums",
                                    on ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                                  )}
                                >
                                  {on ? "Ativo" : "Off"}
                                </span>
                                <Switch
                                  checked={on}
                                  onCheckedChange={(checked) => toggleTool(tool, checked)}
                                  aria-label={`${on ? "Desativar" : "Ativar"} ${tool.displayName}`}
                                />
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}

                    {!hasAccounts && (
                      <div className="px-4 py-5 text-center">
                        <p className="text-xs text-muted-foreground">
                          Conecte {label} em Configurações → Integrações para habilitar ferramentas aqui.
                        </p>
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          )}

          {phase === "brief" && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="ga-ai-name" className="text-sm font-semibold">
                    Nome do agente (opcional)
                  </Label>
                  <Input
                    id="ga-ai-name"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="Ex.: Assistente Comercial"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ga-ai-lang" className="text-sm font-semibold">
                    Idioma
                  </Label>
                  <Select
                    value={agentLanguage}
                    onValueChange={(v) =>
                      setAgentLanguage(coerceToSupportedAgentLanguage(v, "pt-BR"))
                    }
                  >
                    <SelectTrigger id="ga-ai-lang" className={selectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(320px,50vh)]">
                      {SUPPORTED_AGENT_LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Label htmlFor="ga-ai-desc" className="text-sm font-semibold">
                    Tema e finalidade do agente
                  </Label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className={cn("h-9 shrink-0 rounded-lg", outlineBtnClass)}
                    disabled={refiningDescription || !description.trim() || !claudeAvailable}
                    onClick={() => void handleRefineDescription()}
                  >
                    {refiningDescription ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    Melhorar com IA
                  </Button>
                </div>
                <Textarea
                  id="ga-ai-desc"
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o negócio, público, tom de voz e o que o agente deve fazer no atendimento..."
                  className={cn(
                    "min-h-[140px] resize-y rounded-lg border shadow-none",
                    isDark
                      ? "border-white/10 bg-zinc-900/90 text-zinc-100 placeholder:text-zinc-500"
                      : "border-slate-200 bg-white"
                  )}
                />
                {!claudeAvailable && (
                  <p className="text-xs text-muted-foreground">
                    Melhorar descrição requer Claude configurado no servidor.
                  </p>
                )}
              </div>

              {generationError && (
                <div
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-sm",
                    isDark
                      ? "border-red-500/30 bg-red-500/10 text-red-200"
                      : "border-red-200 bg-red-50 text-red-800"
                  )}
                >
                  {generationError}
                </div>
              )}
            </div>
          )}

          {phase === "generating" && (
            <div className="space-y-5" aria-busy="true" aria-live="polite">
              <ol className="space-y-2.5">
                {loadingSteps.map((step, index) => {
                  const done = index < activeLoadingStep
                  const active = index === activeLoadingStep
                  return (
                    <li
                      key={step.title}
                      className={cn(
                        "flex gap-3 rounded-xl border px-3.5 py-3.5 transition-colors",
                        active
                          ? "border-cyan-500/35 bg-cyan-500/[0.07] shadow-sm"
                          : cardSurface
                      )}
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center">
                        {done ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />
                        ) : active ? (
                          <Loader2 className="h-5 w-5 animate-spin text-cyan-500" aria-hidden />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground/45" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 space-y-0.5">
                        <span className="block text-sm font-medium">{step.title}</span>
                        <span className="block text-xs leading-snug text-muted-foreground">
                          {step.detail}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ol>
              <div className="flex flex-col items-center gap-2 pt-1">
                <div
                  className="gf-flow-indeterminate-track w-full max-w-sm"
                  role="progressbar"
                  aria-valuetext={`Em andamento, ${elapsedSec} segundos`}
                >
                  <div className="gf-flow-indeterminate-bar" />
                </div>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  Tempo decorrido: {elapsedSec}s
                </p>
              </div>
            </div>
          )}

          {phase === "validation" && validationReport && (
            <div className="space-y-4">
              <div
                className={cn(
                  "rounded-xl border p-4 sm:p-5",
                  validationReport.ok
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-amber-500/30 bg-amber-500/10"
                )}
              >
                <p className="font-semibold">
                  {validationReport.ok
                    ? "Agente validado com sucesso"
                    : "Agente criado com avisos"}
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  Revise os testes abaixo antes de colocar em produção.
                </p>
              </div>
              <ul
                className={cn(
                  "max-h-[min(220px,35vh)] space-y-2.5 overflow-y-auto rounded-xl border p-3 sm:p-4",
                  cardSurface
                )}
              >
                {validationReport.checks.map((c) => (
                  <li key={c.id} className="flex gap-2.5 text-sm items-start leading-relaxed">
                    {statusIcon(c.status)}
                    <span className="min-w-0">
                      <strong className="font-medium">{c.label}:</strong> {c.message}
                    </span>
                  </li>
                ))}
              </ul>
              {validationReport.chatTurn && (
                <div className={cn(cardSurface, "p-3.5 text-xs space-y-2")}>
                  <p>
                    <strong className="font-medium">Chat teste:</strong>{" "}
                    {validationReport.chatTurn.userMessage}
                  </p>
                  <p className="text-muted-foreground line-clamp-4 leading-relaxed">
                    {validationReport.chatTurn.replyPreview || "(sem resposta)"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {phase === "archetype" && (
          <WizardFooter borderColor={panelBorder} isDark={isDark}>
            <Button variant="outline" className={outlineBtnClass} onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button className={primaryBtnClass} onClick={goNextFromArchetype}>
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          </WizardFooter>
        )}

        {phase === "integrations" && (
          <WizardFooter borderColor={panelBorder} isDark={isDark}>
            <Button variant="outline" className={outlineBtnClass} onClick={() => setPhase("archetype")}>
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button className={primaryBtnClass} onClick={() => setPhase("brief")}>
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          </WizardFooter>
        )}

        {phase === "brief" && (
          <WizardFooter borderColor={panelBorder} isDark={isDark}>
            <Button variant="outline" className={outlineBtnClass} onClick={() => setPhase("integrations")}>
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button className={primaryBtnClass} onClick={() => void handleGenerate()}>
              <Sparkles className="h-4 w-4" />
              Gerar agente
            </Button>
          </WizardFooter>
        )}

        {phase === "validation" && validationReport && (
          <WizardFooter borderColor={panelBorder} isDark={isDark}>
            <Button
              className={cn(primaryBtnClass, "w-full sm:w-auto")}
              onClick={() => {
                if (createdAgentId) {
                  onCreated(createdAgentId, { navigateToConfig: true })
                  handleOpenChange(false)
                } else {
                  setPhase("brief")
                }
              }}
            >
              {createdAgentId ? "Abrir configuração do agente" : "Voltar"}
            </Button>
          </WizardFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
