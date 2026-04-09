import React, { useState, useEffect, useRef, useMemo } from "react"
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
import { Sparkles, CheckCircle2, Loader2, Circle } from "lucide-react"
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
  generationMode?: "structured" | "simple"
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
  const [phase, setPhase] = useState<UiPhase>("form")
  const [elapsedSec, setElapsedSec] = useState(0)
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    if (open) {
      setFlowNameDraft(initialFlowName)
      setAgentLanguage(coerceToSupportedAgentLanguage(defaultAgentLanguage, "pt-BR"))
      setPhase("form")
      setElapsedSec(0)
    }
  }, [open, initialFlowName, defaultAgentLanguage])

  useEffect(() => {
    if (phase !== "generating") return
    setElapsedSec(0)
    const t = window.setInterval(() => {
      setElapsedSec((s) => s + 1)
    }, 1000)
    return () => window.clearInterval(t)
  }, [phase])

  useEffect(() => {
    return () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current)
    }
  }, [])

  const loadingSteps = useMemo(
    () => [
      {
        title: "Analisar a descrição",
        detail: "Entender objetivo, canal e tom do atendimento.",
      },
      {
        title: "Planejar o fluxo",
        detail: "Definir classificador, ramos de intenção e resposta padrão.",
      },
      {
        title: "Registrar na plataforma",
        detail: "Criar modelos de papel e agentes conforme seu plano.",
      },
    ],
    []
  )

  const activeLoadingStep = useMemo(() => {
    if (phase !== "generating") return 0
    return Math.min(loadingSteps.length - 1, Math.floor(elapsedSec / 6))
  }, [phase, elapsedSec, loadingSteps.length])

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
        body: JSON.stringify({ description: desc, language: agentLanguage }),
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
        generationMode: body.generationMode === "structured" ? "structured" : "simple",
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
    } catch (e) {
      console.error(e)
      setPhase("form")
      toast.error("Erro de rede ao gerar o fluxo.")
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && phase === "generating") {
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
        onPointerDownOutside={(e) => phase === "generating" && e.preventDefault()}
        onEscapeKeyDown={(e) => phase === "generating" && e.preventDefault()}
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
            <DialogDescription className="text-left space-y-2">
              <span className="block">
                Descreva em linguagem natural o atendimento desejado. A IA cria{" "}
                <strong>agentes novos</strong> (e os modelos de papel no catálogo), monta o fluxo com{" "}
                <strong>classificador</strong> e <strong>Se/Senão</strong> e coloca tudo no canvas.
              </span>
              <span className="block text-xs text-muted-foreground">
                Isso consome o limite de agentes do seu plano. O classificador envia apenas JSON de intenção
                para o motor do fluxo; as respostas ao usuário vêm dos outros agentes.
              </span>
            </DialogDescription>
          )}
        </DialogHeader>

        {phase === "generating" && (
          <div className="space-y-5 py-2" aria-busy="true" aria-live="polite">
            <p className="text-center text-sm text-muted-foreground leading-relaxed">
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
                      <span className="block text-xs text-muted-foreground leading-snug">{step.detail}</span>
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
            <p className="text-center text-xs text-muted-foreground">Esta janela fechará em instantes…</p>
          </div>
        )}

        {phase === "form" && (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="gf-ai-name">Nome do fluxo (para salvar depois)</Label>
                <Input
                  id="gf-ai-name"
                  value={flowNameDraft}
                  onChange={(e) => setFlowNameDraft(e.target.value)}
                  placeholder="Ex.: Atendimento WhatsApp"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gf-ai-lang">Idioma em que os agentes devem falar</Label>
                <Select
                  value={agentLanguage}
                  onValueChange={(v) => setAgentLanguage(coerceToSupportedAgentLanguage(v, "pt-BR"))}
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
                <Label htmlFor="gf-ai-desc">O que esse fluxo deve fazer?</Label>
                <Textarea
                  id="gf-ai-desc"
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex.: WhatsApp: dúvidas sobre o produto, preços e agendar demo; se não entender, pedir para reformular…"
                  className="resize-y min-h-[120px]"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleGenerate()}>
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
