import OpenAI, { toFile } from 'openai'
import logger from '../../../lib/logger'
import { VoiceModuleError } from '../types/voice.types'

// Para ligacoes, whisper-1 costuma ser mais estavel que modelos transcribe mais novos em PT-BR curto/ruidoso.
// Ainda permite override explicito por VOICE_CALL_TRANSCRIPTION_MODEL.
const DEFAULT_TRANSCRIPTION_MODEL = 'whisper-1'

function getOpenAiKey(): string {
  return String(process.env.OPENAI_API_KEY || '').trim()
}

function getOpenAiTimeoutMs(): number {
  const parsed = parseInt(process.env.VOICE_CALL_STT_TIMEOUT_MS || '15000', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15000
}

function getOpenAiMaxRetries(): number {
  const parsed = parseInt(process.env.VOICE_CALL_STT_MAX_RETRIES || '0', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export async function transcribeVoiceCallAudio(input: {
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

  if (!input.audio.length) {
    return ''
  }

  const client = new OpenAI({
    apiKey,
    timeout: getOpenAiTimeoutMs(),
    maxRetries: getOpenAiMaxRetries(),
  })
  const startedAt = Date.now()
  const model = process.env.VOICE_CALL_TRANSCRIPTION_MODEL || DEFAULT_TRANSCRIPTION_MODEL

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
      bytes: input.audio.length,
      durationMs: Date.now() - startedAt,
      model,
      hasText: Boolean(text),
    })

    return text
  } catch (error: any) {
    logger.warn('[voice.transcription] Falha ao transcrever audio da ligacao', {
      bytes: input.audio.length,
      durationMs: Date.now() - startedAt,
      model,
      timeoutMs: getOpenAiTimeoutMs(),
      maxRetries: getOpenAiMaxRetries(),
      errorName: error?.name || null,
      errorCode: error?.code || error?.status || null,
      errorMessage: error?.message || String(error),
      cause: error?.cause?.message || null,
    })
    throw error
  }
}
