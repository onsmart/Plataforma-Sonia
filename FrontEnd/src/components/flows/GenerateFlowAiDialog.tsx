import React, { useEffect, useMemo, useRef, useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import { toast } from "sonner"
import { Sparkles, CheckCircle2, Loader2, Circle, Wand2, Headphones, Rocket, Lock } from "lucide-react"
import { cn } from "../ui/utils"
import type { Node } from "reactflow"
import {
  SUPPORTED_AGENT_LANGUAGES,
  coerceToSupportedAgentLanguage,
} from "../../lib/agent-language"

export interface GenerateFlowAiApplyPayload {
  flow: {
    startNodeId: string
    nodes: Node[]
    edges: { source: string; target: string; sourceHandle?: string }[]
  }
  refinedDescription: string
  refinementProvider: string
  flowNameDraft: string
  generationMode?: "single_agent"
  structureSummary?: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied: (payload: GenerateFlowAiApplyPayload) => void
  initialFlowName?: string
  defaultAgentLanguage?: string
}

type UiPhase = "form" | "generating" | "done"

type FlowAiArchetype = "receptive" | "sdr"

type ClaudeRefineStatus = "unknown" | "yes" | "no"

export function GenerateFlowAiDialog({
  open,
  onOpenChange,
  onApplied,
  initialFlowName = "",
  defaultAgentLanguage = "pt-BR",
}: Props) {
  const [flowNameDraft, setFlowNameDraft] = useState(initialFlowName)
  const [description, setDescription] = useState("")
  const [agentLanguage, setAgentLanguage] = useState(() =>
    coerceToSupportedAgentLanguage(defaultAgentLanguage, "pt-BR")
  )
  const [archetype, setArchetype] = useState<FlowAiArchetype>("receptive")
  const [phase, setPhase] = useState<UiPhase>("form")
  const [elapsedSec, setElapsedSec] = useState(0)
  const [refiningDescription, setRefiningDescription] = useState(false)
  const [claudeRefineStatus, setClaudeRefineStatus] = useState<ClaudeRefineStatus>("unknown")
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      setFlowNameDraft(initialFlowName)
      setAgentLanguage(coerceToSupportedAgentLanguage(defaultAgentLanguage, "pt-BR"))
      setArchetype("receptive")
      setPhase("form")
      setElapsedSec(0)
      setRefiningDescription(false)
      setClaudeRefineStatus("unknown")
    }
  }, [open, initialFlowName, defaultAgentLanguage])

  useEffect(() => {
    if (!open || phase !== "form") return
    let cancelled = false

    ;(async () => {
      try {
        const { BASE_URL, getAuthHeaders } = await import("../../services/api")
        const response = await fetch(`${BASE_URL}/flows/refine-description/status`, {
          headers: await getAuthHeaders(),
        })

        if (cancelled) return
        if (!response.ok) {
          setClaudeRefineStatus("no")
          return
        }

        const body = (await response.json().catch(() => ({}))) as { claudeAvailable?: boolean }
        setClaudeRefineStatus(body.claudeAvailable ? "yes" : "no")
      } catch {
        if (!cancelled) setClaudeRefineStatus("unknown")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, phase])

  useEffect(() => {
    if (phase !== "generating") return
    setElapsedSec(0)
    const timer = window.setInterval(() => {
      setElapsedSec((current) => current + 1)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [phase])

  useEffect(() => {
    return () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current)
    }
  }, [])

  const loadingSteps = useMemo(
    () =>
      archetype === "receptive"
        ? [
            {
              title: "Analisar a descrição",
              detail: "Entender negócio, canal e tom do atendimento receptivo.",
            },
            {
              title: "Montar template + agente Calendly",
              detail:
                "Template flexível com ferramentas Calendly e execução em modo agente (integration_tool).",
            },
            {
              title: "Montar o fluxo no canvas",
              detail: "Criar automaticamente a estrutura Início → Agente → Fim.",
            },
          ]
        : [
            {
              title: "Analisar a descrição",
              detail: "Entender objetivo, canal, tom e escopo do atendimento desejado.",
            },
            {
              title: "Gerar template e agente",
              detail: "Criar um template único, bem estruturado, e vinculá-lo ao único agente do fluxo.",
            },
            {
              title: "Montar o fluxo no canvas",
              detail: "Criar automaticamente a estrutura Início → Agente → Fim.",
            },
          ],
    [archetype]
  )

  const activeLoadingStep = useMemo(() => {
    if (phase !== "generating") return 0
    return Math.min(loadingSteps.length - 1, Math.floor(elapsedSec / 6))
  }, [phase, elapsedSec, loadingSteps.length])

  async function handleRefineDescription() {
    const desc = description.trim()
    if (!desc) {
      toast.error("Escreva uma descrição antes de melhorar.")
      return
    }

    setRefiningDescription(true)
    try {
      const { BASE_URL, getAuthHeaders } = await import("../../services/api")
      const response = await fetch(`${BASE_URL}/flows/refine-description`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ description: desc, language: agentLanguage }),
      })
      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (body?.code === "ANTHROPIC_MISSING") {
          toast.error("Claude não está configurado no servidor.", {
            description: body?.details || "Defina ANTHROPIC_API_KEY ou CLAUDE_API_KEY no backend.",
          })
        } else {
          toast.error(body?.error || "Não foi possível melhorar a descrição.", {
            description: typeof body?.details === "string" ? body.details : undefined,
          })
        }
        return
      }

      const refined = typeof body.refinedDescription === "string" ? body.refinedDescription.trim() : ""
      if (!refined) {
        toast.error("Resposta vazia do Claude.")
        return
      }

      setDescription(refined)
      toast.success("Descrição melhorada com Claude.", {
        description: "Revise o texto e gere o fluxo quando estiver pronto.",
      })
    } catch (error) {
      console.error(error)
      toast.error("Erro de rede ao melhorar a descrição.")
    } finally {
      setRefiningDescription(false)
    }
  }

  async function handleGenerate() {
    const desc = description.trim()
    if (!desc) {
      toast.error("Descreva o que o fluxo deve fazer.")
      return
    }

    setPhase("generating")

    try {
      const { BASE_URL, getAuthHeaders } = await import("../../services/api")
      const response = await fetch(`${BASE_URL}/flows/generate-mvp`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ description: desc, language: agentLanguage, archetype }),
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setPhase("form")
        toast.error(body?.details || body?.error || "Não foi possível gerar o fluxo.")
        return
      }

      const nodes = (body.flow?.nodes || []) as Node[]
      const edgesRaw = body.flow?.edges || []
      const startNodeId = body.flow?.startNodeId || "n-start"
      const suggested = typeof body.suggestedFlowName === "string" ? body.suggestedFlowName.trim() : ""
      const effectiveFlowName = flowNameDraft.trim() || suggested

      const payload: GenerateFlowAiApplyPayload = {
        flow: {
          startNodeId,
          nodes,
          edges: Array.isArray(edgesRaw) ? edgesRaw : [],
        },
        refinedDescription: body.refinedDescription || desc,
        refinementProvider: body.refinementProvider || "none",
        flowNameDraft: effectiveFlowName,
        generationMode: "single_agent",
        structureSummary: body.structureSummary ?? null,
      }

      onApplied(payload)
      setPhase("done")

      if (doneTimerRef.current) clearTimeout(doneTimerRef.current)
      doneTimerRef.current = setTimeout(() => {
        setDescription("")
        setPhase("form")
        onOpenChange(false)
        doneTimerRef.current = null
      }, 1400)
    } catch (error) {
      console.error(error)
      setPhase("form")
      toast.error("Erro de rede ao gerar o fluxo.")
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && (phase === "generating" || refiningDescription)) {
      return
    }

    if (!next) {
      if (doneTimerRef.current) {
        clearTimeout(doneTimerRef.current)
        doneTimerRef.current = null
      }
      setPhase("form")
    }

    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn("sm:max-w-lg", phase === "generating" && "sm:max-w-xl")}
        onPointerDownOutside={(event) =>
          (phase === "generating" || refiningDescription) && event.preventDefault()
        }
        onEscapeKeyDown={(event) =>
          (phase === "generating" || refiningDescription) && event.preventDefault()
        }
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {phase === "generating" ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-cyan-500" aria-hidden />
            ) : (
              <Sparkles className="h-5 w-5 shrink-0 text-cyan-500" aria-hidden />
            )}
            {phase === "done"
              ? "Fluxo gerado"
              : phase === "generating"
                ? "Gerando fluxo"
                : "Criar fluxo com IA"}
          </DialogTitle>

          {phase === "form" && (
            <DialogDescription className="space-y-2 text-left">
              <span className="block">
                Escolha o tipo de IA e descreva o atendimento. O fluxo será{" "}
                <strong>Início → Agente → Fim</strong> com um agente e um template vinculados.
              </span>
              <span className="block">
                <strong>IA receptiva</strong> usa o template flexível com Calendly (como o Assistente
                flexível): pede nome e e-mail antes de agendar ou cancelar.
              </span>
              <span className="block text-xs text-muted-foreground">
                IA SDR (prospecção outbound) está em desenvolvimento. Opcional: use{" "}
                <strong>Melhorar descrição</strong> com Claude.
              </span>
            </DialogDescription>
          )}
        </DialogHeader>

        {phase === "generating" && (
          <div className="space-y-5 py-2" aria-busy="true" aria-live="polite">
            <p className="text-center text-sm leading-relaxed text-muted-foreground">
              Isso costuma levar alguns segundos. Não feche esta janela.
            </p>

            <ol className="space-y-2.5">
              {loadingSteps.map((step, index) => {
                const done = index < activeLoadingStep
                const active = index === activeLoadingStep

                return (
                  <li
                    key={step.title}
                    className={cn(
                      "flex gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                      active
                        ? "border-cyan-500/35 bg-cyan-500/[0.07] shadow-sm"
                        : "border-border/80 bg-muted/20"
                    )}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center">
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />
                      ) : active ? (
                        <Loader2 className="h-5 w-5 animate-spin text-cyan-500" aria-hidden />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/50" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 space-y-0.5">
                      <span className="block text-sm font-medium text-foreground">{step.title}</span>
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
                className="gf-flow-indeterminate-track max-w-sm"
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

        {phase === "done" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" strokeWidth={1.75} />
            <p className="text-center text-sm font-medium">Fluxo gerado com sucesso.</p>
            <p className="text-center text-xs text-muted-foreground">
              Esta janela fechará em instantes...
            </p>
          </div>
        )}

        {phase === "form" && (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Tipo de IA</Label>
                <div className="grid gap-3 sm:grid-cols-2">
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
                      IA receptiva
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Atendimento + agenda Calendly. Identifica o cliente (nome e e-mail) antes de
                      marcar ou cancelar.
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled
                    className="relative rounded-xl border border-dashed p-4 text-left opacity-60"
                    title="Em desenvolvimento"
                  >
                    <Lock className="absolute right-3 top-3 h-3.5 w-3.5 text-muted-foreground" />
                    <div className="mb-2 flex items-center gap-2 font-medium">
                      <Rocket className="h-4 w-4 text-muted-foreground" />
                      IA SDR
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Em breve
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Prospecção outbound e cadências comerciais.
                    </p>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gf-ai-name">Nome do fluxo</Label>
                <Input
                  id="gf-ai-name"
                  value={flowNameDraft}
                  onChange={(event) => setFlowNameDraft(event.target.value)}
                  placeholder="Ex.: Atendimento inicial WhatsApp"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gf-ai-lang">Idioma em que o agente deve falar</Label>
                <Select
                  value={agentLanguage}
                  onValueChange={(value) =>
                    setAgentLanguage(coerceToSupportedAgentLanguage(value, "pt-BR"))
                  }
                >
                  <SelectTrigger id="gf-ai-lang" className="w-full">
                    <SelectValue placeholder="Idioma" />
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

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="gf-ai-desc">O que esse fluxo deve fazer?</Label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 text-xs"
                    disabled={refiningDescription || !description.trim() || claudeRefineStatus === "no"}
                    title={
                      claudeRefineStatus === "no"
                        ? "Claude não configurado no servidor (ANTHROPIC_API_KEY)."
                        : "Reescreve o texto com Claude para gerar um template mais assertivo."
                    }
                    onClick={() => void handleRefineDescription()}
                  >
                    {refiningDescription ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" aria-hidden />
                    )}
                    Melhorar descrição
                  </Button>
                </div>

                {claudeRefineStatus === "no" && (
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Melhorar descrição requer{" "}
                    <code className="rounded bg-muted px-1">ANTHROPIC_API_KEY</code> no backend.
                  </p>
                )}

                <Textarea
                  id="gf-ai-desc"
                  rows={5}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={
                    archetype === "receptive"
                      ? "Ex.: Atendimento WhatsApp da empresa X: tirar dúvidas, agendar reuniões via Calendly e encaminhar para humano quando necessário, tom profissional."
                      : "Ex.: Atendimento via WhatsApp para tirar dúvidas, explicar serviços, tratar assuntos comerciais, suporte básico e financeiro leve, sempre com tom profissional."
                  }
                  className="min-h-[120px] resize-y"
                  disabled={refiningDescription}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                disabled={refiningDescription}
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="button" disabled={refiningDescription} onClick={() => void handleGenerate()}>
                <Sparkles className="mr-2 h-4 w-4" />
                Gerar no canvas
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
