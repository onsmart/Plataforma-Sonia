import { BASE_URL, getAuthHeaders } from "./api"

export type VoiceProvider = "elevenlabs"

export interface AgentVoiceProfile {
  id: string
  agentId: string
  provider: VoiceProvider
  voiceId: string
  voiceName: string | null
  modelId: string | null
  stability: number | null
  similarityBoost: number | null
  style: number | null
  speed: number | null
  useSpeakerBoost: boolean
  previewText: string | null
  enabled: boolean
  callsEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface AgentVoiceProfileResponse {
  profile: AgentVoiceProfile | null
  defaults: {
    provider: VoiceProvider
    modelId: string | null
    previewText: string
  }
  providerConfigured: boolean
}

export interface ElevenLabsVoiceCatalogItem {
  voiceId: string
  name: string
  category: string | null
  labels: Record<string, string>
  previewUrl: string | null
  description: string | null
}

export interface SaveAgentVoiceProfilePayload {
  provider?: VoiceProvider
  voiceId: string
  voiceName?: string | null
  modelId?: string | null
  stability?: number | null
  similarityBoost?: number | null
  style?: number | null
  speed?: number | null
  useSpeakerBoost?: boolean
  previewText?: string | null
  enabled?: boolean
  callsEnabled?: boolean
}

export interface VoicePreviewPayload extends SaveAgentVoiceProfilePayload {
  text: string
}

export interface VoiceGenerationPayload {
  text: string
  channel?: "preview" | "web" | "whatsapp_audio" | "whatsapp_call"
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      typeof (data as any)?.error === "string"
        ? (data as any).error
        : `Erro ${response.status}`

    throw new Error(message)
  }

  return data as T
}

export const VoiceService = {
  async getAgentVoiceProfile(agentId: string): Promise<AgentVoiceProfileResponse> {
    const response = await fetch(`${BASE_URL}/agents/${encodeURIComponent(agentId)}/voice-profile`, {
      headers: await getAuthHeaders(),
    })

    return parseJsonResponse<AgentVoiceProfileResponse>(response)
  },

  async saveAgentVoiceProfile(
    agentId: string,
    payload: SaveAgentVoiceProfilePayload
  ): Promise<AgentVoiceProfileResponse> {
    const response = await fetch(`${BASE_URL}/agents/${encodeURIComponent(agentId)}/voice-profile`, {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    return parseJsonResponse<AgentVoiceProfileResponse>(response)
  },

  async listElevenLabsVoices(): Promise<ElevenLabsVoiceCatalogItem[]> {
    const response = await fetch(`${BASE_URL}/voice/elevenlabs/voices`, {
      headers: await getAuthHeaders(),
    })

    const data = await parseJsonResponse<{ provider: VoiceProvider; voices: ElevenLabsVoiceCatalogItem[] }>(response)
    return Array.isArray(data.voices) ? data.voices : []
  },

  async generateVoicePreview(agentId: string, payload: VoicePreviewPayload): Promise<Blob> {
    const response = await fetch(`${BASE_URL}/agents/${encodeURIComponent(agentId)}/voice-preview`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      const message =
        typeof (data as any)?.error === "string"
          ? (data as any).error
          : `Erro ${response.status}`
      throw new Error(message)
    }

    return response.blob()
  },

  async generateAgentVoiceResponse(agentId: string, payload: VoiceGenerationPayload): Promise<Blob> {
    const response = await fetch(`${BASE_URL}/agents/${encodeURIComponent(agentId)}/generate-voice-response`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      const message =
        typeof (data as any)?.error === "string"
          ? (data as any).error
          : `Erro ${response.status}`
      throw new Error(message)
    }

    return response.blob()
  },
}
