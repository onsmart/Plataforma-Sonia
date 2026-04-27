import { useEffect, useRef } from "react"
import { Button } from "../ui/button"
import { Textarea } from "../ui/textarea"
import { Loader2, Volume2 } from "lucide-react"

interface VoicePreviewPlayerProps {
  previewText: string
  audioUrl: string | null
  isLoading: boolean
  error: string | null
  disabled: boolean
  onPreviewTextChange: (value: string) => void
  onGeneratePreview: () => void
}

export function VoicePreviewPlayer({
  previewText,
  audioUrl,
  isLoading,
  error,
  disabled,
  onPreviewTextChange,
  onGeneratePreview,
}: VoicePreviewPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.load()
      void audioRef.current.play().catch(() => undefined)
    }
  }, [audioUrl])

  return (
    <div className="space-y-4">
      <Textarea
        value={previewText}
        onChange={(event) => onPreviewTextChange(event.target.value)}
        placeholder="Digite um texto curto para ouvir a voz do agente."
        className="min-h-[120px] rounded-lg border-border/80 bg-background p-4"
      />

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          onClick={onGeneratePreview}
          disabled={disabled || isLoading}
          className="h-11 w-full rounded-lg sm:w-auto"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Volume2 className="mr-2 h-4 w-4" />}
          Ouvir voz
        </Button>

        <div className="rounded-lg border border-border/80 bg-background/85 p-3 dark:bg-card">
          {audioUrl ? (
            <audio
              key={audioUrl}
              ref={audioRef}
              controls
              autoPlay
              preload="auto"
              className="w-full"
              onCanPlay={() => {
                if (audioRef.current) {
                  void audioRef.current.play().catch(() => undefined)
                }
              }}
            >
              <source src={audioUrl} type="audio/mpeg" />
            </audio>
          ) : (
            <div className="text-sm text-foreground/70">O preview aparece aqui e toca sem sair da tela.</div>
          )}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          {error}
        </div>
      ) : null}
    </div>
  )
}
