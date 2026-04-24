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
      <Input
        value={searchTerm}
        onChange={(event) => onSearchTermChange(event.target.value)}
        placeholder="Buscar voz por nome, categoria ou estilo"
        className="h-12 rounded-2xl border-zinc-200/90 bg-white/85 px-4 dark:border-zinc-700 dark:bg-zinc-900/70"
      />

      <ScrollArea className="h-[320px] rounded-[1.5rem] border border-zinc-200/80 bg-white/75 p-2 dark:border-zinc-700 dark:bg-zinc-950/40">
        <div className="space-y-2">
          {isLoading ? (
            <div className="rounded-[1.25rem] border border-dashed border-zinc-200 p-5 text-sm text-muted-foreground dark:border-zinc-700">
              Carregando vozes da ElevenLabs...
            </div>
          ) : error ? (
            <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50/80 p-5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              {error}
            </div>
          ) : filteredVoices.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-zinc-200 p-5 text-sm text-muted-foreground dark:border-zinc-700">
              Nenhuma voz encontrada com esse filtro.
            </div>
          ) : (
            filteredVoices.map((voice) => {
              const isSelected = selectedVoiceId === voice.voiceId

              return (
                <button
                  key={voice.voiceId}
                  type="button"
                  onClick={() => onSelectVoice(voice)}
                  className={cn(
                    "w-full rounded-[1.25rem] border p-4 text-left transition-all",
                    isSelected
                      ? "border-cyan-400 bg-cyan-50/90 shadow-sm dark:border-cyan-500 dark:bg-cyan-950/30"
                      : "border-zinc-200/80 bg-white/80 hover:border-cyan-200 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-cyan-900/80 dark:hover:bg-zinc-900"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-50">{voice.name}</div>
                      <div className="flex flex-wrap gap-2">
                        {voice.category ? <Badge variant="secondary">{voice.category}</Badge> : null}
                        {Object.entries(voice.labels)
                          .slice(0, 3)
                          .map(([key, value]) => (
                            <Badge key={key} variant="outline" className="border-zinc-200/90 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                              {key}: {value}
                            </Badge>
                          ))}
                      </div>
                    </div>
                    {isSelected ? (
                      <Badge className="bg-cyan-600 text-white">Selecionada</Badge>
                    ) : null}
                  </div>
                  {voice.description ? (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{voice.description}</p>
                  ) : null}
                </button>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
