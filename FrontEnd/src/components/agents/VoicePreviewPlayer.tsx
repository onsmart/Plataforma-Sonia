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
      void audioRef.current.play().catch(() => undefined)
    }
  }, [audioUrl])

  return (
    <div className="space-y-4">
      <Textarea
        value={previewText}
        onChange={(event) => onPreviewTextChange(event.target.value)}
        placeholder="Digite um texto curto para ouvir a voz do agente."
        className="min-h-[120px] rounded-[1.25rem] border-zinc-200/90 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/40"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          onClick={onGeneratePreview}
          disabled={disabled || isLoading}
          className="h-12 rounded-2xl px-5"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Volume2 className="mr-2 h-4 w-4" />}
          Ouvir voz
        </Button>

        {audioUrl ? (
          <audio ref={audioRef} controls className="w-full max-w-md">
            <source src={audioUrl} type="audio/mpeg" />
          </audio>
        ) : (
          <div className="text-sm text-muted-foreground">O preview toca aqui sem sair da tela.</div>
        )}
      </div>

      {error ? (
        <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          {error}
        </div>
      ) : null}
    </div>
  )
}
