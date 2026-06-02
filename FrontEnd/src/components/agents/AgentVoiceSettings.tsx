import { type ReactNode, forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  AudioLines,
  BrainCircuit,
  CheckCircle2,
  Loader2,
  Mic2,
  Phone,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  Waves,
} from "lucide-react"
import { Badge } from "../ui/badge"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Slider } from "../ui/slider"
import { Switch } from "../ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { useAgentVoiceProfile } from "../../hooks/useAgentVoiceProfile"
import { useElevenLabsVoices } from "../../hooks/useElevenLabsVoices"
import { useVoicePreview } from "../../hooks/useVoicePreview"
import { type AgentVoiceProfile, type SaveAgentVoiceProfilePayload } from "../../services/voice"
import { type ElevenLabsVoiceCatalogItem } from "../../services/voice"
import { SelectedVoiceHero, VoiceSelector } from "./VoiceSelector"
import { VoicePreviewPlayer } from "./VoicePreviewPlayer"
import {
  agentConfigFieldHint,
  agentConfigFieldLabel,
  agentConfigInnerPanel,
  agentConfigInput,
  agentConfigPanel,
  agentConfigPanelPadding,
  agentConfigSubTabTrigger,
  agentConfigSubTabsList,
  agentConfigVoiceStudioPanel,
} from "../../lib/agent-config-layout"
import { cn } from "../../lib/utils"

interface AgentVoiceSettingsProps {
  agentId: string | null
  agentName?: string
  neuralSettings?: ReactNode
}

export type VoiceSaveOutcome = "skipped" | "saved" | "error"

export type AgentVoiceSettingsHandle = {
  saveVoiceIfDirty: () => Promise<VoiceSaveOutcome>
}

type VoiceDraft = {
  provider: "elevenlabs"
  voiceId: string
  voiceName: string
  modelId: string
  stability: number
  similarityBoost: number
  style: number
  speed: number
  useSpeakerBoost: boolean
  previewText: string
  enabled: boolean
  callsEnabled: boolean
}

const VOICE_TUNING_CONTROLS = [
  { key: "stability" as const, label: "Estabilidade", lowLabel: "Variada", highLabel: "Estável" },
  { key: "similarityBoost" as const, label: "Fidelidade à voz", lowLabel: "Solta", highLabel: "Fiel" },
  { key: "style" as const, label: "Expressividade", lowLabel: "Neutra", highLabel: "Marcada" },
]

const VOICE_PRESETS = [
  {
    id: "balanced",
    label: "Equilibrada",
    description: "Tom neutro e versátil para atendimento diário.",
    values: { stability: 0.5, similarityBoost: 0.75, style: 0.15, speed: 1, useSpeakerBoost: true },
  },
  {
    id: "calm",
    label: "Estável",
    description: "Menos variação entre frases, ideal para scripts fixos.",
    values: { stability: 0.72, similarityBoost: 0.82, style: 0.05, speed: 0.96, useSpeakerBoost: true },
  },
  {
    id: "warm",
    label: "Natural",
    description: "Calor humano moderado sem perder clareza.",
    values: { stability: 0.42, similarityBoost: 0.7, style: 0.24, speed: 1, useSpeakerBoost: true },
  },
  {
    id: "fast_humanized",
    label: "Ágil",
    description: "Ritmo acelerado para respostas curtas.",
    values: { stability: 0.46, similarityBoost: 0.72, style: 0.04, speed: 1.08, useSpeakerBoost: false },
  },
]

function buildDraft(profile: AgentVoiceProfile | null, defaults?: { modelId: string | null; previewText: string }): VoiceDraft {
  return {
    provider: "elevenlabs",
    voiceId: profile?.voiceId || "",
    voiceName: profile?.voiceName || "",
    modelId: profile?.modelId || defaults?.modelId || "",
    stability: profile?.stability ?? 0.5,
    similarityBoost: profile?.similarityBoost ?? 0.75,
    style: profile?.style ?? 0,
    speed: profile?.speed ?? 1,
    useSpeakerBoost: profile?.useSpeakerBoost ?? true,
    previewText: profile?.previewText || defaults?.previewText || "Olá, eu sou o seu agente de IA. Como posso ajudar você hoje?",
    enabled: profile?.enabled ?? false,
    callsEnabled: profile?.callsEnabled ?? false,
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
    speed: Number(draft.speed.toFixed(4)),
    useSpeakerBoost: draft.useSpeakerBoost,
    previewText: draft.previewText.trim(),
    enabled: draft.enabled,
    callsEnabled: draft.callsEnabled,
  })
}

function VoiceStatusStrip({
  draft,
  selectedVoice,
  selectedPresetLabel,
  hasUnsavedChanges,
}: {
  draft: VoiceDraft
  selectedVoice: ElevenLabsVoiceCatalogItem | null
  selectedPresetLabel: string | null
  hasUnsavedChanges: boolean
}) {
  const items = [
    {
      label: "Voz sintética",
      value: draft.enabled ? "Ativa" : "Inativa",
      icon: Volume2,
      tone: draft.enabled ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
    },
    {
      label: "Chamadas",
      value: draft.callsEnabled ? "Habilitadas" : "Desligadas",
      icon: Phone,
      tone: draft.callsEnabled ? "text-primary" : "text-muted-foreground",
    },
    {
      label: "Voz selecionada",
      value: selectedVoice?.name || draft.voiceName || "Nenhuma",
      icon: Mic2,
      tone: selectedVoice || draft.voiceName ? "text-foreground" : "text-muted-foreground",
    },
    {
      label: "Preset",
      value: selectedPresetLabel || "Personalizado",
      icon: SlidersHorizontal,
      tone: "text-foreground",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className={cn(agentConfigInnerPanel, "flex items-start gap-2.5 px-3 py-2.5")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <item.icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <p className={cn("truncate text-sm font-semibold", item.tone)}>{item.value}</p>
          </div>
        </div>
      ))}
      {hasUnsavedChanges ? (
        <div className="col-span-2 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 lg:col-span-4">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-900 dark:text-amber-100">
            Alterações de voz pendentes — use <strong>Salvar alterações</strong> no topo da página.
          </p>
        </div>
      ) : null}
    </div>
  )
}

function TuningSliderCard({
  label,
  value,
  lowLabel,
  highLabel,
  min,
  max,
  step,
  formatValue,
  onChange,
}: {
  label: string
  value: number
  lowLabel: string
  highLabel: string
  min: number
  max: number
  step: number
  formatValue: (value: number) => string
  onChange: (value: number) => void
}) {
  const percent = max <= 1 ? value * 100 : ((value - min) / (max - min)) * 100

  return (
    <div className={cn(agentConfigInnerPanel, "space-y-3")}>
      <div className="flex items-center justify-between gap-2">
        <Label className={agentConfigFieldLabel}>{label}</Label>
        <span className="text-sm font-semibold tabular-nums text-primary">{formatValue(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={(v) => onChange(v[0] ?? value)} />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )
}

export const AgentVoiceSettings = forwardRef<AgentVoiceSettingsHandle, AgentVoiceSettingsProps>(
  function AgentVoiceSettings({ agentId, neuralSettings }, ref) {
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
    const selectedPreset = useMemo(
      () =>
        VOICE_PRESETS.find(
          (preset) =>
            Math.abs(preset.values.stability - draft.stability) < 0.001 &&
            Math.abs(preset.values.similarityBoost - draft.similarityBoost) < 0.001 &&
            Math.abs(preset.values.style - draft.style) < 0.001 &&
            Math.abs(preset.values.speed - draft.speed) < 0.001 &&
            preset.values.useSpeakerBoost === draft.useSpeakerBoost
        ) || null,
      [draft]
    )

    const applyPreset = (presetId: string) => {
      const preset = VOICE_PRESETS.find((item) => item.id === presetId)
      if (!preset) return
      setDraft((current) => ({ ...current, ...preset.values }))
    }

    const persistVoiceDraft = async (): Promise<VoiceSaveOutcome> => {
      if (!agentId || serializeDraft(draft) === savedSnapshot) return "skipped"
      if (!draft.voiceId) {
        toast.error("Selecione uma voz da ElevenLabs para salvar.")
        return "error"
      }
      const payload: SaveAgentVoiceProfilePayload = {
        provider: draft.provider,
        voiceId: draft.voiceId,
        voiceName: draft.voiceName || selectedVoice?.name || null,
        modelId: draft.modelId || null,
        stability: draft.stability,
        similarityBoost: draft.similarityBoost,
        style: draft.style,
        speed: draft.speed,
        useSpeakerBoost: draft.useSpeakerBoost,
        previewText: draft.previewText,
        enabled: draft.enabled,
        callsEnabled: draft.callsEnabled,
      }
      try {
        const response = await saveProfile(payload)
        const nextDraft = buildDraft(response.profile, response.defaults)
        setDraft(nextDraft)
        setSavedSnapshot(serializeDraft(nextDraft))
        return "saved"
      } catch (err: any) {
        toast.error(err?.message || "Erro ao salvar voz do agente.")
        return "error"
      }
    }

    useImperativeHandle(ref, () => ({ saveVoiceIfDirty: persistVoiceDraft }), [agentId, draft, savedSnapshot, saveProfile, selectedVoice])

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
          speed: draft.speed,
          useSpeakerBoost: draft.useSpeakerBoost,
        })
        toast.success("Preview gerado.")
      } catch (err: any) {
        toast.error(err?.message || "Erro ao gerar preview.")
      }
    }

    if (!agentId) {
      return (
        <div className={cn(agentConfigPanel, agentConfigPanelPadding, "border-dashed text-sm text-muted-foreground")}>
          Salve o agente no hub antes de configurar voz.
        </div>
      )
    }

    const previewStudio = (
      <div className={cn(agentConfigVoiceStudioPanel, agentConfigPanelPadding, "space-y-4 xl:sticky xl:top-24 xl:self-start")}>
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <AudioLines className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Estúdio de preview</h3>
            <p className="text-xs text-muted-foreground">Teste a voz com os ajustes atuais.</p>
          </div>
        </div>

        <SelectedVoiceHero voice={selectedVoice} voiceName={draft.voiceName} />

        <VoicePreviewPlayer
          previewText={draft.previewText}
          audioUrl={preview.audioUrl}
          isLoading={preview.isLoading}
          error={preview.error}
          disabled={!draft.voiceId || !data?.providerConfigured}
          onPreviewTextChange={(value) => setDraft((x) => ({ ...x, previewText: value }))}
          onGeneratePreview={handlePreview}
          compact
        />

        {isSaving ? (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando voz…
          </div>
        ) : null}
      </div>
    )

    return (
      <div className="space-y-5">
        {!data?.providerConfigured ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
            Configure <code className="text-xs">ELEVENLABS_API_KEY</code> no backend para listar vozes e gerar previews.
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        ) : null}

        <VoiceStatusStrip
          draft={draft}
          selectedVoice={selectedVoice}
          selectedPresetLabel={selectedPreset?.label || null}
          hasUnsavedChanges={hasUnsavedChanges}
        />

        <Tabs defaultValue="catalogo" className="space-y-4">
          <TabsList className={agentConfigSubTabsList}>
            <TabsTrigger value="catalogo" className={agentConfigSubTabTrigger}>
              <Mic2 className="mr-1.5 hidden h-3.5 w-3.5 sm:inline" />
              Catálogo
            </TabsTrigger>
            <TabsTrigger value="ajustes" className={agentConfigSubTabTrigger}>
              <Waves className="mr-1.5 hidden h-3.5 w-3.5 sm:inline" />
              Parâmetros
            </TabsTrigger>
            <TabsTrigger value="texto" className={agentConfigSubTabTrigger}>
              <BrainCircuit className="mr-1.5 hidden h-3.5 w-3.5 sm:inline" />
              Texto (IA)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalogo" className="mt-0 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className={cn(agentConfigInnerPanel, "flex items-center justify-between gap-3")}>
                <div>
                  <Label className={agentConfigFieldLabel}>Voz em áudio</Label>
                  <p className={agentConfigFieldHint}>Respostas em áudio quando o canal permitir.</p>
                </div>
                <Switch checked={draft.enabled} onCheckedChange={(c) => { setDraft((x) => ({ ...x, enabled: c })); setError(null) }} />
              </div>
              <div className={cn(agentConfigInnerPanel, "flex items-center justify-between gap-3")}>
                <div>
                  <Label className={agentConfigFieldLabel}>Chamadas WhatsApp</Label>
                  <p className={agentConfigFieldHint}>Atender ligações de voz pelo agente.</p>
                </div>
                <Switch
                  checked={draft.callsEnabled}
                  onCheckedChange={(c) => {
                    setDraft((x) => ({ ...x, callsEnabled: c, enabled: c ? true : x.enabled }))
                    setError(null)
                  }}
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label className={agentConfigFieldLabel}>Provedor</Label>
                <div className={cn(agentConfigInnerPanel, "flex items-center gap-2 text-sm font-medium")}>
                  <Sparkles className="h-4 w-4 text-primary" />
                  ElevenLabs
                </div>
              </div>
              <div className="space-y-2">
                <Label className={agentConfigFieldLabel}>Modelo TTS</Label>
                <Input
                  value={draft.modelId}
                  onChange={(e) => setDraft((x) => ({ ...x, modelId: e.target.value }))}
                  placeholder={data?.defaults.modelId || "eleven_multilingual_v2"}
                  className={agentConfigInput}
                />
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
              <VoiceSelector
                voices={voices}
                selectedVoiceId={draft.voiceId}
                searchTerm={searchTerm}
                isLoading={isVoicesLoading || isLoading}
                error={voicesError}
                onSearchTermChange={setSearchTerm}
                onSelectVoice={(voice) => setDraft((x) => ({ ...x, voiceId: voice.voiceId, voiceName: voice.name }))}
              />
              {previewStudio}
            </div>
          </TabsContent>

          <TabsContent value="ajustes" className="mt-0 space-y-5">
            <SelectedVoiceHero voice={selectedVoice} voiceName={draft.voiceName} variant="banner" />

            <div>
              <div className="mb-3">
                <h3 className="text-sm font-semibold">Presets de voz</h3>
                <p className={agentConfigFieldHint}>Comece com um perfil pronto e refine nos controles abaixo.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {VOICE_PRESETS.map((preset) => {
                  const isActive = selectedPreset?.id === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-left transition-all",
                        isActive
                          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20"
                          : "border-border/50 bg-background/80 hover:border-primary/30 dark:bg-card/50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{preset.label}</span>
                        {isActive ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : null}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{preset.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="mb-3">
                <h3 className="text-sm font-semibold">Controles manuais</h3>
                <p className={agentConfigFieldHint}>Ajuste fino de estabilidade, fidelidade e ritmo.</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {VOICE_TUNING_CONTROLS.map((item) => (
                  <TuningSliderCard
                    key={item.key}
                    label={item.label}
                    value={draft[item.key]}
                    lowLabel={item.lowLabel}
                    highLabel={item.highLabel}
                    min={0}
                    max={1}
                    step={0.01}
                    formatValue={(value) => `${Math.round(value * 100)}%`}
                    onChange={(value) => setDraft((x) => ({ ...x, [item.key]: value }))}
                  />
                ))}

                <TuningSliderCard
                  label="Velocidade"
                  value={draft.speed}
                  lowLabel="Mais lenta"
                  highLabel="Mais rápida"
                  min={0.7}
                  max={1.2}
                  step={0.01}
                  formatValue={(value) => `${value.toFixed(2)}x`}
                  onChange={(value) => setDraft((x) => ({ ...x, speed: value }))}
                />

                <div className={cn(agentConfigInnerPanel, "flex items-center justify-between gap-3 lg:col-span-2")}>
                  <div>
                    <Label className={agentConfigFieldLabel}>Clareza em telefone</Label>
                    <p className={agentConfigFieldHint}>Speaker boost — melhora inteligibilidade em chamadas.</p>
                  </div>
                  <Switch checked={draft.useSpeakerBoost} onCheckedChange={(c) => setDraft((x) => ({ ...x, useSpeakerBoost: c }))} />
                </div>
              </div>
            </div>

            <div className="xl:hidden">{previewStudio}</div>
          </TabsContent>

          <TabsContent value="texto" className="mt-0 space-y-4">
            {neuralSettings ? (
              <div className={cn(agentConfigPanel, agentConfigPanelPadding, "space-y-1")}>
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BrainCircuit className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Comportamento das respostas</h3>
                    <p className="text-xs text-muted-foreground">Criatividade e tamanho das respostas em texto.</p>
                  </div>
                </div>
                {neuralSettings}
              </div>
            ) : (
              <div className={cn(agentConfigPanel, agentConfigPanelPadding, "border-dashed text-sm text-muted-foreground")}>
                Configurações de texto indisponíveis neste contexto.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    )
  }
)
