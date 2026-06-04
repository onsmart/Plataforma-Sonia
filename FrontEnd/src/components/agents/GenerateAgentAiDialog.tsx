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
  XCircle,
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

const SETUP_PROVIDER_ORDER = ["calendly", "hubspot", "whatsapp"] as const

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

  if (archetype === "faq") {
    addProviderTools("whatsapp", RECEPTIVE_DEFAULT_TOOLS.whatsapp, false)
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
      className="flex flex-wrap items-center gap-1 sm:gap-1.5"
      aria-label="Etapas do assistente"
    >
      {WIZARD_STEPS.map((step, index) => {
        const done = index < current
        const active = index === current
        return (
          <div key={step.id} className="flex items-center gap-1 sm:gap-1.5">
            {index > 0 && (
              <span
                className="hidden h-px w-4 sm:block sm:w-6"
                style={{
                  background: done
                    ? "hsl(var(--primary) / 0.5)"
                    : borderColor,
                }}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all sm:px-3 sm:text-xs",
                active && isDark && "border-primary/50 bg-primary/15 text-zinc-100",
                active && !isDark && "border-primary/35 bg-primary/10 text-slate-900",
                done && "border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                !done && !active && "border-border/60 bg-transparent text-muted-foreground"
              )}
            >
              {done ? (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
              ) : (
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
                    active
                      ? "bg-primary text-primary-foreground"
                      : isDark
                        ? "bg-zinc-800 text-zinc-500"
                        : "bg-slate-200 text-slate-500"
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
        "shrink-0 flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end sm:gap-2.5 sm:px-6",
        isDark
          ? "bg-gradient-to-b from-zinc-950 to-zinc-950/95"
          : "bg-gradient-to-b from-white to-slate-50/80"
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

  const setupProviderOrder = useMemo(() => {
    const fromApi = (catalog?.setupProviders || []).filter((p) => p !== "email")
    return fromApi.length > 0 ? fromApi : [...SETUP_PROVIDER_ORDER]
  }, [catalog?.setupProviders])

  const toolsByProvider = useMemo(() => {
    const map = new Map<string, CatalogTool[]>()
    for (const t of catalog?.tools || []) {
      if (t.provider === "email") continue
      const list = map.get(t.provider) || []
      list.push(t)
      map.set(t.provider, list)
    }
    return map
  }, [catalog])

  // FAQ só expõe WhatsApp; outros arquétipos mostram todos os providers
  const visibleProviders = useMemo(() => {
    if (archetype === "faq") return setupProviderOrder.filter((p) => p === "whatsapp")
    return setupProviderOrder
  }, [archetype, setupProviderOrder])

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

  const descriptionPlaceholder = useMemo(() => {
    if (archetype === "faq") {
      return "Ex.: Loja de eletrônicos. O agente responde dúvidas sobre produtos, garantias, prazos de entrega e política de trocas. Não agenda nem coleta dados — apenas orienta e informa. Tom direto e prestativo."
    }
    return "Ex.: Clínica odontológica que atende via WhatsApp. O agente recepciona pacientes, tira dúvidas sobre tratamentos, coleta nome e telefone, e agenda consultas pelo Calendly. Tom amigável e profissional."
  }, [archetype])

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
      if (["calendly", "whatsapp"].includes(t.provider) && !t.integrationId) {
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
    return <XCircle className="h-4 w-4 shrink-0 text-red-500" />
  }

  const primaryBtnClass =
    "h-10 gap-2 rounded-xl px-5 text-sm font-semibold shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
  const outlineBtnClass = cn(
    "h-10 gap-2 rounded-xl px-4 text-sm font-medium shadow-none border transition-colors",
    isDark
      ? "border-white/12 bg-zinc-900 text-zinc-200 hover:bg-white/5 hover:border-white/20"
      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "flex w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-2xl lg:max-w-[740px]",
          "max-h-[min(94vh,900px)] rounded-2xl border shadow-2xl",
          isDark ? "border-white/8 bg-zinc-950" : "border-slate-200 bg-white"
        )}
        onPointerDownOutside={(e) =>
          (phase === "generating" || refiningDescription) && e.preventDefault()
        }
        onEscapeKeyDown={(e) =>
          (phase === "generating" || refiningDescription) && e.preventDefault()
        }
      >
        {/* Header com gradiente sutil */}
        <div
          className={cn(
            "shrink-0 border-b px-5 pb-4 pt-5 sm:px-6 sm:pt-6",
            isDark
              ? "border-white/8 bg-gradient-to-b from-zinc-900 to-zinc-950"
              : "border-slate-100 bg-gradient-to-b from-slate-50 to-white"
          )}
        >
          <DialogHeader className="space-y-4 text-left">
            <div className="flex items-start gap-4">
              <span
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm",
                  phase === "validation" && validationReport?.ok
                    ? isDark
                      ? "border-emerald-500/30 bg-emerald-500/15 shadow-emerald-500/10"
                      : "border-emerald-500/25 bg-emerald-50 shadow-emerald-500/10"
                    : isDark
                      ? "border-cyan-500/25 bg-cyan-500/10 shadow-cyan-500/10"
                      : "border-cyan-500/20 bg-cyan-50 shadow-cyan-500/10"
                )}
              >
                <PhaseIcon
                  className={cn(
                    "h-5 w-5",
                    phase === "validation" && validationReport?.ok
                      ? "text-emerald-500"
                      : "text-cyan-500",
                    phase === "generating" && "animate-spin"
                  )}
                  aria-hidden
                />
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <DialogTitle className="text-xl font-bold tracking-tight">
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
                    "Descreva negócio, tom e objetivos. A IA gera o template, o agente e faz validação automática."}
                  {phase === "generating" &&
                    "Aguarde enquanto a IA cria o agente. Isso costuma levar alguns segundos."}
                  {phase === "validation" &&
                    "Confira os resultados abaixo e abra a configuração para personalizar o agente."}
                </DialogDescription>
              </div>
            </div>
            <WizardStepper phase={phase} isDark={isDark} borderColor={panelBorder} />
          </DialogHeader>
        </div>

        <div className="ga-ai-dialog-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">
          {phase === "archetype" && (
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-semibold">Tipo de agente</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Selecione o perfil que melhor descreve o objetivo do seu agente.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* FAQ */}
                <button
                  type="button"
                  onClick={() => setArchetype("faq")}
                  className={cn(
                    "group relative rounded-2xl border p-5 text-left transition-all duration-150",
                    "hover:shadow-md",
                    archetype === "faq"
                      ? isDark
                        ? "border-violet-500/50 bg-violet-500/10 shadow-sm ring-1 ring-violet-500/25"
                        : "border-violet-500/40 bg-violet-50 shadow-sm ring-1 ring-violet-500/20"
                      : isDark
                        ? "border-white/8 bg-zinc-900/50 hover:border-violet-500/25 hover:bg-violet-500/5"
                        : "border-slate-200 bg-white hover:border-violet-500/30 hover:bg-violet-50/40"
                  )}
                >
                  <div
                    className={cn(
                      "mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
                      archetype === "faq"
                        ? isDark
                          ? "border-violet-500/30 bg-violet-500/20"
                          : "border-violet-500/25 bg-violet-100"
                        : isDark
                          ? "border-white/10 bg-zinc-800"
                          : "border-slate-200 bg-slate-100"
                    )}
                  >
                    <HelpCircle
                      className={cn(
                        "h-5 w-5 transition-colors",
                        archetype === "faq" ? "text-violet-500" : "text-muted-foreground"
                      )}
                    />
                  </div>
                  <p className="mb-1 font-semibold text-sm">FAQ</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Responde dúvidas, orienta e informa. Ideal para suporte e atendimento consultivo.
                  </p>
                  {archetype === "faq" && (
                    <span className="absolute right-3 top-3">
                      <CheckCircle2 className="h-4 w-4 text-violet-500" />
                    </span>
                  )}
                </button>

                {/* Receptivo */}
                <button
                  type="button"
                  onClick={() => setArchetype("receptive")}
                  className={cn(
                    "group relative rounded-2xl border p-5 text-left transition-all duration-150",
                    "hover:shadow-md",
                    archetype === "receptive"
                      ? isDark
                        ? "border-cyan-500/50 bg-cyan-500/10 shadow-sm ring-1 ring-cyan-500/25"
                        : "border-cyan-500/40 bg-cyan-50 shadow-sm ring-1 ring-cyan-500/20"
                      : isDark
                        ? "border-white/8 bg-zinc-900/50 hover:border-cyan-500/25 hover:bg-cyan-500/5"
                        : "border-slate-200 bg-white hover:border-cyan-500/30 hover:bg-cyan-50/40"
                  )}
                >
                  <div
                    className={cn(
                      "mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
                      archetype === "receptive"
                        ? isDark
                          ? "border-cyan-500/30 bg-cyan-500/20"
                          : "border-cyan-500/25 bg-cyan-100"
                        : isDark
                          ? "border-white/10 bg-zinc-800"
                          : "border-slate-200 bg-slate-100"
                    )}
                  >
                    <Headphones
                      className={cn(
                        "h-5 w-5 transition-colors",
                        archetype === "receptive" ? "text-cyan-500" : "text-muted-foreground"
                      )}
                    />
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <p className="font-semibold text-sm">Receptivo</p>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        isDark
                          ? "bg-cyan-500/20 text-cyan-400"
                          : "bg-cyan-100 text-cyan-700"
                      )}
                    >
                      Popular
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Coleta dados, agenda via Calendly e salva leads no CRM. Atendimento completo.
                  </p>
                  {archetype === "receptive" && (
                    <span className="absolute right-3 top-3">
                      <CheckCircle2 className="h-4 w-4 text-cyan-500" />
                    </span>
                  )}
                </button>

                {/* SDR — em breve */}
                <button
                  type="button"
                  disabled
                  className={cn(
                    "relative rounded-2xl border border-dashed p-5 text-left opacity-50 sm:col-span-2 lg:col-span-1",
                    isDark ? "border-white/10 bg-zinc-900/30" : "border-slate-200 bg-slate-50/50"
                  )}
                >
                  <Lock className="absolute right-3 top-3 h-3.5 w-3.5 text-muted-foreground" />
                  <div
                    className={cn(
                      "mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl border",
                      isDark ? "border-white/10 bg-zinc-800" : "border-slate-200 bg-slate-100"
                    )}
                  >
                    <Rocket className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <p className="font-semibold text-sm">SDR</p>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Em breve
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Prospecção ativa e qualificação de leads com outbound automatizado.
                  </p>
                </button>
              </div>
            </div>
          )}

          {phase === "integrations" && (
            <div className="space-y-4">
              {archetype === "faq" && (
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-4 py-3",
                    isDark
                      ? "border-violet-500/25 bg-violet-500/10"
                      : "border-violet-200 bg-violet-50"
                  )}
                >
                  <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">Agente FAQ</span> — responde dúvidas sem executar ações externas. Calendly e CRM não estão disponíveis neste perfil.
                    O WhatsApp é opcional e permite que o agente opere nesse canal.
                  </p>
                </div>
              )}
              {visibleProviders.map((provider) => {
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
                    Nome do agente
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input
                    id="ga-ai-name"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="Ex.: Assistente Comercial, Atendente Clara..."
                    className={inputClass}
                    maxLength={80}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Se deixar em branco, a IA sugere um nome baseado na descrição.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ga-ai-lang" className="text-sm font-semibold">
                    Idioma do agente
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Label htmlFor="ga-ai-desc" className="text-sm font-semibold">
                      Descrição do agente
                    </Label>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Descreva o negócio, o público, o tom e o que o agente deve fazer.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className={cn("h-9 shrink-0 rounded-xl", outlineBtnClass)}
                    disabled={refiningDescription || !description.trim() || !claudeAvailable}
                    onClick={() => void handleRefineDescription()}
                    title={!claudeAvailable ? "Requer Claude configurado no servidor" : undefined}
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
                  rows={7}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={descriptionPlaceholder}
                  className={cn(
                    "min-h-[160px] resize-y rounded-xl border shadow-none",
                    isDark
                      ? "border-white/10 bg-zinc-900/90 text-zinc-100 placeholder:text-zinc-600"
                      : "border-slate-200 bg-white placeholder:text-slate-400"
                  )}
                />
                <div className="flex items-center justify-between">
                  {!claudeAvailable ? (
                    <p className="text-[11px] text-muted-foreground">
                      "Melhorar com IA" requer Claude configurado no servidor.
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Quanto mais detalhada a descrição, melhor o agente gerado.
                    </p>
                  )}
                  <p
                    className={cn(
                      "text-[11px] tabular-nums",
                      description.length > 1800 ? "text-amber-500" : "text-muted-foreground"
                    )}
                  >
                    {description.length} caracteres
                  </p>
                </div>
              </div>

              {generationError && (
                <div
                  className={cn(
                    "flex gap-3 items-start rounded-xl border px-4 py-3 text-sm",
                    isDark
                      ? "border-red-500/30 bg-red-500/10 text-red-200"
                      : "border-red-200 bg-red-50 text-red-800"
                  )}
                >
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{generationError}</span>
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
                        "flex gap-3.5 rounded-2xl border px-4 py-4 transition-all duration-300",
                        active
                          ? isDark
                            ? "border-cyan-500/35 bg-cyan-500/[0.08] shadow-sm shadow-cyan-500/5"
                            : "border-cyan-500/30 bg-cyan-50/80 shadow-sm"
                          : cardSurface
                      )}
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center">
                        {done ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />
                        ) : active ? (
                          <Loader2 className="h-5 w-5 animate-spin text-cyan-500" aria-hidden />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground/35" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 space-y-0.5">
                        <span
                          className={cn(
                            "block text-sm font-semibold",
                            !done && !active && "text-muted-foreground"
                          )}
                        >
                          {step.title}
                        </span>
                        <span className="block text-xs leading-snug text-muted-foreground">
                          {step.detail}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ol>
              <div className="flex flex-col items-center gap-2.5 pt-1">
                <div
                  className="gf-flow-indeterminate-track w-full max-w-xs"
                  role="progressbar"
                  aria-valuetext={`Em andamento, ${elapsedSec} segundos`}
                >
                  <div className="gf-flow-indeterminate-bar" />
                </div>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {elapsedSec}s decorridos
                </p>
              </div>
            </div>
          )}

          {phase === "validation" && validationReport && (
            <div className="space-y-4">
              {/* Banner de status — compacto */}
              <div
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-4 py-3.5",
                  validationReport.ok
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-amber-500/30 bg-amber-500/10"
                )}
              >
                {validationReport.ok ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug">
                    {validationReport.ok
                      ? "Tudo certo — agente pronto para uso"
                      : "Agente criado com avisos"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {validationReport.ok
                      ? `${validationReport.checks.length} verificações passaram com sucesso.`
                      : `${validationReport.checks.filter(c => c.status !== "ok").length} ${validationReport.checks.filter(c => c.status !== "ok").length === 1 ? "item precisa" : "itens precisam"} de atenção antes de usar em produção.`}
                  </p>
                </div>
              </div>

              {/* Itens com warn/fail — destaque individual */}
              {validationReport.checks.some(c => c.status !== "ok") && (
                <div className="space-y-2">
                  {validationReport.checks
                    .filter(c => c.status !== "ok")
                    .map(c => (
                      <div
                        key={c.id}
                        className={cn(
                          "flex gap-3 items-start rounded-xl border px-4 py-3",
                          c.status === "warn"
                            ? isDark
                              ? "border-amber-500/25 bg-amber-500/10"
                              : "border-amber-200 bg-amber-50"
                            : isDark
                              ? "border-red-500/25 bg-red-500/10"
                              : "border-red-200 bg-red-50"
                        )}
                      >
                        {statusIcon(c.status)}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug">{c.label}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            {c.message}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Verificações OK — lista compacta */}
              {validationReport.checks.some(c => c.status === "ok") && (
                <div className={cn(cardSurface, "px-4 py-3.5")}>
                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {validationReport.checks.every(c => c.status === "ok")
                      ? "Verificações"
                      : "Verificações OK"}
                  </p>
                  <ul className="space-y-2">
                    {validationReport.checks
                      .filter(c => c.status === "ok")
                      .map(c => (
                        <li key={c.id} className="flex items-start gap-2.5 text-sm">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="min-w-0 leading-snug">
                            <span className="font-medium">{c.label}</span>
                            {c.message && (
                              <span className="ml-1 text-muted-foreground">— {c.message}</span>
                            )}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {/* Chat de teste — bolhas de conversa */}
              {validationReport.chatTurn && (
                <div className={cn(cardSurface, "overflow-hidden")}>
                  <div
                    className={cn(
                      "border-b px-4 py-2.5",
                      isDark ? "border-white/10" : "border-slate-100"
                    )}
                  >
                    <p className="text-xs font-semibold text-muted-foreground">
                      Conversa de teste
                    </p>
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex justify-end">
                      <div
                        className={cn(
                          "max-w-[82%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm leading-relaxed",
                          isDark
                            ? "bg-primary/25 text-zinc-100"
                            : "bg-primary/[0.12] text-slate-800"
                        )}
                      >
                        {validationReport.chatTurn.userMessage}
                      </div>
                    </div>
                    {validationReport.chatTurn.replyPreview ? (
                      <div className="flex justify-start">
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed",
                            isDark
                              ? "bg-zinc-800/90 text-zinc-200"
                              : "bg-slate-100 text-slate-700"
                          )}
                        >
                          {validationReport.chatTurn.replyPreview}
                        </div>
                      </div>
                    ) : (
                      <p className="py-1 text-center text-xs text-muted-foreground">
                        (sem resposta de teste)
                      </p>
                    )}
                  </div>
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
              variant="outline"
              className={outlineBtnClass}
              onClick={() => handleOpenChange(false)}
            >
              Fechar
            </Button>
            <Button
              className={primaryBtnClass}
              onClick={() => {
                if (createdAgentId) {
                  onCreated(createdAgentId, { navigateToConfig: true })
                  handleOpenChange(false)
                } else {
                  setPhase("brief")
                }
              }}
            >
              {createdAgentId ? (
                <>
                  <Wand2 className="h-4 w-4" />
                  Abrir configuração
                </>
              ) : (
                "Voltar"
              )}
            </Button>
          </WizardFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
