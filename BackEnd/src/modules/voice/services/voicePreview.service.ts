import logger from '../../../lib/logger'
import { ElevenLabsProvider } from '../providers/elevenlabs.provider'
import { getDefaultVoicePreviewText } from './voiceProfile.service'
import { type GeneratedVoiceAudio, type VoicePreviewInput, VoiceModuleError } from '../types/voice.types'

const provider = new ElevenLabsProvider()
const MAX_PREVIEW_TEXT_LENGTH = 500

function sanitizePreviewText(text: unknown): string {
  const normalized = String(text || '')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) {
    return getDefaultVoicePreviewText()
  }

  return normalized.slice(0, MAX_PREVIEW_TEXT_LENGTH)
}

export async function generateVoicePreview(input: VoicePreviewInput): Promise<GeneratedVoiceAudio> {
  if (!provider.isConfigured()) {
    throw new VoiceModuleError('ElevenLabs nao configurado no backend.', {
      code: 'VOICE_PROVIDER_NOT_CONFIGURED',
      statusCode: 503,
    })
  }

  const voiceId = String(input.voiceId || '').trim()
  if (!voiceId) {
    throw new VoiceModuleError('Selecione uma voz antes de ouvir o preview.', {
      code: 'VOICE_ID_REQUIRED',
      statusCode: 400,
    })
  }

  const startedAt = Date.now()
  const previewText = sanitizePreviewText(input.text)
  const audioBuffer = await provider.generatePreview({
    text: previewText,
    voiceId,
    modelId: input.modelId,
    stability: input.stability,
    similarityBoost: input.similarityBoost,
    style: input.style,
    speed: input.speed,
    useSpeakerBoost: input.useSpeakerBoost,
  })

  logger.info('[voice.preview] Preview gerado', {
    voiceId,
    durationMs: Date.now() - startedAt,
    characters: previewText.length,
  })

  return {
    buffer: audioBuffer,
    mimeType: 'audio/mpeg',
    fileExtension: 'mp3',
    provider: 'elevenlabs',
    voiceId,
    voiceName: null,
    modelId: input.modelId || null,
    channel: 'preview',
    convertedForChannel: false,
  }
}
