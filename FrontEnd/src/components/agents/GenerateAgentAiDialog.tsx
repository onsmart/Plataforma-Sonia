import React, { useCallback, useEffect, useMemo, useState } from "react"
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

export function GenerateAgentAiDialog({
  open,
  onOpenChange,
  onCreated,
  defaultAgentLanguage = "pt-BR",
}: Props) {
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
      (t) =>
        t.provider === provider && (t.integrationId || t.crmIntegrationId)
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
    if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-500" />
    return <Circle className="h-4 w-4 text-red-500" />
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn("sm:max-w-2xl max-h-[90vh] overflow-y-auto")}
        onPointerDownOutside={(e) =>
          (phase === "generating" || refiningDescription) && e.preventDefault()
        }
        onEscapeKeyDown={(e) =>
          (phase === "generating" || refiningDescription) && e.preventDefault()
        }
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Criar agente com IA
          </DialogTitle>
          <DialogDescription>
            Gera um template profissional e um agente completo, com integrações configuradas.
          </DialogDescription>
        </DialogHeader>

        {phase === "archetype" && (
          <div className="space-y-4 py-2">
            <Label>Tipo de agente</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setArchetype("faq")}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  archetype === "faq"
                    ? "border-violet-500/50 bg-violet-500/10"
                    : "border-border hover:bg-muted/40"
                )}
              >
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <HelpCircle className="h-4 w-4 text-violet-500" />
                  FAQ
                </div>
                <p className="text-xs text-muted-foreground">
                  Responde dúvidas e orienta o usuário sem fluxo rígido de vendas.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setArchetype("receptive")}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  archetype === "receptive"
                    ? "border-cyan-500/50 bg-cyan-500/10"
                    : "border-border hover:bg-muted/40"
                )}
              >
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <Headphones className="h-4 w-4 text-cyan-500" />
                  Receptivo
                </div>
                <p className="text-xs text-muted-foreground">
                  Atendimento, dados do cliente, agenda Calendly e CRM.
                </p>
              </button>

              <button
                type="button"
                disabled
                className="relative rounded-xl border border-dashed p-4 text-left opacity-60"
              >
                <Lock className="absolute right-3 top-3 h-3.5 w-3.5" />
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <Rocket className="h-4 w-4" />
                  SDR
                </div>
                <p className="text-xs text-muted-foreground">Em desenvolvimento.</p>
              </button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={goNextFromArchetype}>
                Próximo
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === "integrations" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Marque as integrações conectadas e as ferramentas que o agente poderá usar.
            </p>
            {SETUP_PROVIDER_ORDER.map((provider) => {
              const tools = toolsByProvider.get(provider) || []
              const accounts = catalog?.integrationsByProvider?.[provider] || []
              const hasAccounts = accounts.length > 0
              const label = catalog?.providerLabels?.[provider] || provider

              return (
                <div key={provider} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <IntegrationBrandIcon provider={provider} size="sm" boxed />
                    <div className="flex-1">
                      <p className="font-medium">{label}</p>
                      {!hasAccounts && (
                        <p className="text-xs text-muted-foreground">
                          Nenhuma conta conectada — configure em Integrações.
                        </p>
                      )}
                    </div>
                  </div>
                  {hasAccounts && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Conta</Label>
                        <Select
                          value={getBindingForProvider(provider) || accounts[0]?.id}
                          onValueChange={(v) => setBindingForProvider(provider, v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        {tools.map((tool) => {
                          const key = tool.toolKey || buildToolKey(tool.provider, tool.toolName)
                          const on = selectedMap.has(key)
                          return (
                            <div
                              key={key}
                              className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{tool.displayName}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {tool.description}
                                </p>
                              </div>
                              <Switch
                                checked={on}
                                onCheckedChange={(checked) => toggleTool(tool, checked)}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPhase("archetype")}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button onClick={() => setPhase("brief")}>
                Próximo
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === "brief" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do agente (opcional)</Label>
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Ex.: Assistente Comercial"
              />
            </div>
            <div className="space-y-2">
              <Label>Idioma</Label>
              <Select
                value={agentLanguage}
                onValueChange={(v) =>
                  setAgentLanguage(coerceToSupportedAgentLanguage(v, "pt-BR"))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_AGENT_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center gap-2">
                <Label>Tema e finalidade do agente</Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={refiningDescription || !description.trim() || !claudeAvailable}
                  onClick={() => void handleRefineDescription()}
                >
                  {refiningDescription ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5 mr-1" />
                  )}
                  Melhorar
                </Button>
              </div>
              <Textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o negócio, público, tom de voz e o que o agente deve fazer..."
              />
            </div>
            {generationError && (
              <p className="text-sm text-red-600">{generationError}</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPhase("integrations")}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button onClick={() => void handleGenerate()}>
                <Sparkles className="mr-2 h-4 w-4" />
                Gerar agente
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === "generating" && (
          <div className="space-y-5 py-4">
            <p className="text-center text-sm text-muted-foreground">
              Gerando agente completo… não feche esta janela.
            </p>
            <ol className="space-y-2">
              {loadingSteps.map((step, index) => {
                const done = index < activeLoadingStep
                const active = index === activeLoadingStep
                return (
                  <li
                    key={step.title}
                    className={cn(
                      "flex gap-3 rounded-xl border px-3 py-3",
                      active && "border-violet-500/35 bg-violet-500/5"
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    ) : active ? (
                      <Loader2 className="h-5 w-5 animate-spin text-violet-500 shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{step.title}</p>
                      <p className="text-xs text-muted-foreground">{step.detail}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
            <p className="text-center text-xs text-muted-foreground tabular-nums">
              {elapsedSec}s
            </p>
          </div>
        )}

        {phase === "validation" && validationReport && (
          <div className="space-y-4 py-2">
            <div
              className={cn(
                "rounded-xl border p-4",
                validationReport.ok
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-amber-500/30 bg-amber-500/5"
              )}
            >
              <p className="font-medium">
                {validationReport.ok
                  ? "Agente validado com sucesso"
                  : "Agente criado com avisos"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Revise os testes abaixo antes de colocar em produção.
              </p>
            </div>
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {validationReport.checks.map((c) => (
                <li key={c.id} className="flex gap-2 text-sm items-start">
                  {statusIcon(c.status)}
                  <span>
                    <strong>{c.label}:</strong> {c.message}
                  </span>
                </li>
              ))}
            </ul>
            {validationReport.chatTurn && (
              <div className="rounded-lg border p-3 text-xs space-y-1 bg-muted/30">
                <p>
                  <strong>Chat teste:</strong> {validationReport.chatTurn.userMessage}
                </p>
                <p className="text-muted-foreground line-clamp-3">
                  {validationReport.chatTurn.replyPreview || "(sem resposta)"}
                </p>
              </div>
            )}
            <DialogFooter>
              <Button
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
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
