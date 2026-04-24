import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { AudioLines, Loader2, Mic2, Save, SlidersHorizontal } from "lucide-react"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Slider } from "../ui/slider"
import { Switch } from "../ui/switch"
import { useAgentVoiceProfile } from "../../hooks/useAgentVoiceProfile"
import { useElevenLabsVoices } from "../../hooks/useElevenLabsVoices"
import { useVoicePreview } from "../../hooks/useVoicePreview"
import { type AgentVoiceProfile, type SaveAgentVoiceProfilePayload } from "../../services/voice"
import { VoiceSelector } from "./VoiceSelector"
import { VoicePreviewPlayer } from "./VoicePreviewPlayer"

interface AgentVoiceSettingsProps {
  agentId: string | null
  agentName?: string
}

type VoiceDraft = {
  provider: "elevenlabs"
  voiceId: string
  voiceName: string
  modelId: string
  stability: number
  similarityBoost: number
  style: number
  useSpeakerBoost: boolean
  previewText: string
  enabled: boolean
}

function buildDraft(profile: AgentVoiceProfile | null, defaults?: { modelId: string | null; previewText: string }): VoiceDraft {
  return {
    provider: "elevenlabs",
    voiceId: profile?.voiceId || "",
    voiceName: profile?.voiceName || "",
    modelId: profile?.modelId || defaults?.modelId || "",
    stability: profile?.stability ?? 0.5,
    similarityBoost: profile?.similarityBoost ?? 0.75,
    style: profile?.style ?? 0,
    useSpeakerBoost: profile?.useSpeakerBoost ?? true,
    previewText: profile?.previewText || defaults?.previewText || "Ola, eu sou o seu agente de IA. Como posso ajudar voce hoje?",
    enabled: profile?.enabled ?? false,
  }
}

function serializeDraft(draft: VoiceDraft) {
  return JSON.stringify({
    provider: draft.provider,
    voiceId: draft.voiceId,
    voiceName: draft.voiceName,
    modelId: draft.modelId,
    stability: Number(draft.stability.toFixed(4)),
    similarityBoost: Number(draft.similarityBoost.toFixed(4)),
    style: Number(draft.style.toFixed(4)),
    useSpeakerBoost: draft.useSpeakerBoost,
    previewText: draft.previewText.trim(),
    enabled: draft.enabled,
  })
}

export function AgentVoiceSettings({ agentId, agentName }: AgentVoiceSettingsProps) {
  const { data, isLoading, isSaving, error, saveProfile, setError } = useAgentVoiceProfile(agentId)
  const { voices, isLoading: isVoicesLoading, error: voicesError } = useElevenLabsVoices(Boolean(agentId))
  const preview = useVoicePreview(agentId)
  const [searchTerm, setSearchTerm] = useState("")
  const [draft, setDraft] = useState<VoiceDraft>(() => buildDraft(null))
  const [savedSnapshot, setSavedSnapshot] = useState<string>(serializeDraft(buildDraft(null)))

  useEffect(() => {
    const nextDraft = buildDraft(data?.profile || null, data?.defaults)
    setDraft(nextDraft)
    setSavedSnapshot(serializeDraft(nextDraft))
  }, [data])

  const hasUnsavedChanges = useMemo(() => serializeDraft(draft) !== savedSnapshot, [draft, savedSnapshot])
  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.voiceId === draft.voiceId) || null,
    [voices, draft.voiceId]
  )

  const handleSave = async () => {
    if (!agentId) {
      toast.error("Salve o agente antes de configurar a voz.")
      return
    }

    if (!draft.voiceId) {
      toast.error("Selecione uma voz da ElevenLabs para continuar.")
      return
    }

    const payload: SaveAgentVoiceProfilePayload = {
      provider: draft.provider,
      voiceId: draft.voiceId,
      voiceName: draft.voiceName || selectedVoice?.name || null,
      modelId: draft.modelId || null,
      stability: draft.stability,
      similarityBoost: draft.similarityBoost,
      style: draft.style,
      useSpeakerBoost: draft.useSpeakerBoost,
      previewText: draft.previewText,
      enabled: draft.enabled,
    }

    try {
      const response = await saveProfile(payload)
      const nextDraft = buildDraft(response.profile, response.defaults)
      setDraft(nextDraft)
      setSavedSnapshot(serializeDraft(nextDraft))
      toast.success("Voz do agente salva com sucesso.")
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar voz do agente.")
    }
  }

  const handlePreview = async () => {
    if (!draft.voiceId) {
      toast.error("Selecione uma voz antes de ouvir o preview.")
      return
    }

    try {
      await preview.generatePreview({
        provider: draft.provider,
        text: draft.previewText,
        voiceId: draft.voiceId,
        modelId: draft.modelId || null,
        stability: draft.stability,
        similarityBoost: draft.similarityBoost,
        style: draft.style,
        useSpeakerBoost: draft.useSpeakerBoost,
      })
      toast.success("Preview gerado.")
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar preview.")
    }
  }

  if (!agentId) {
    return (
      <section className="rounded-[2rem] border border-dashed border-zinc-300/90 bg-white/75 p-8 text-sm text-muted-foreground dark:border-zinc-700 dark:bg-zinc-950/40">
        Salve o agente primeiro para habilitar a configuracao de voz.
      </section>
    )
  }

  return (
    <section className="space-y-8 rounded-[2rem] border border-zinc-200/90 bg-white/80 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/55">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[1.2rem] bg-gradient-to-br from-cyan-500 to-teal-500 text-white shadow-sm">
              <Mic2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-[0.2em] text-cyan-900 dark:text-cyan-200">
                Voz do Agente
              </h2>
              <p className="text-sm text-muted-foreground">
                Configure a voz do agente {agentName ? <span className="font-medium">{agentName}</span> : null} para previews e futuras respostas em audio.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasUnsavedChanges ? <Badge className="bg-amber-500 text-white">Alteracoes nao salvas</Badge> : null}
          {draft.enabled ? <Badge className="bg-emerald-600 text-white">Voz ativa</Badge> : <Badge variant="secondary">Voz desativada</Badge>}
        </div>
      </div>

      {!data?.providerConfigured ? (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
          Configure <code>ELEVENLABS_API_KEY</code> e <code>ELEVENLABS_DEFAULT_MODEL_ID</code> no backend para listar vozes e gerar previews.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-[1.5rem] border border-zinc-200/90 bg-zinc-50/90 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div>
              <Label className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Ativar voz do agente</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Quando o projeto suportar entrega de audio no canal, a voz salva sera usada antes do fallback em texto.
              </p>
            </div>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(checked) => {
                setDraft((current) => ({ ...current, enabled: checked }))
                setError(null)
              }}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Provedor</Label>
              <Select value={draft.provider} onValueChange={() => undefined}>
                <SelectTrigger className="h-12 rounded-2xl border-zinc-200/90 bg-white/85 dark:border-zinc-700 dark:bg-zinc-900/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Modelo</Label>
              <Input
                value={draft.modelId}
                onChange={(event) => setDraft((current) => ({ ...current, modelId: event.target.value }))}
                placeholder={data?.defaults.modelId || "eleven_multilingual_v2"}
                className="h-12 rounded-2xl border-zinc-200/90 bg-white/85 dark:border-zinc-700 dark:bg-zinc-900/70"
              />
            </div>
          </div>

          <VoiceSelector
            voices={voices}
            selectedVoiceId={draft.voiceId}
            searchTerm={searchTerm}
            isLoading={isVoicesLoading || isLoading}
            error={voicesError}
            onSearchTermChange={setSearchTerm}
            onSelectVoice={(voice) =>
              setDraft((current) => ({
                ...current,
                voiceId: voice.voiceId,
                voiceName: voice.name,
              }))
            }
          />
        </div>

        <div className="space-y-6 rounded-[1.5rem] border border-zinc-200/90 bg-zinc-50/90 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Ajustes de voz</h3>
            </div>

            {[
              { key: "stability", label: "Stability", value: draft.stability },
              { key: "similarityBoost", label: "Similarity Boost", value: draft.similarityBoost },
              { key: "style", label: "Style", value: draft.style },
            ].map((item) => (
              <div key={item.key} className="space-y-3 rounded-[1.25rem] border border-zinc-200/80 bg-white/85 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{item.label}</Label>
                  <span className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">
                    {Math.round(item.value * 100)}%
                  </span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={[item.value]}
                  onValueChange={(values) =>
                    setDraft((current) => ({
                      ...current,
                      [item.key]: values[0] ?? item.value,
                    }))
                  }
                />
              </div>
            ))}

            <div className="flex items-center justify-between rounded-[1.25rem] border border-zinc-200/80 bg-white/85 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/50">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Speaker Boost</Label>
                <p className="text-sm text-muted-foreground">Aumenta a semelhanca com a voz original quando o modelo suportar.</p>
              </div>
              <Switch
                checked={draft.useSpeakerBoost}
                onCheckedChange={(checked) => setDraft((current) => ({ ...current, useSpeakerBoost: checked }))}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AudioLines className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Preview em tempo real</h3>
            </div>

            <VoicePreviewPlayer
              previewText={draft.previewText}
              audioUrl={preview.audioUrl}
              isLoading={preview.isLoading}
              error={preview.error}
              disabled={!draft.voiceId || !data?.providerConfigured}
              onPreviewTextChange={(value) => setDraft((current) => ({ ...current, previewText: value }))}
              onGeneratePreview={handlePreview}
            />
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading || !draft.voiceId}
            className="h-12 w-full rounded-2xl"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar voz do agente
          </Button>
        </div>
      </div>
    </section>
  )
}
