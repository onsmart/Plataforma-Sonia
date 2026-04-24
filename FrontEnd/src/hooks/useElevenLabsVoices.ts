import { useEffect, useState } from "react"
import { type ElevenLabsVoiceCatalogItem, VoiceService } from "../services/voice"

export function useElevenLabsVoices(enabled: boolean) {
  const [voices, setVoices] = useState<ElevenLabsVoiceCatalogItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setVoices([])
      setError(null)
      return
    }

    let mounted = true

    const load = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const nextVoices = await VoiceService.listElevenLabsVoices()
        if (mounted) {
          setVoices(nextVoices)
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || "Erro ao carregar vozes da ElevenLabs.")
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [enabled])

  return {
    voices,
    isLoading,
    error,
  }
}
