import logger from '../../../lib/logger'
import { ElevenLabsProvider } from '../providers/elevenlabs.provider'
import {
  getStoredAgentVoiceProfile,
} from './voiceProfile.service'
import {
  getMimeTypeForChannel,
  toWhatsAppVoiceMessage,
} from './audioConversion.service'
import {
  type GeneratedVoiceAudio,
  type VoiceGenerationInput,
  type VoiceProfileRecord,
  VoiceModuleError,
} from '../types/voice.types'

const provider = new ElevenLabsProvider()
const MAX_GENERATION_TEXT_LENGTH = 2000

function sanitizeGenerationText(text: unknown): string {
  const normalized = String(text || '')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized.slice(0, MAX_GENERATION_TEXT_LENGTH)
}

function resolveVoiceConfiguration(
  input: VoiceGenerationInput,
  profile: VoiceProfileRecord | null
): VoiceProfileRecord | null {
  if (input.voiceId) {
    return {
      id: profile?.id || 'ephemeral',
      agentId: input.agentId,
      provider: 'elevenlabs',
      voiceId: input.voiceId,
      voiceName: input.voiceName ?? profile?.voiceName ?? null,
      modelId: input.modelId ?? profile?.modelId ?? null,
      stability: input.stability ?? profile?.stability ?? null,
      similarityBoost: input.similarityBoost ?? profile?.similarityBoost ?? null,
      style: input.style ?? profile?.style ?? null,
      speed: input.speed ?? profile?.speed ?? null,
      useSpeakerBoost: input.useSpeakerBoost ?? profile?.useSpeakerBoost ?? true,
      previewText: profile?.previewText ?? null,
      enabled: profile?.enabled ?? true,
      callsEnabled: profile?.callsEnabled ?? false,
      createdAt: profile?.createdAt || new Date().toISOString(),
      updatedAt: profile?.updatedAt || new Date().toISOString(),
    }
  }

  return profile
}

export async function generateVoiceResponse(input: VoiceGenerationInput): Promise<GeneratedVoiceAudio> {
  if (!provider.isConfigured()) {
    throw new VoiceModuleError('ElevenLabs nao configurado no backend.', {
      code: 'VOICE_PROVIDER_NOT_CONFIGURED',
      statusCode: 503,
    })
  }

  const normalizedText = sanitizeGenerationText(input.text)
  if (!normalizedText) {
    throw new VoiceModuleError('Texto vazio para geracao de audio.', {
      code: 'VOICE_TEXT_REQUIRED',
      statusCode: 400,
    })
  }

  const storedProfile = await getStoredAgentVoiceProfile(input.agentId)
  const effectiveProfile = resolveVoiceConfiguration(input, storedProfile)

  if (!effectiveProfile || !effectiveProfile.enabled) {
    throw new VoiceModuleError('O agente nao possui voz habilitada.', {
      code: 'VOICE_PROFILE_DISABLED',
      statusCode: 409,
    })
  }

  const startedAt = Date.now()
  const baseAudioBuffer = await provider.generateSpeech({
    text: normalizedText,
    voiceId: effectiveProfile.voiceId,
    modelId: effectiveProfile.modelId,
    stability: effectiveProfile.stability ?? undefined,
    similarityBoost: effectiveProfile.similarityBoost ?? undefined,
    style: effectiveProfile.style ?? undefined,
    speed: effectiveProfile.speed ?? undefined,
    useSpeakerBoost: effectiveProfile.useSpeakerBoost,
  })

  let audio: GeneratedVoiceAudio = {
    buffer: baseAudioBuffer,
    mimeType: 'audio/mpeg',
    fileExtension: 'mp3',
    provider: effectiveProfile.provider,
    voiceId: effectiveProfile.voiceId,
    voiceName: effectiveProfile.voiceName,
    modelId: effectiveProfile.modelId,
    channel: input.channel,
    convertedForChannel: false,
  }

  if (input.channel === 'whatsapp_audio' || input.channel === 'whatsapp_call') {
    audio = await toWhatsAppVoiceMessage(audio)
  } else {
    audio.mimeType = getMimeTypeForChannel(input.channel)
  }

  logger.info('[voice.generation] Audio final gerado', {
    agentId: input.agentId,
    channel: input.channel,
    voiceId: effectiveProfile.voiceId,
    durationMs: Date.now() - startedAt,
    bytes: audio.buffer.length,
    convertedForChannel: audio.convertedForChannel,
  })

  try {
    const { saveSystemLog } = await import('../../../services/system-logs')
    await saveSystemLog({
      agent_id: input.agentId,
      companies_id: undefined,
      log_type: 'agent_voice_generation_success',
      level: 'info',
      message: 'Audio do agente gerado com sucesso.',
      metadata: {
        channel: input.channel,
        voice_id: effectiveProfile.voiceId,
        model_id: effectiveProfile.modelId,
        speed: effectiveProfile.speed,
        converted_for_channel: audio.convertedForChannel,
      },
      impact_level: 'low',
    })
  } catch (logError: any) {
    logger.warn('[voice.generation] Falha ao salvar log de sucesso', {
      agentId: input.agentId,
      error: logError?.message,
    })
  }

  return audio
}

export async function tryGenerateVoiceResponse(input: VoiceGenerationInput): Promise<GeneratedVoiceAudio | null> {
  try {
    return await generateVoiceResponse(input)
  } catch (error: any) {
    logger.warn('[voice.generation] Falha ao gerar audio; fluxo pode fazer fallback para texto', {
      agentId: input.agentId,
      channel: input.channel,
      error: error?.message,
    })

    try {
      const { saveSystemLog } = await import('../../../services/system-logs')
      await saveSystemLog({
        agent_id: input.agentId,
        log_type: 'agent_voice_generation_failed',
        level: 'warn',
        message: 'Falha ao gerar audio do agente; fallback para texto acionado.',
        metadata: {
          channel: input.channel,
          error: error?.message || 'Erro desconhecido',
        },
        impact_level: 'medium',
      })
    } catch (logError: any) {
      logger.warn('[voice.generation] Falha ao salvar log de erro', {
        agentId: input.agentId,
        error: logError?.message,
      })
    }

    return null
  }
}
