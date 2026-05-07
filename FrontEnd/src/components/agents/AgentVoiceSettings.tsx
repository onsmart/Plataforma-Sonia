import { type ReactNode, forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react"
import { toast } from "sonner"
import { AudioLines, Loader2, Mic2, PhoneCall, SlidersHorizontal, Sparkles, Wand2 } from "lucide-react"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
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
  neuralSettings?: ReactNode
}

export type VoiceSaveOutcome = "skipped" | "saved" | "error"

export type AgentVoiceSettingsHandle = {
  /** Persiste só se houver alterações locais no perfil de voz; caso contrário não chama API. */
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
  {
    key: "stability" as const,
    label: "Estabilidade",
    description:
      "Quanto a voz mantem o mesmo jeito entre uma frase e outra. Mais alto = mais parecida sempre; mais baixo = mais variada (pode falhar um pouco em frases longas).",
    lowLabel: "Mais variada",
    highLabel: "Mais estavel",
  },
  {
    key: "similarityBoost" as const,
    label: "Parecido com a voz escolhida",
    description:
      "Quao perto fica do som original da voz da lista. Mais alto = mais fiel a voz; mais baixo = o sistema muda um pouco mais o timbre.",
    lowLabel: "Mais solto",
    highLabel: "Mais fiel",
  },
  {
    key: "style" as const,
    label: "Expressividade",
    description:
      "Quanto a fala fica animada ou marcada. Alto demais pode soar artificial; para atendimento ou ligacao, prefira valores baixos ou medios.",
    lowLabel: "Mais neutra",
    highLabel: "Mais expressiva",
  },
]

const VOICE_PRESETS = [
  {
    id: "balanced",
    label: "Equilibrada",
    description: "Indicada para uso geral.",
    values: {
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0.15,
      speed: 1,
      useSpeakerBoost: true,
    },
  },
  {
    id: "calm",
    label: "Mais estavel",
    description: "Fala mais consistente e previsivel.",
    values: {
      stability: 0.72,
      similarityBoost: 0.82,
      style: 0.05,
      speed: 0.96,
      useSpeakerBoost: true,
    },
  },
  {
    id: "warm",
    label: "Mais humana",
    description: "Um pouco mais natural.",
    values: {
      stability: 0.42,
      similarityBoost: 0.7,
      style: 0.24,
      speed: 1,
      useSpeakerBoost: true,
    },
  },
  {
    id: "fast_humanized",
    label: "Um pouco mais rapida",
    description: "Fala levemente acelerada.",
    values: {
      stability: 0.46,
      similarityBoost: 0.72,
      style: 0.04,
      speed: 1.08,
      useSpeakerBoost: false,
    },
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
    previewText: profile?.previewText || defaults?.previewText || "Ola, eu sou o seu agente de IA. Como posso ajudar voce hoje?",
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
      )?.id || null,
    [draft.similarityBoost, draft.speed, draft.stability, draft.style, draft.useSpeakerBoost]
  )

  const applyPreset = (presetId: string) => {
    const preset = VOICE_PRESETS.find((item) => item.id === presetId)
    if (!preset) return

    setDraft((current) => ({
      ...current,
      stability: preset.values.stability,
      similarityBoost: preset.values.similarityBoost,
      style: preset.values.style,
      speed: preset.values.speed,
      useSpeakerBoost: preset.values.useSpeakerBoost,
    }))
  }

  const persistVoiceDraft = async (): Promise<VoiceSaveOutcome> => {
    if (!agentId) {
      return "skipped"
    }

    if (serializeDraft(draft) === savedSnapshot) {
      return "skipped"
    }

    if (!draft.voiceId) {
      toast.error("Selecione uma voz da ElevenLabs para salvar as alterações de voz.")
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

  useImperativeHandle(
    ref,
    () => ({
      saveVoiceIfDirty: persistVoiceDraft,
    }),
    [agentId, draft, savedSnapshot, saveProfile, selectedVoice]
  )

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
      <section className="rounded-xl border border-dashed border-border bg-card p-5 text-sm text-foreground/70 sm:p-6">
        Salve o agente primeiro para habilitar a configuracao de voz.
      </section>
    )
  }

  return (
    <section className="mt-2 space-y-8 rounded-xl border border-border bg-card p-5 text-foreground shadow-none sm:mt-3 sm:p-6 lg:mt-4 lg:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Mic2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/60 dark:text-muted-foreground">
                Voz do Agente
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-foreground/72">
                Escolha a voz e teste com Ouvir. O perfil é gravado junto com o botão <span className="font-medium text-foreground">Salvar alterações</span> no topo da página.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasUnsavedChanges ? <Badge className="bg-amber-500 text-white">Alteracoes nao salvas</Badge> : null}
          {draft.enabled ? <Badge className="bg-emerald-600 text-white">Voz ativa</Badge> : <Badge variant="secondary">Voz desativada</Badge>}
          {draft.callsEnabled ? <Badge className="bg-cyan-600 text-white">Ligacoes ativas</Badge> : <Badge variant="secondary">Ligacoes recusadas</Badge>}
        </div>
      </div>

      <div className="rounded-lg border border-border/80 bg-muted/25 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="space-y-1 text-sm text-foreground/72">
            <p className="font-medium text-foreground">Em resumo</p>
            <p>1) Escolha uma voz na lista.</p>
            <p>2) Use um preset ou os controles ao lado.</p>
            <p>3) Ouvir e, ao finalizar, use Salvar alterações no topo para gravar voz e demais configs.</p>
          </div>
        </div>
      </div>

      {!data?.providerConfigured ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
          Configure <code>ELEVENLABS_API_KEY</code> e <code>ELEVENLABS_DEFAULT_MODEL_ID</code> no backend para listar vozes e gerar previews.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-8 2xl:grid-cols-[minmax(0,1.25fr)_360px]">
        <div className="space-y-8">
          <div className="flex flex-col gap-4 rounded-lg border border-border/80 bg-muted/25 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label className="text-sm font-semibold text-foreground">Ativar voz do agente</Label>
              <p className="mt-1 text-sm text-foreground/70">
                Liga o uso de audio sintetizado para este agente (quando o canal permitir enviar audio em vez de so texto).
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

          <div className="flex flex-col gap-4 rounded-lg border border-border/80 bg-muted/25 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/12 text-cyan-700 dark:text-cyan-300">
                <PhoneCall className="h-4 w-4" />
              </div>
              <div>
                <Label className="text-sm font-semibold text-foreground">Permitir ligacoes com voz (WhatsApp)</Label>
                <p className="mt-1 text-sm text-foreground/70">
                  Se ligado, este agente pode atender chamadas de voz. O que voce fala e convertido em texto automaticamente; estas opcoes so mudam como a IA fala na resposta. Desligado = chamada recusada.
                </p>
              </div>
            </div>
            <Switch
              checked={draft.callsEnabled}
              onCheckedChange={(checked) => {
                setDraft((current) => ({
                  ...current,
                  callsEnabled: checked,
                  enabled: checked ? true : current.enabled,
                }))
                setError(null)
              }}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-2">
              <Label>Provedor ativo</Label>
               <div className="flex min-h-11 items-center justify-between rounded-lg border border-border/80 bg-muted/25 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">ElevenLabs</div>
                  <div className="text-xs text-foreground/65">Sintetiza a fala das respostas (ElevenLabs).</div>
                </div>
                <Badge variant="secondary" className="rounded-md">Padrao</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Modelo</Label>
              <Input
                value={draft.modelId}
                onChange={(event) => setDraft((current) => ({ ...current, modelId: event.target.value }))}
                placeholder={data?.defaults.modelId || "eleven_multilingual_v2"}
                className="h-11 rounded-lg border-border/80 bg-muted/20"
              />
              <p className="text-xs leading-relaxed text-foreground/65">
                Deixe o que o sistema sugerir (<span className="font-medium text-foreground">eleven_multilingual_v2</span> costuma funcionar bem em portugues). So mude se a equipe tecnica pedir outro modelo.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-muted/25 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Resumo</h3>
                <p className="text-sm text-foreground/70">Voz e ajustes que serao salvos neste agente.</p>
              </div>
              {selectedVoice ? <Badge className="bg-cyan-600 text-white">Pronta para testar</Badge> : <Badge variant="secondary">Nenhuma voz escolhida</Badge>}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border/80 bg-background/80 p-4 dark:bg-card">
                <div className="text-xs uppercase tracking-[0.18em] text-foreground/55">Voz</div>
                <div className="mt-2 text-sm font-semibold text-foreground">
                  {selectedVoice?.name || "Escolha uma voz na lista"}
                </div>
                <p className="mt-1 text-sm text-foreground/72">
                  {selectedVoice?.description || "A voz escolhida aparece aqui com um resumo simples para validacao."}
                </p>
              </div>

              <div className="rounded-lg border border-border/80 bg-background/80 p-4 dark:bg-card">
                <div className="text-xs uppercase tracking-[0.18em] text-foreground/55">Comportamento</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">{draft.enabled ? "Ativo para audio" : "Desativado"}</Badge>
                  <Badge variant={draft.callsEnabled ? "secondary" : "outline"}>
                    {draft.callsEnabled ? "Atende ligacoes" : "Recusa ligacoes"}
                  </Badge>
                  <Badge variant="outline">{selectedPreset ? VOICE_PRESETS.find((preset) => preset.id === selectedPreset)?.label : "Ajuste personalizado"}</Badge>
                  <Badge variant="outline">{draft.modelId || data?.defaults.modelId || "Modelo padrao"}</Badge>
                </div>
                <p className="mt-2 text-sm text-foreground/72">Salvar alterações (topo da página) grava a voz e o restante da configuração.</p>
              </div>
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

          {neuralSettings ? <div className="pt-4 sm:pt-5">{neuralSettings}</div> : null}
        </div>

        <div className="space-y-6 rounded-lg border border-border/80 bg-muted/20 p-5 sm:p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
              <h3 className="font-semibold text-foreground">Ajustes de voz</h3>
            </div>
            <p className="text-sm leading-relaxed text-foreground/70">
              Presets sao atalhos; voce pode afinar cada barra abaixo.
            </p>

            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                <span className="text-sm font-medium text-foreground">Ajustes rapidos</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 2xl:grid-cols-1">
                {VOICE_PRESETS.map((preset) => {
                  const isActive = selectedPreset === preset.id

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      className={`rounded-lg border px-4 py-4 text-left transition-all ${
                        isActive
                          ? "border-primary bg-primary/10 shadow-none"
                          : "border-border/80 bg-background/85 hover:border-primary/35 dark:bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-foreground">{preset.label}</span>
                        {isActive ? <Badge className="bg-cyan-600 text-white">Atual</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm text-foreground/72">{preset.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {VOICE_TUNING_CONTROLS.map((item) => (
              <div key={item.key} className="space-y-3 rounded-lg border border-border/80 bg-background/85 px-4 py-4 dark:bg-card">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">{item.label}</Label>
                    <p className="text-sm leading-relaxed text-foreground/72">{item.description}</p>
                  </div>
                  <span className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">
                    {Math.round(draft[item.key] * 100)}%
                  </span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={[draft[item.key]]}
                  onValueChange={(values) =>
                    setDraft((current) => ({
                      ...current,
                      [item.key]: values[0] ?? current[item.key],
                    }))
                  }
                />
                <div className="flex items-center justify-between text-xs text-foreground/60 dark:text-zinc-400">
                  <span>{item.lowLabel}</span>
                  <span>{item.highLabel}</span>
                </div>
              </div>
            ))}

            <div className="space-y-3 rounded-lg border border-border/80 bg-background/85 px-4 py-4 dark:bg-card">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Velocidade</Label>
                  <p className="text-sm leading-relaxed text-foreground/72">
                    1,0 e o normal. Mais rapido encurta o audio; muito alto pode embolar palavras no celular. Suba aos poucos e use Ouvir.
                  </p>
                </div>
                <span className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">
                  {draft.speed.toFixed(2)}x
                </span>
              </div>
              <Slider
                min={0.7}
                max={1.2}
                step={0.01}
                value={[draft.speed]}
                onValueChange={(values) =>
                  setDraft((current) => ({
                    ...current,
                    speed: values[0] ?? current.speed,
                  }))
                }
              />
              <div className="flex items-center justify-between text-xs text-foreground/60 dark:text-zinc-400">
                <span>Mais calma</span>
                <span>Mais rapida</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-background/85 px-4 py-4 dark:bg-card">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Voz mais clara no telefone</Label>
                <p className="text-sm text-foreground/72">
                  Deixa o som um pouco mais nitido em chamadas e audio comprimido. Se soar estranho, desligue e teste de novo com Ouvir.
                </p>
              </div>
              <Switch
                checked={draft.useSpeakerBoost}
                onCheckedChange={(checked) => setDraft((current) => ({ ...current, useSpeakerBoost: checked }))}
              />
            </div>

            <div className="rounded-lg border border-dashed border-border/80 bg-background/70 px-4 py-3 text-sm text-foreground/72 dark:bg-card">
              Soa artificial? Baixe <span className="font-medium text-foreground">Expressividade</span>. Soa sempre diferente? Suba um pouco <span className="font-medium text-foreground">Estabilidade</span>.
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border/80 bg-background/85 p-4 dark:bg-card">
            <div className="flex items-center gap-2">
              <AudioLines className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
              <h3 className="font-semibold text-foreground">Preview em tempo real</h3>
            </div>
            <p className="text-sm leading-relaxed text-foreground/72">
              Digite uma frase de exemplo e ouca antes de salvar.
            </p>

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

          {isSaving ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-border/80 bg-muted/25 py-3 text-sm text-foreground/70">
              <Loader2 className="h-4 w-4 animate-spin" />
              Gravando voz...
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-3 py-3 text-center text-sm text-foreground/65">
              Use <span className="font-medium text-foreground">Salvar alterações</span> no topo para aplicar estes ajustes de voz.
            </p>
          )}
        </div>
      </div>
    </section>
  )
})
