import { CheckCircle2, Headphones, Mic2, Search, Sparkles } from "lucide-react"
import { Badge } from "../ui/badge"
import { Input } from "../ui/input"
import { ScrollArea } from "../ui/scroll-area"
import { cn } from "../../lib/utils"
import { type ElevenLabsVoiceCatalogItem } from "../../services/voice"
import { agentConfigInput, agentConfigInnerPanel } from "../../lib/agent-config-layout"

interface VoiceSelectorProps {
  voices: ElevenLabsVoiceCatalogItem[]
  selectedVoiceId: string
  searchTerm: string
  isLoading: boolean
  error: string | null
  onSearchTermChange: (value: string) => void
  onSelectVoice: (voice: ElevenLabsVoiceCatalogItem) => void
}

const AVATAR_GRADIENTS = [
  "from-cyan-500 via-sky-500 to-blue-500",
  "from-emerald-500 via-teal-500 to-cyan-500",
  "from-fuchsia-500 via-violet-500 to-purple-500",
  "from-amber-400 via-orange-500 to-rose-500",
  "from-blue-500 via-indigo-500 to-violet-500",
  "from-teal-400 via-cyan-500 to-sky-500",
]

const ACCENT_FLAGS: Record<string, string> = {
  american: "🇺🇸",
  british: "🇬🇧",
  australian: "🇦🇺",
  canadian: "🇨🇦",
  irish: "🇮🇪",
  scottish: "🇬🇧",
  welsh: "🇬🇧",
  indian: "🇮🇳",
  brazilian: "🇧🇷",
  portuguese: "🇵🇹",
  mexican: "🇲🇽",
  argentinian: "🇦🇷",
  colombian: "🇨🇴",
  spanish: "🇪🇸",
  french: "🇫🇷",
  italian: "🇮🇹",
  german: "🇩🇪",
  japanese: "🇯🇵",
  kanto: "🇯🇵",
  korean: "🇰🇷",
  chinese: "🇨🇳",
}

function formatLabelKey(key: string): string {
  const normalized = key.replace(/_/g, " ").trim().toLowerCase()
  if (normalized === "use case") return "Uso"
  if (normalized === "accent") return "Sotaque"
  if (normalized === "gender") return "Gênero"
  if (normalized === "age") return "Faixa etária"
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function formatLabelValue(value: string): string {
  const normalized = String(value || "").replace(/_/g, " ").trim()
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function getAccentFlag(value: string): string | null {
  const normalized = String(value || "").replace(/_/g, " ").trim().toLowerCase()
  return ACCENT_FLAGS[normalized] || null
}

function formatCategory(category: string | null): string {
  if (!category) return "Voz pronta"
  const normalized = category.replace(/_/g, " ").trim()
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function getVoiceInitials(name: string): string {
  const parts = name
    .split(/[\s-]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
  if (parts.length === 0) return "AI"
  return parts.map((part) => part[0]?.toUpperCase() || "").join("")
}

export function getVoiceGradientClass(seed: string): string {
  let total = 0
  for (const char of seed) total += char.charCodeAt(0)
  return AVATAR_GRADIENTS[total % AVATAR_GRADIENTS.length]
}

export function SelectedVoiceHero({
  voice,
  voiceName,
  variant = "card",
}: {
  voice: ElevenLabsVoiceCatalogItem | null
  voiceName?: string
  variant?: "card" | "banner"
}) {
  const displayName = voice?.name || voiceName
  if (!displayName) {
    return (
      <div
        className={cn(
          agentConfigInnerPanel,
          "flex items-center gap-3 border-dashed px-4 py-4",
          variant === "banner" && "rounded-xl"
        )}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Mic2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Nenhuma voz selecionada</p>
          <p className="text-xs text-muted-foreground">Escolha uma voz no catálogo ao lado.</p>
        </div>
      </div>
    )
  }

  const gradientClass = getVoiceGradientClass(displayName)
  const accentEntry = voice ? Object.entries(voice.labels).find(([key]) => key.toLowerCase() === "accent") : null

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-primary/15 bg-gradient-to-r from-primary/[0.07] via-card to-card px-4 py-3.5",
        variant === "banner" && "from-primary/[0.09]"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-black text-white shadow-inner",
            gradientClass
          )}
        >
          {getVoiceInitials(displayName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
            <Badge className="rounded-md bg-primary/90 px-2 py-0 text-[10px] text-primary-foreground">Ativa no agente</Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {voice ? formatCategory(voice.category) : "Voz salva no perfil"}
            {accentEntry ? ` · ${getAccentFlag(accentEntry[1]) || ""} ${formatLabelValue(accentEntry[1])}` : ""}
          </p>
        </div>
        <CheckCircle2 className="hidden h-5 w-5 shrink-0 text-primary sm:block" />
      </div>
    </div>
  )
}

export function VoiceSelector({
  voices,
  selectedVoiceId,
  searchTerm,
  isLoading,
  error,
  onSearchTermChange,
  onSelectVoice,
}: VoiceSelectorProps) {
  const filteredVoices = voices.filter((voice) => {
    const haystack = `${voice.name} ${voice.category || ""} ${Object.values(voice.labels).join(" ")}`.toLowerCase()
    return haystack.includes(searchTerm.toLowerCase())
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Catálogo de vozes</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{filteredVoices.length} vozes disponíveis</p>
        </div>
        <Badge variant="secondary" className="w-fit rounded-md px-2.5 py-0.5 text-[11px]">
          ElevenLabs
        </Badge>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          placeholder="Nome, sotaque ou perfil…"
          className={cn(agentConfigInput, "pl-9")}
        />
      </div>

      <ScrollArea
        className={cn(
          "h-[min(52vh,420px)] overflow-hidden rounded-xl border border-border/50 bg-muted/10 p-2 sm:h-[400px]",
          "[&_[data-slot=scroll-area-viewport]]:pr-3",
          "[&_[data-slot=scroll-area-scrollbar]]:mr-1 [&_[data-slot=scroll-area-scrollbar]]:w-3.5",
          "[&_[data-slot=scroll-area-scrollbar]]:rounded-full [&_[data-slot=scroll-area-scrollbar]]:bg-transparent",
          "[&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:bg-zinc-300/80 dark:[&_[data-slot=scroll-area-thumb]]:bg-zinc-700/90"
        )}
      >
        <div className="grid gap-2">
          {isLoading ? (
            <div className={cn(agentConfigInnerPanel, "border-dashed p-5 text-sm text-muted-foreground")}>
              Carregando vozes da ElevenLabs…
            </div>
          ) : error ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              {error}
            </div>
          ) : filteredVoices.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-background/70 p-5 text-sm text-muted-foreground">
              Nenhuma voz encontrada com esse filtro.
            </div>
          ) : (
            filteredVoices.map((voice) => {
              const isSelected = selectedVoiceId === voice.voiceId
              const gradientClass = getVoiceGradientClass(voice.name)
              const accentTag = Object.entries(voice.labels).find(([key]) => key.toLowerCase() === "accent")
              const genderTag = Object.entries(voice.labels).find(([key]) => key.toLowerCase() === "gender")

              return (
                <button
                  key={voice.voiceId}
                  type="button"
                  onClick={() => onSelectVoice(voice)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20"
                      : "border-border/60 bg-background/90 hover:border-primary/35 hover:bg-background dark:bg-card/60"
                  )}
                >
                  <div className="relative shrink-0">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-black text-white",
                        gradientClass
                      )}
                    >
                      {getVoiceInitials(voice.name)}
                    </div>
                    {isSelected ? (
                      <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                      </div>
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{voice.name}</span>
                      {voice.previewUrl ? (
                        <Headphones className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Amostra disponível" />
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>{formatCategory(voice.category)}</span>
                      {accentTag ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>
                            {getAccentFlag(accentTag[1]) ? `${getAccentFlag(accentTag[1])} ` : ""}
                            {formatLabelValue(accentTag[1])}
                          </span>
                        </>
                      ) : null}
                      {genderTag ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>{formatLabelValue(genderTag[1])}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {isSelected ? (
                    <Badge className="hidden shrink-0 rounded-md bg-primary px-2 py-0 text-[10px] text-primary-foreground sm:inline-flex">
                      Selecionada
                    </Badge>
                  ) : (
                    <Sparkles className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/50 group-hover:text-primary/60 sm:block" />
                  )}
                </button>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
