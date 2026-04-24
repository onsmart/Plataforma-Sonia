import logger from '../../../lib/logger'
import { ElevenLabsProvider } from '../providers/elevenlabs.provider'
import { type VoiceCatalogItem, VoiceModuleError } from '../types/voice.types'

const provider = new ElevenLabsProvider()

export async function listElevenLabsVoices(): Promise<VoiceCatalogItem[]> {
  if (!provider.isConfigured()) {
    throw new VoiceModuleError('ElevenLabs nao configurado no backend.', {
      code: 'VOICE_PROVIDER_NOT_CONFIGURED',
      statusCode: 503,
    })
  }

  const startedAt = Date.now()
  const voices = await provider.listVoices()
  const normalized = voices
    .map((voice) => ({
      voiceId: String(voice.voice_id || '').trim(),
      name: String(voice.name || '').trim() || 'Sem nome',
      category: voice.category ? String(voice.category).trim() : null,
      labels:
        voice.labels && typeof voice.labels === 'object' && !Array.isArray(voice.labels)
          ? Object.fromEntries(
              Object.entries(voice.labels).map(([key, value]) => [String(key), String(value || '')])
            )
          : {},
      previewUrl: voice.preview_url ? String(voice.preview_url).trim() : null,
      description: voice.description ? String(voice.description).trim() : null,
    }))
    .filter((voice) => voice.voiceId)
    .sort((left, right) => left.name.localeCompare(right.name))

  logger.info('[voice.catalog] Vozes listadas na ElevenLabs', {
    count: normalized.length,
    durationMs: Date.now() - startedAt,
  })

  return normalized
}
