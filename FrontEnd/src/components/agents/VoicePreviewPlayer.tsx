import { useEffect, useRef } from "react"
import { Button } from "../ui/button"
import { Textarea } from "../ui/textarea"
import { Loader2, Play, Volume2 } from "lucide-react"
import { cn } from "../../lib/utils"
import { agentConfigFieldHint, agentConfigInput, agentConfigInnerPanel } from "../../lib/agent-config-layout"

interface VoicePreviewPlayerProps {
  previewText: string
  audioUrl: string | null
  isLoading: boolean
  error: string | null
  disabled: boolean
  onPreviewTextChange: (value: string) => void
  onGeneratePreview: () => void
  compact?: boolean
}

export function VoicePreviewPlayer({
  previewText,
  audioUrl,
  isLoading,
  error,
  disabled,
  onPreviewTextChange,
  onGeneratePreview,
  compact = false,
}: VoicePreviewPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.load()
      void audioRef.current.play().catch(() => undefined)
    }
  }, [audioUrl])

  return (
    <div className={cn("space-y-3", compact && "space-y-2.5")}>
      <div>
        <p className="text-xs font-medium text-foreground">Frase de teste</p>
        {!compact ? (
          <p className={agentConfigFieldHint}>Ouça como a voz soa antes de salvar.</p>
        ) : null}
      </div>

      <Textarea
        value={previewText}
        onChange={(event) => onPreviewTextChange(event.target.value)}
        placeholder="Ex.: Olá! Sou a assistente virtual. Como posso ajudar?"
        className={cn(
          agentConfigInput,
          "min-h-[88px] resize-none py-2.5",
          compact && "min-h-[72px] text-xs"
        )}
      />

      <Button
        type="button"
        onClick={onGeneratePreview}
        disabled={disabled || isLoading}
        className="h-10 w-full rounded-lg font-medium"
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : audioUrl ? (
          <Play className="mr-2 h-4 w-4" />
        ) : (
          <Volume2 className="mr-2 h-4 w-4" />
        )}
        {isLoading ? "Gerando áudio…" : audioUrl ? "Ouvir novamente" : "Gerar preview"}
      </Button>

      <div className={cn(agentConfigInnerPanel, "p-3", !audioUrl && "border-dashed")}>
        {audioUrl ? (
          <audio
            key={audioUrl}
            ref={audioRef}
            controls
            preload="auto"
            className="h-9 w-full [&::-webkit-media-controls-panel]:bg-transparent"
          >
            <source src={audioUrl} type="audio/mpeg" />
          </audio>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            O player aparece aqui após gerar o preview.
          </p>
        )}
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  )
}
