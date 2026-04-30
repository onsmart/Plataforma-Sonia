import OpenAI, { toFile } from 'openai'
import logger from '../../../lib/logger'
import { VoiceModuleError } from '../types/voice.types'

const DEFAULT_TRANSCRIPTION_MODEL = 'whisper-1'

function getOpenAiKey(): string {
  return String(process.env.OPENAI_API_KEY || '').trim()
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

  const client = new OpenAI({ apiKey })
  const startedAt = Date.now()
  const file = await toFile(input.audio, input.filename || 'voice-call.wav', {
    type: input.mimeType,
  })

  const response = await client.audio.transcriptions.create({
    file,
    model: process.env.VOICE_CALL_TRANSCRIPTION_MODEL || DEFAULT_TRANSCRIPTION_MODEL,
    language: input.language || 'pt',
    response_format: 'json',
  })

  const text = String((response as any)?.text || '').trim()
  logger.info('[voice.transcription] Audio da ligacao transcrito', {
    bytes: input.audio.length,
    durationMs: Date.now() - startedAt,
    hasText: Boolean(text),
  })

  return text
}
