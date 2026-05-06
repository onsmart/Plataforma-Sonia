import OpenAI, { toFile } from 'openai'
import logger from '../../../lib/logger'
import { VoiceModuleError } from '../types/voice.types'

const OPENAI_DEFAULT_TRANSCRIPTION_MODEL = 'whisper-1'
const ELEVENLABS_DEFAULT_TRANSCRIPTION_MODEL = 'scribe_v2'
const ELEVENLABS_STT_API_BASE_URL = 'https://api.elevenlabs.io/v1'

type VoiceSttProvider = 'openai' | 'elevenlabs'

function getVoiceSttProvider(): VoiceSttProvider {
  const raw = String(process.env.VOICE_CALL_STT_PROVIDER || '').trim().toLowerCase()
  return raw === 'elevenlabs' ? 'elevenlabs' : 'openai'
}

function getOpenAiKey(): string {
  return String(process.env.OPENAI_API_KEY || '').trim()
}

function getElevenLabsKey(): string {
  return String(process.env.ELEVENLABS_API_KEY || '').trim()
}

function getSttTimeoutMs(): number {
  const parsed = parseInt(process.env.VOICE_CALL_STT_TIMEOUT_MS || '15000', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15000
}

function getSttMaxRetries(): number {
  const parsed = parseInt(process.env.VOICE_CALL_STT_MAX_RETRIES || '0', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function getOpenAiTranscriptionModel(): string {
  return String(process.env.VOICE_CALL_TRANSCRIPTION_MODEL || OPENAI_DEFAULT_TRANSCRIPTION_MODEL).trim()
}

function getElevenLabsTranscriptionModel(): string {
  const configured = String(process.env.VOICE_CALL_ELEVENLABS_TRANSCRIPTION_MODEL || '').trim()
  if (configured) {
    return configured
  }

  const legacy = String(process.env.VOICE_CALL_TRANSCRIPTION_MODEL || '').trim()
  if (legacy && legacy !== OPENAI_DEFAULT_TRANSCRIPTION_MODEL) {
    return legacy
  }

  return ELEVENLABS_DEFAULT_TRANSCRIPTION_MODEL
}

async function transcribeWithOpenAi(input: {
  audio: Buffer
  mimeType: string
  filename?: string
  language?: string
}): Promise<string> {
  const apiKey = getOpenAiKey()
  if (!apiKey) {
    throw new VoiceModuleError('OpenAI nao configurado para transcricao de ligacoes.', {
      code: 'VOICE_STT_PROVIDER_NOT_CONFIGURED',
      statusCode: 503,
    })
  }

  const client = new OpenAI({
    apiKey,
    timeout: getSttTimeoutMs(),
    maxRetries: getSttMaxRetries(),
  })
  const startedAt = Date.now()
  const model = getOpenAiTranscriptionModel()

  try {
    const file = await toFile(input.audio, input.filename || 'voice-call.wav', {
      type: input.mimeType,
    })

    const response = await client.audio.transcriptions.create({
      file,
      model,
      language: input.language || 'pt',
      response_format: 'json',
    })

    const text = String((response as any)?.text || '').trim()
    logger.info('[voice.transcription] Audio da ligacao transcrito', {
      provider: 'openai',
      bytes: input.audio.length,
      durationMs: Date.now() - startedAt,
      model,
      hasText: Boolean(text),
    })

    return text
  } catch (error: any) {
    logger.warn('[voice.transcription] Falha ao transcrever audio da ligacao', {
      provider: 'openai',
      bytes: input.audio.length,
      durationMs: Date.now() - startedAt,
      model,
      timeoutMs: getSttTimeoutMs(),
      maxRetries: getSttMaxRetries(),
      errorName: error?.name || null,
      errorCode: error?.code || error?.status || null,
      errorMessage: error?.message || String(error),
      cause: error?.cause?.message || null,
    })
    throw error
  }
}

async function transcribeWithElevenLabs(input: {
  audio: Buffer
  mimeType: string
  filename?: string
  language?: string
}): Promise<string> {
  const apiKey = getElevenLabsKey()
  if (!apiKey) {
    throw new VoiceModuleError('ElevenLabs nao configurado para transcricao de ligacoes.', {
      code: 'VOICE_STT_PROVIDER_NOT_CONFIGURED',
      statusCode: 503,
    })
  }

  const startedAt = Date.now()
  const model = getElevenLabsTranscriptionModel()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), getSttTimeoutMs())

  try {
    const formData = new FormData()
    const blobPayload = Uint8Array.from(input.audio)
    const blob = new Blob([blobPayload], { type: input.mimeType || 'audio/wav' })
    formData.append('model_id', model)
    formData.append('file', blob, input.filename || 'voice-call.wav')
    if (input.language) {
      formData.append('language_code', input.language)
    }

    const response = await fetch(`${ELEVENLABS_STT_API_BASE_URL}/speech-to-text`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: formData,
      signal: controller.signal,
    })

    let payload: any = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    if (!response.ok) {
      throw new VoiceModuleError('ElevenLabs retornou erro na transcricao da ligacao.', {
        code: 'ELEVENLABS_STT_API_ERROR',
        statusCode: response.status === 401 || response.status === 403 ? 503 : 502,
        cause: payload || response.statusText,
      })
    }

    const text = String(payload?.text || '').trim()
    logger.info('[voice.transcription] Audio da ligacao transcrito', {
      provider: 'elevenlabs',
      bytes: input.audio.length,
      durationMs: Date.now() - startedAt,
      model,
      hasText: Boolean(text),
    })

    return text
  } catch (error: any) {
    logger.warn('[voice.transcription] Falha ao transcrever audio da ligacao', {
      provider: 'elevenlabs',
      bytes: input.audio.length,
      durationMs: Date.now() - startedAt,
      model,
      timeoutMs: getSttTimeoutMs(),
      maxRetries: 0,
      errorName: error?.name || null,
      errorCode: error?.code || error?.statusCode || error?.status || null,
      errorMessage: error?.message || String(error),
      cause:
        error?.cause && typeof error.cause === 'object'
          ? JSON.stringify(error.cause)
          : error?.cause?.message || error?.cause || null,
    })
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function transcribeVoiceCallAudio(input: {
  audio: Buffer
  mimeType: string
  filename?: string
  language?: string
}): Promise<string> {
  if (!input.audio.length) {
    return ''
  }

  if (getVoiceSttProvider() === 'elevenlabs') {
    return transcribeWithElevenLabs(input)
  }

  return transcribeWithOpenAi(input)
}
