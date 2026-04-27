import { CheckCircle2, Headphones, Sparkles } from "lucide-react"
import { Badge } from "../ui/badge"
import { Input } from "../ui/input"
import { ScrollArea } from "../ui/scroll-area"
import { cn } from "../../lib/utils"
import { type ElevenLabsVoiceCatalogItem } from "../../services/voice"

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
  if (normalized === "gender") return "Genero"
  if (normalized === "age") return "Faixa etaria"

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

function getVoiceInitials(name: string): string {
  const parts = name
    .split(/[\s-]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) return "AI"
  return parts.map((part) => part[0]?.toUpperCase() || "").join("")
}

function getGradientClass(seed: string): string {
  let total = 0
  for (const char of seed) total += char.charCodeAt(0)
  return AVATAR_GRADIENTS[total % AVATAR_GRADIENTS.length]
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
    const haystack = `${voice.name} ${voice.category || ""} ${Object.values(voice.labels).join(" ")}`
      .toLowerCase()
    return haystack.includes(searchTerm.toLowerCase())
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Catalogo de vozes</h3>
          <p className="mt-1 text-sm text-foreground/70">
            Escolha a voz como em um vitrine visual: identidade, perfil e caracteristicas principais em leitura rapida.
          </p>
        </div>
        <Badge variant="secondary" className="rounded-md px-3 py-1">
          {filteredVoices.length} vozes
        </Badge>
      </div>

      <Input
        value={searchTerm}
        onChange={(event) => onSearchTermChange(event.target.value)}
        placeholder="Busque por nome, sotaque, perfil ou categoria"
        className="h-11 rounded-lg border-border/80 bg-background px-4"
      />

      <ScrollArea
        className={cn(
          "h-[360px] overflow-hidden rounded-lg border border-border/80 bg-muted/20 p-3 md:h-[420px]",
          "[&_[data-slot=scroll-area-viewport]]:pr-3",
          "[&_[data-slot=scroll-area-scrollbar]]:mr-1 [&_[data-slot=scroll-area-scrollbar]]:w-3.5",
          "[&_[data-slot=scroll-area-scrollbar]]:rounded-full [&_[data-slot=scroll-area-scrollbar]]:bg-transparent",
          "[&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:bg-zinc-300/80 dark:[&_[data-slot=scroll-area-thumb]]:bg-zinc-700/90"
        )}
      >
        <div className="grid gap-3 pr-1 xl:grid-cols-2">
          {isLoading ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-background/70 p-5 text-sm text-foreground/70">
              Carregando vozes da ElevenLabs...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              {error}
            </div>
          ) : filteredVoices.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-background/70 p-5 text-sm text-foreground/70">
              Nenhuma voz encontrada com esse filtro.
            </div>
          ) : (
            filteredVoices.map((voice) => {
              const isSelected = selectedVoiceId === voice.voiceId
              const gradientClass = getGradientClass(voice.name)
              const primaryTags = Object.entries(voice.labels).slice(0, 2)
              const accentTag = Object.entries(voice.labels).find(([key]) => key.toLowerCase() === "accent")

              return (
                <button
                  key={voice.voiceId}
                  type="button"
                  onClick={() => onSelectVoice(voice)}
                  className={cn(
                    "group w-full rounded-lg border p-4 text-left transition-colors duration-200",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border/80 bg-background hover:border-primary/35 dark:bg-card"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-black text-white shadow-inner",
                          gradientClass
                        )}
                      >
                        {getVoiceInitials(voice.name)}
                      </div>
                      <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-card bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                        {isSelected ? <CheckCircle2 className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="line-clamp-1 text-base font-semibold text-foreground">
                            {voice.name}
                          </div>
                          <div className="mt-0.5 text-sm text-foreground/65">
                            {formatCategory(voice.category)}
                          </div>
                        </div>

                        {isSelected ? (
                          <Badge className="shrink-0 rounded-md bg-primary px-3 py-1 text-primary-foreground">
                            Selecionada
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {primaryTags.map(([key, value]) => {
                          const isAccent = key.toLowerCase() === "accent"
                          const accentFlag = isAccent ? getAccentFlag(value) : null

                          return (
                            <Badge
                              key={key}
                              variant="outline"
                              className="rounded-md border-border/80 bg-muted/50 px-2.5 py-1 text-[11px] text-foreground/75"
                            >
                              {isAccent && accentFlag ? `${accentFlag} ` : ""}
                              {formatLabelKey(key)}: {formatLabelValue(value)}
                            </Badge>
                          )
                        })}
                        {accentTag && !primaryTags.some(([key]) => key === accentTag[0]) ? (
                          <Badge
                            variant="outline"
                            className="rounded-md border-border/80 bg-muted/50 px-2.5 py-1 text-[11px] text-foreground/75"
                          >
                            {getAccentFlag(accentTag[1]) ? `${getAccentFlag(accentTag[1])} ` : ""}
                            {formatLabelKey(accentTag[0])}: {formatLabelValue(accentTag[1])}
                          </Badge>
                        ) : null}
                      </div>

                      {voice.description ? (
                        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-foreground/72">
                          {voice.description}
                        </p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-foreground/72">
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/50 px-2.5 py-1">
                          <Sparkles className="h-3.5 w-3.5" />
                          Compatível com preview personalizado
                        </span>
                        {voice.previewUrl ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/50 px-2.5 py-1">
                            <Headphones className="h-3.5 w-3.5" />
                            Amostra oficial disponível
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
