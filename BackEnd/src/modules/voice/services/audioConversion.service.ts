import { spawn } from 'child_process'
import logger from '../../../lib/logger'
import { type GeneratedVoiceAudio, type VoiceChannel, VoiceModuleError } from '../types/voice.types'

function runFfmpeg(inputBuffer: Buffer, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const chunks: Buffer[] = []
    let stderr = ''

    ffmpeg.stdout.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })

    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    ffmpeg.on('error', (error) => {
      reject(error)
    })

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks))
        return
      }

      reject(new Error(stderr || `ffmpeg finalizou com codigo ${code}`))
    })

    ffmpeg.stdin.write(inputBuffer)
    ffmpeg.stdin.end()
  })
}

export async function toOggOpus(inputBuffer: Buffer): Promise<Buffer> {
  try {
    return await runFfmpeg(inputBuffer, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      'pipe:0',
      '-c:a',
      'libopus',
      '-b:a',
      '32k',
      '-f',
      'ogg',
      'pipe:1',
    ])
  } catch (error: any) {
    logger.warn('[voice.audio-conversion] Conversao para ogg/opus indisponivel', {
      error: error?.message,
    })
    throw new VoiceModuleError('Conversao de audio para WhatsApp indisponivel. Instale ffmpeg no ambiente.', {
      code: 'VOICE_CONVERSION_FAILED',
      statusCode: 503,
      cause: error,
    })
  }
}

export function getMimeTypeForChannel(channel: VoiceChannel): string {
  if (channel === 'whatsapp_audio' || channel === 'whatsapp_call') {
    return 'audio/ogg'
  }

  return 'audio/mpeg'
}

export async function toWhatsAppVoiceMessage(audio: GeneratedVoiceAudio): Promise<GeneratedVoiceAudio> {
  const convertedBuffer = await toOggOpus(audio.buffer)

  return {
    ...audio,
    buffer: convertedBuffer,
    mimeType: 'audio/ogg',
    fileExtension: 'ogg',
    convertedForChannel: true,
  }
}
