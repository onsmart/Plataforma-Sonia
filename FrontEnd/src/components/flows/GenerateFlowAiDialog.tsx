import React, { useState } from "react"
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
import { Loader2, Sparkles } from "lucide-react"
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
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied: (payload: GenerateFlowAiApplyPayload) => void
  initialFlowName?: string
  /** Código BCP-47 (ex.: pt-BR, en-US) — mesmo conjunto de idiomas dos agentes */
  defaultAgentLanguage?: string
}

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
  const [loading, setLoading] = useState(false)

  React.useEffect(() => {
    if (open) {
      setFlowNameDraft(initialFlowName)
      setAgentLanguage(coerceToSupportedAgentLanguage(defaultAgentLanguage, "pt-BR"))
    }
  }, [open, initialFlowName, defaultAgentLanguage])

  async function handleGenerate() {
    const desc = description.trim()
    if (!desc) {
      toast.error("Descreva o que o fluxo deve fazer.")
      return
    }

    setLoading(true)
    try {
      const { BASE_URL, getAuthHeaders } = await import("../../services/api")
      const response = await fetch(`${BASE_URL}/flows/generate-mvp`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ description: desc, language: agentLanguage }),
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast.error(body?.details || body?.error || "Não foi possível gerar o fluxo.")
        return
      }

      const nodes = (body.flow?.nodes || []) as Node[]
      const edgesRaw = body.flow?.edges || []
      const startNodeId = body.flow?.startNodeId || "n-start"

      onApplied({
        flow: {
          startNodeId,
          nodes,
          edges: Array.isArray(edgesRaw) ? edgesRaw : [],
        },
        refinedDescription: body.refinedDescription || desc,
        refinementProvider: body.refinementProvider || "none",
        flowNameDraft: flowNameDraft.trim(),
      })

      const refiner =
        body.refinementProvider === "claude"
          ? "Claude (Anthropic)"
          : body.refinementProvider === "openai"
            ? "OpenAI"
            : "sem refinamento"
      toast.success(`Rascunho gerado (refino: ${refiner}). Revise e salve o fluxo.`)

      onOpenChange(false)
      setDescription("")
    } catch (e) {
      console.error(e)
      toast.error("Erro de rede ao gerar o fluxo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyan-500" />
            Criar rascunho com IA (MVP)
          </DialogTitle>
          <DialogDescription>
            A descrição pode ser enriquecida automaticamente antes de montar o fluxo (OpenAI ou Claude),
            conforme as chaves no servidor. Será criado um fluxo mínimo:{" "}
            <strong>Início → um agente ou template → Fim</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="gf-ai-name">Nome do fluxo (para você salvar depois)</Label>
            <Input
              id="gf-ai-name"
              value={flowNameDraft}
              onChange={(e) => setFlowNameDraft(e.target.value)}
              placeholder="Ex.: Atendimento vendas WhatsApp"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gf-ai-lang">Idioma em que os agentes devem falar</Label>
            <Select value={agentLanguage} onValueChange={(v) => setAgentLanguage(coerceToSupportedAgentLanguage(v, "pt-BR"))}>
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
              placeholder="Ex.: Quero um assistente que cumprimente, explique nossos planos e encaminhe para agendamento..."
              className="resize-y min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleGenerate()} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Gerar no canvas
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
