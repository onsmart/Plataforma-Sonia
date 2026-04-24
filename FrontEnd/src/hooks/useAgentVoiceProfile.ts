import { useEffect, useState } from "react"
import { type AgentVoiceProfileResponse, type SaveAgentVoiceProfilePayload, VoiceService } from "../services/voice"

export function useAgentVoiceProfile(agentId: string | null) {
  const [data, setData] = useState<AgentVoiceProfileResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!agentId) {
      setData(null)
      setError(null)
      return
    }

    let mounted = true

    const load = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const nextData = await VoiceService.getAgentVoiceProfile(agentId)
        if (mounted) {
          setData(nextData)
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || "Erro ao carregar perfil de voz.")
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
  }, [agentId])

  const saveProfile = async (payload: SaveAgentVoiceProfilePayload) => {
    if (!agentId) {
      throw new Error("Salve o agente antes de configurar a voz.")
    }

    setIsSaving(true)
    setError(null)

    try {
      const nextData = await VoiceService.saveAgentVoiceProfile(agentId, payload)
      setData(nextData)
      return nextData
    } catch (err: any) {
      const message = err?.message || "Erro ao salvar perfil de voz."
      setError(message)
      throw err
    } finally {
      setIsSaving(false)
    }
  }

  return {
    data,
    isLoading,
    isSaving,
    error,
    saveProfile,
    setError,
  }
}
