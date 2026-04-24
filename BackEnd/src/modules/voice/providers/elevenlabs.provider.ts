import logger from '../../../lib/logger'
import {
  type ElevenLabsSpeechRequest,
  type ElevenLabsVoice,
  type VoiceProvider,
  VoiceModuleError,
} from '../types/voice.types'

const ELEVENLABS_API_BASE_URL = 'https://api.elevenlabs.io/v1'
const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128'

function getApiKey(): string {
  return String(process.env.ELEVENLABS_API_KEY || '').trim()
}

function getDefaultModelId(): string | null {
  const value = String(process.env.ELEVENLABS_DEFAULT_MODEL_ID || '').trim()
  return value || null
}

function buildVoiceSettingsPayload(input: ElevenLabsSpeechRequest) {
  const payload: Record<string, unknown> = {}

  if (typeof input.stability === 'number') payload.stability = input.stability
  if (typeof input.similarityBoost === 'number') payload.similarity_boost = input.similarityBoost
  if (typeof input.style === 'number') payload.style = input.style
  if (typeof input.useSpeakerBoost === 'boolean') payload.use_speaker_boost = input.useSpeakerBoost

  return Object.keys(payload).length > 0 ? payload : undefined
}

async function assertSuccessfulResponse(response: Response, context: string): Promise<void> {
  if (response.ok) return

  let details = response.statusText
  try {
    details = await response.text()
  } catch {
    details = response.statusText
  }

  throw new VoiceModuleError(`ElevenLabs retornou erro em ${context}`, {
    code: 'ELEVENLABS_API_ERROR',
    statusCode: response.status === 401 || response.status === 403 ? 503 : 502,
    cause: details,
  })
}

export class ElevenLabsProvider implements VoiceProvider {
  public readonly name = 'elevenlabs' as const

  isConfigured(): boolean {
    return getApiKey().length > 0
  }

  private assertConfigured(): void {
    if (this.isConfigured()) return

    throw new VoiceModuleError('ElevenLabs nao configurado no backend.', {
      code: 'VOICE_PROVIDER_NOT_CONFIGURED',
      statusCode: 503,
    })
  }

  private getHeaders(contentType: boolean = false): Record<string, string> {
    const headers: Record<string, string> = {
      'xi-api-key': getApiKey(),
      accept: 'application/json',
    }

    if (contentType) {
      headers['Content-Type'] = 'application/json'
    }

    return headers
  }

  async listVoices(): Promise<ElevenLabsVoice[]> {
    this.assertConfigured()

    const response = await fetch(`${ELEVENLABS_API_BASE_URL}/voices`, {
      method: 'GET',
      headers: this.getHeaders(false),
    })

    await assertSuccessfulResponse(response, 'listVoices')

    const data = (await response.json()) as { voices?: ElevenLabsVoice[] }
    return Array.isArray(data.voices) ? data.voices : []
  }

  async getVoice(voiceId: string): Promise<ElevenLabsVoice | null> {
    this.assertConfigured()

    const normalizedVoiceId = String(voiceId || '').trim()
    if (!normalizedVoiceId) {
      return null
    }

    const response = await fetch(`${ELEVENLABS_API_BASE_URL}/voices/${encodeURIComponent(normalizedVoiceId)}`, {
      method: 'GET',
      headers: this.getHeaders(false),
    })

    if (response.status === 404) {
      return null
    }

    await assertSuccessfulResponse(response, 'getVoice')
    return (await response.json()) as ElevenLabsVoice
  }

  async generateSpeech(input: ElevenLabsSpeechRequest): Promise<Buffer> {
    return this.generateSpeechBuffer(input, 'generateSpeech')
  }

  async generatePreview(input: ElevenLabsSpeechRequest): Promise<Buffer> {
    return this.generateSpeechBuffer(input, 'generatePreview')
  }

  async transcribeAudio(): Promise<string> {
    throw new VoiceModuleError('Transcricao ElevenLabs ainda nao esta conectada ao projeto.', {
      code: 'VOICE_STT_NOT_IMPLEMENTED',
      statusCode: 501,
    })
  }

  private async generateSpeechBuffer(input: ElevenLabsSpeechRequest, context: string): Promise<Buffer> {
    this.assertConfigured()

    const normalizedVoiceId = String(input.voiceId || '').trim()
    if (!normalizedVoiceId) {
      throw new VoiceModuleError('voiceId e obrigatorio para gerar audio.', {
        code: 'VOICE_ID_REQUIRED',
        statusCode: 400,
      })
    }

    const outputFormat = String(input.outputFormat || DEFAULT_OUTPUT_FORMAT).trim() || DEFAULT_OUTPUT_FORMAT
    const modelId = String(input.modelId || getDefaultModelId() || '').trim() || undefined

    const response = await fetch(
      `${ELEVENLABS_API_BASE_URL}/text-to-speech/${encodeURIComponent(normalizedVoiceId)}/stream?output_format=${encodeURIComponent(outputFormat)}`,
      {
        method: 'POST',
        headers: {
          ...this.getHeaders(true),
          accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: input.text,
          model_id: modelId,
          voice_settings: buildVoiceSettingsPayload(input),
        }),
      }
    )

    await assertSuccessfulResponse(response, context)

    const arrayBuffer = await response.arrayBuffer()
    logger.info('[voice.elevenlabs] Audio gerado com sucesso', {
      context,
      voiceId: normalizedVoiceId,
      modelId: modelId || null,
      bytes: arrayBuffer.byteLength,
    })
    return Buffer.from(arrayBuffer)
  }
}
