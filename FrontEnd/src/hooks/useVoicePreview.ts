import { useEffect, useState } from "react"
import { type VoicePreviewPayload, VoiceService } from "../services/voice"

export function useVoicePreview(agentId: string | null) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      setAudioUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl)
        }
        return null
      })
    }
  }, [])

  const generatePreview = async (payload: VoicePreviewPayload) => {
    if (!agentId) {
      throw new Error("Salve o agente antes de ouvir o preview.")
    }

    setIsLoading(true)
    setError(null)

    try {
      const blob = await VoiceService.generateVoicePreview(agentId, payload)
      const nextUrl = URL.createObjectURL(blob)
      setAudioUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl)
        }
        return nextUrl
      })
      return nextUrl
    } catch (err: any) {
      const message = err?.message || "Erro ao gerar preview da voz."
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    audioUrl,
    isLoading,
    error,
    generatePreview,
    setError,
  }
}
