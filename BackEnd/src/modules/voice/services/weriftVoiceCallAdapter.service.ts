import {
  MediaStreamTrack,
  RTCPeerConnection,
  type RTCIceServer,
  RtpHeader,
  type RtpPacket,
  RtpPacket as WeriftRtpPacket,
} from 'werift'
import OpusScript = require('opusscript')
import logger from '../../../lib/logger'
import { chatWithAgent } from '../../../services/agents/chatwithAgent'
import { audioToPcm16, pcm16ToWav } from './audioConversion.service'
import { generateVoiceResponse } from './voiceGeneration.service'
import { transcribeVoiceCallAudio } from './voiceTranscription.service'
import {
  type PreparedVoiceCallSession,
  type VoiceCallSession,
} from '../types/voice.types'

const SAMPLE_RATE = 48000
const CHANNELS = 1
const FRAME_DURATION_MS = 20
const FRAME_SIZE = SAMPLE_RATE * FRAME_DURATION_MS / 1000
const BYTES_PER_SAMPLE = 2
/** Minimo antes de poder fechar um turno (pacotes RTP ~20ms). 70~1.4s cortava perguntas longas. */
const MIN_UTTERANCE_PACKETS = getPositiveIntEnv('VOICE_CALL_MIN_UTTERANCE_PACKETS', 100, 10)
/** Teto antes de forcar transcricao (~6.4s de fala continua neste buffer). */
const MAX_UTTERANCE_PACKETS = Math.max(
  getPositiveIntEnv('VOICE_CALL_MAX_UTTERANCE_PACKETS', 320, MIN_UTTERANCE_PACKETS),
  MIN_UTTERANCE_PACKETS
)
/** Checagem backup do endpoint de silencio (debounce principal agenda na chegada do RTP). */
const FLUSH_INTERVAL_MS = getPositiveIntEnv('VOICE_CALL_FLUSH_INTERVAL_MS', 180, 80)
/** Sem novos pacotes decodificados por este tempo = fim provavel da frase; evita flush no meio da fala. */
const ENDPOINT_SILENCE_MS = getPositiveIntEnv('VOICE_CALL_ENDPOINT_SILENCE_MS', 900, 300)
/** Abaixo disso descarta-se o trecho (ruído). 60 cortava fala válida (~45–55 RMS) em alguns microfones. */
const MIN_PCM_RMS = getPositiveIntEnv('VOICE_CALL_MIN_PCM_RMS', 45, 0)
/** Fluxo RTP em silencio no overflow antes diluía o RMS; frames abaixo disso são ignorados. 0 desliga. */
const OVERFLOW_FRAME_MIN_RMS = Number.parseFloat(
  String(process.env.VOICE_CALL_OVERFLOW_FRAME_MIN_RMS ?? '28').trim()
)
const OVERFLOW_GATE_RMS =
  Number.isFinite(OVERFLOW_FRAME_MIN_RMS) && OVERFLOW_FRAME_MIN_RMS >= 0
    ? OVERFLOW_FRAME_MIN_RMS
    : 28

/** Quadros mais silenciosos que este limite são removidos do início/fim antes do RMS global. 0 desliga. */
const EDGE_TRIM_SILENT_MAX_RMS = Number.parseFloat(
  String(process.env.VOICE_CALL_PCM_EDGE_TRIM_MAX_RMS ?? '30').trim()
)
const EDGE_TRIM_RMS =
  Number.isFinite(EDGE_TRIM_SILENT_MAX_RMS) && EDGE_TRIM_SILENT_MAX_RMS >= 0
    ? EDGE_TRIM_SILENT_MAX_RMS
    : 30

const TRANSCRIPTION_FAILURE_COOLDOWN_MS = getPositiveIntEnv('VOICE_CALL_STT_FAILURE_COOLDOWN_MS', 5000, 0)
const POST_AGENT_INBOUND_SILENCE_MS = getPositiveIntEnv('VOICE_CALL_POST_AGENT_COOLDOWN_MS', 450, 0)
/** Um quadro Opus @ 48kHz = 20ms; manter alinhado ao FRAME_SIZE. */
const OUTBOUND_PACKET_INTERVAL_MS = Math.round((FRAME_SIZE / SAMPLE_RATE) * 1000)
/**
 * Se o envio atrasar mais que isto em relacao ao relogio de parede, realinha o pacer
 * (evita rajadas que soam roboticas / microcortes no WhatsApp).
 */
const RTP_PACER_MAX_LAG_MS = getPositiveIntEnv('VOICE_CALL_RTP_PACER_MAX_LAG_MS', 120, 40)
/** Bitrate Opus outbound (VOIP). 32k e seguro; 48k–64k costuma soar mais estavel em telefonia. */
const OUTBOUND_OPUS_BITRATE = Math.min(
  128000,
  Math.max(getPositiveIntEnv('VOICE_CALL_OPUS_OUT_BITRATE', 48000, 16000), 16000)
)
const VOICE_VERBOSE_LOGS = ['1', 'true', 'yes'].includes(String(process.env.VOICE_CALL_VERBOSE_LOGS || '').trim().toLowerCase())
const initialGreetingPcmCache = new Map<string, Buffer>()

function parseVoiceCallElevenLabsLatencyOpt(): number | undefined {
  const raw = String(process.env.VOICE_CALL_ELEVENLABS_LATENCY_OPT || '').trim()
  if (!raw) {
    return undefined
  }
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0 || n > 4) {
    return undefined
  }
  return n
}

const VOICE_CALL_ELEVENLABS_LATENCY_OPT = parseVoiceCallElevenLabsLatencyOpt()

function elevenLabsCallOpts(): { optimizeStreamingLatency: number } | Record<string, never> {
  return VOICE_CALL_ELEVENLABS_LATENCY_OPT !== undefined
    ? { optimizeStreamingLatency: VOICE_CALL_ELEVENLABS_LATENCY_OPT }
    : {}
}

type ActiveWeriftSession = {
  peer: RTCPeerConnection
  localAudioTrack: MediaStreamTrack
  startedAt: string
  inboundPackets: number
  inboundBytes: number
  audioPipeline: VoiceCallAudioPipeline
}

function parseIceServers(): RTCIceServer[] {
  const rawJson = String(process.env.VOICE_CALL_ICE_SERVERS_JSON || '').trim()
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson)
      if (Array.isArray(parsed)) {
        return parsed as RTCIceServer[]
      }
    } catch (error: any) {
      logger.warn('[voice.werift] VOICE_CALL_ICE_SERVERS_JSON invalido; usando STUN padrao', {
        error: error?.message,
      })
    }
  }

  const rawUrls = String(process.env.VOICE_CALL_ICE_SERVER_URLS || '').trim()
  if (rawUrls) {
    const urls = rawUrls
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean)

    if (urls.length > 0) {
      return urls.map((url) => ({ urls: url }))
    }
  }

  return [{ urls: 'stun:stun.l.google.com:19302' }]
}

function getSessionKey(session: VoiceCallSession): string {
  return String(session.callId || session.sessionId || '').trim()
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getPositiveIntEnv(name: string, fallback: number, minValue = 1): number {
  const parsed = parseInt(process.env[name] || String(fallback), 10)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.max(parsed, minValue)
}

function getInitialGreetingText(): string {
  return String(process.env.VOICE_CALL_INITIAL_GREETING_TEXT || 'Ola, eu sou a Sonia. Pode falar comigo.').trim()
}

function redactedText(value: unknown): string {
  const normalized = String(value || '').trim()
  return normalized ? `[redacted chars=${normalized.length}]` : ''
}

function formatDurationMs(durationMs: number | undefined): string {
  const safe = Number.isFinite(durationMs) ? Number(durationMs) : 0
  return `${safe.toFixed(0)}ms`
}

function formatVoiceTurnTimingBlock(input: {
  callId: string
  agentId: string
  transcriptChars?: number
  replyChars?: number
  timings: Record<string, number>
}): string {
  const labels: Array<[string, string]> = [
    ['wavEncodingMs', 'WAV encode'],
    ['transcriptionMs', 'STT'],
    ['agentFormulationMs', 'Agente'],
    ['speechGenerationMs', 'TTS'],
    ['outboundPcmMs', 'PCM'],
    ['rtpSendMs', 'RTP envio'],
  ]
  const slowest = labels
    .map(([key]) => [key, input.timings[key] || 0] as const)
    .sort((a, b) => b[1] - a[1])[0]?.[0]

  const lines = labels.map(([key, label]) => {
    const marker = key === slowest ? ' << gargalo' : ''
    return `  ${label.padEnd(14, '.')} ${formatDurationMs(input.timings[key])}${marker}`
  })

  return [
    '╔════════════════════════════════════════════════════╗',
    '║ TURNO DE VOZ FINALIZADO                           ║',
    '╠════════════════════════════════════════════════════╣',
    `║ CallId: ${String(input.callId).slice(0, 42).padEnd(42, ' ')} ║`,
    `║ Agent : ${String(input.agentId).slice(0, 42).padEnd(42, ' ')} ║`,
    `║ User  : ${String(input.transcriptChars ?? 0)} chars`.padEnd(51, ' ') + '║',
    `║ Reply : ${String(input.replyChars ?? 0)} chars`.padEnd(51, ' ') + '║',
    `║ Total : ${formatDurationMs(input.timings.totalTurnMs)}`.padEnd(51, ' ') + '║',
    '╠════════════════════════════════════════════════════╣',
    ...lines.map((line) => `║ ${line.padEnd(48, ' ')} ║`),
    '╚════════════════════════════════════════════════════╝',
  ].join('\n')
}

function formatGreetingTimingBlock(input: {
  callId: string
  agentId: string
  cached: boolean
  totalDurationMs: number
}): string {
  return [
    '╔════════════════════════════════════════════════════╗',
    '║ SAUDACAO INICIAL                                  ║',
    '╠════════════════════════════════════════════════════╣',
    `║ CallId: ${String(input.callId).slice(0, 42).padEnd(42, ' ')} ║`,
    `║ Agent : ${String(input.agentId).slice(0, 42).padEnd(42, ' ')} ║`,
    `║ Cache : ${String(input.cached ? 'hit' : 'miss')}`.padEnd(51, ' ') + '║',
    `║ Total : ${formatDurationMs(input.totalDurationMs)}`.padEnd(51, ' ') + '║',
    '╚════════════════════════════════════════════════════╝',
  ].join('\n')
}

function computePcm16Rms(pcm: Buffer): number {
  if (pcm.length < BYTES_PER_SAMPLE) {
    return 0
  }

  let sumSquares = 0
  let samples = 0

  for (let offset = 0; offset + 1 < pcm.length; offset += BYTES_PER_SAMPLE) {
    const sample = pcm.readInt16LE(offset)
    sumSquares += sample * sample
    samples += 1
  }

  return samples > 0 ? Math.sqrt(sumSquares / samples) : 0
}

const PCM_FRAME_BYTES = FRAME_SIZE * BYTES_PER_SAMPLE * CHANNELS

function trimPcm16SilentEdges(pcm: Buffer, frameBytes: number, maxQuietWindowRms: number): Buffer {
  if (!pcm.length || frameBytes <= 0 || maxQuietWindowRms <= 0) {
    return pcm
  }

  let startIdx = 0
  while (startIdx + frameBytes <= pcm.length) {
    const rms = computePcm16Rms(pcm.subarray(startIdx, startIdx + frameBytes))
    if (rms >= maxQuietWindowRms) break
    startIdx += frameBytes
  }

  let endIdx = pcm.length
  while (endIdx - frameBytes >= startIdx) {
    const rms = computePcm16Rms(pcm.subarray(endIdx - frameBytes, endIdx))
    if (rms >= maxQuietWindowRms) break
    endIdx -= frameBytes
  }

  if (endIdx <= startIdx) {
    return Buffer.alloc(0)
  }
  return pcm.subarray(startIdx, endIdx)
}

/** RMS global baixo: ainda transcreve se algum quadro ~20 ms tiver energia clara (evita descartar fala apos muito RTP vazio). */
function pcmHasStrongWindowAbove(
  pcm: Buffer,
  frameBytes: number,
  minWindowRms: number,
  maxWindows = 520
): boolean {
  if (!pcm.length || frameBytes <= 0 || minWindowRms <= 0) {
    return false
  }
  let scanned = 0
  let maxPeak = 0

  for (let offset = 0; offset + frameBytes <= pcm.length && scanned < maxWindows; offset += frameBytes) {
    const rms = computePcm16Rms(pcm.subarray(offset, offset + frameBytes))
    if (rms > maxPeak) maxPeak = rms
    if (rms >= minWindowRms) return true
    scanned += 1
  }
  return maxPeak >= minWindowRms * 0.85
}

function approximatePacketCountFromByteLength(totalBytes: number, frameBytes: number): number {
  if (!frameBytes) return 0
  return Math.max(1, Math.ceil(totalBytes / frameBytes))
}

class VoiceCallAudioPipeline {
  private readonly decoder = new OpusScript(SAMPLE_RATE, CHANNELS, OpusScript.Application.VOIP)
  private readonly encoder = new OpusScript(SAMPLE_RATE, CHANNELS, OpusScript.Application.VOIP)
  private readonly pcmChunks: Buffer[] = []
  private packetCount = 0
  private decodeFailures = 0
  private ignoredPayloadBytes = 0
  private transcriptionUnavailable = false
  private notifiedTranscriptionUnavailable = false
  private nextTranscriptionAttemptAt = 0
  private ignoreInboundUntil = 0
  private processing = false
  private speaking = false
  private closed = false
  /** Ultimo momento em que entrou PCM decodificado (buffer principal ou overflow). */
  private lastInboundDecodedAt = 0
  /** Audio do usuario gravado enquanto o agente fala sintese (half-duplex antigo jogava fora). */
  private overflowPcmChunks: Buffer[] = []
  private lastMinSpeechLogAt = 0
  private readonly callTurns: Array<{ user: string; assistant: string }> = []
  private sequenceNumber = Math.floor(Math.random() * 0xffff)
  private timestamp = Math.floor(Math.random() * 0xffffffff)
  private endpointSilenceDebounceTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly session: VoiceCallSession,
    private readonly localAudioTrack: MediaStreamTrack
  ) {
    this.encoder.setBitrate(OUTBOUND_OPUS_BITRATE)
  }

  private clearEndpointSilenceDebounce(): void {
    if (this.endpointSilenceDebounceTimer !== null) {
      clearTimeout(this.endpointSilenceDebounceTimer)
      this.endpointSilenceDebounceTimer = null
    }
  }

  /**
   * Apos cada pacote de fala valido no buffer principal (nao-overflow), programa checagem
   * assim que cessar RTP por ENDPOINT_SILENCE_MS — evita atrasar ate o proximo tick do interval.
   */
  private armEndpointSilenceDebounce(): void {
    this.clearEndpointSilenceDebounce()
    if (
      this.closed ||
      this.transcriptionUnavailable ||
      Date.now() < this.ignoreInboundUntil ||
      this.processing ||
      this.speaking ||
      this.packetCount < MIN_UTTERANCE_PACKETS ||
      ENDPOINT_SILENCE_MS <= 0
    ) {
      return
    }

    this.endpointSilenceDebounceTimer = setTimeout(() => {
      this.endpointSilenceDebounceTimer = null
      if (
        this.closed ||
        Date.now() < this.ignoreInboundUntil ||
        this.processing ||
        this.speaking ||
        this.packetCount < MIN_UTTERANCE_PACKETS
      ) {
        return
      }
      const idleMs = Date.now() - this.lastInboundDecodedAt
      if (idleMs + 25 < ENDPOINT_SILENCE_MS) {
        return
      }
      void this.flushUtterance('endpoint_silence')
    }, ENDPOINT_SILENCE_MS)
  }

  handleInboundRtp(rtp: RtpPacket): void {
    if (this.closed) {
      return
    }

    const nowMs = Date.now()
    if (nowMs < this.ignoreInboundUntil) {
      return
    }

    if (!rtp.payload.length) {
      return
    }

    /** Durante sintese/processamento principal, guarda entrada para nao perder o restante da frase */
    const bufferOverflow = this.speaking || this.processing
    try {
      const decoded = this.decoder.decode(rtp.payload)
      if (decoded.length > 0) {
        const nowDecoded = Date.now()
        if (bufferOverflow) {
          const frameRms = computePcm16Rms(decoded)
          const passesGate = OVERFLOW_GATE_RMS <= 0 || frameRms >= OVERFLOW_GATE_RMS
          if (passesGate) {
            this.overflowPcmChunks.push(decoded)
            while (this.overflowPcmChunks.length > MAX_UTTERANCE_PACKETS + 50) {
              this.overflowPcmChunks.shift()
            }
          }
        } else {
          this.pcmChunks.push(decoded)
          this.packetCount += 1
        }
        this.lastInboundDecodedAt = nowDecoded
        if (VOICE_VERBOSE_LOGS && !bufferOverflow && (this.packetCount === 1 || this.packetCount % 100 === 0)) {
          logger.info('[voice.werift] Audio Opus decodificado da chamada', {
            callId: this.session.callId || this.session.sessionId,
            agentId: this.session.agentId,
            decodedPackets: this.packetCount,
            pcmBytes: this.pcmChunks.reduce((total, chunk) => total + chunk.length, 0),
            ignoredPayloadBytes: this.ignoredPayloadBytes,
            decodeFailures: this.decodeFailures,
          })
        }
        if (!bufferOverflow) {
          this.armEndpointSilenceDebounce()
        }
      } else {
        this.ignoredPayloadBytes += rtp.payload.length
      }
    } catch (error: any) {
      this.decodeFailures += 1
      this.ignoredPayloadBytes += rtp.payload.length
      if (this.decodeFailures === 1 || this.decodeFailures % 100 === 0) {
        logger.warn('[voice.werift] Pacote Opus ignorado', {
          callId: this.session.callId || this.session.sessionId,
          agentId: this.session.agentId,
          decodeFailures: this.decodeFailures,
          payloadBytes: rtp.payload.length,
          error: error?.message,
        })
      }
    }

    if (!bufferOverflow && this.packetCount >= MAX_UTTERANCE_PACKETS) {
      void this.flushUtterance('max_packets')
    }
  }

  private mergeOverflowIntoMainBuffer(): void {
    if (this.closed || this.overflowPcmChunks.length === 0) {
      return
    }

    const payloadRaw = Buffer.concat(this.overflowPcmChunks)
    const rawFrames = this.overflowPcmChunks.length
    this.overflowPcmChunks = []

    let payload =
      EDGE_TRIM_RMS > 0 ? trimPcm16SilentEdges(payloadRaw, PCM_FRAME_BYTES, EDGE_TRIM_RMS) : payloadRaw

    if (payload.length === 0) {
      logger.info('[voice.werift] Overflow pos-agente só tinha silencio descartado ao anexar turno', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        rawPackets: rawFrames,
      })
      return
    }

    const approxPackets = approximatePacketCountFromByteLength(payload.length, PCM_FRAME_BYTES)

    if (this.pcmChunks.length === 0) {
      this.pcmChunks.push(payload)
    } else {
      this.pcmChunks.unshift(payload)
    }
    this.packetCount += approxPackets
    logger.info('[voice.werift] Audio do usuario durante fala do agente anexado ao proximo turno', {
      callId: this.session.callId || this.session.sessionId,
      agentId: this.session.agentId,
      rawOverflowFrames: rawFrames,
      keptPcmBytes: payload.length,
      approxPacketsAdded: approxPackets,
    })
    this.armEndpointSilenceDebounce()
  }

  private discardPendingInbound(reason: string): void {
    if (this.closed) {
      return
    }

    this.clearEndpointSilenceDebounce()
    if (!this.packetCount) {
      return
    }

    logger.info('[voice.werift] Buffer de entrada descartado (evita transcricao cortada)', {
      callId: this.session.callId || this.session.sessionId,
      agentId: this.session.agentId,
      reason,
      decodedPackets: this.packetCount,
    })

    this.consumePcm()
    this.overflowPcmChunks = []
  }

  private schedulePostAgentInboundSilence(reason: string): void {
    if (this.closed) {
      return
    }

    if (POST_AGENT_INBOUND_SILENCE_MS <= 0) {
      return
    }

    // Apos saudacao ou aviso curto: joga fora eco que pode ter ido ao buffer antes do silencio.
    // Apos resposta do LLM NAO descartamos: overflow ja foi merged e contem continuacao legitima da fala do usuario.
    if (reason === 'apos_saudacao_inicial' || reason === 'apos_aviso_stt_indisponivel') {
      this.discardPendingInbound(reason)
    }

    this.ignoreInboundUntil = Date.now() + POST_AGENT_INBOUND_SILENCE_MS

    if (VOICE_VERBOSE_LOGS) {
      logger.info('[voice.werift] Entrada ignorada ate fim da janela pos-agente', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        reason,
        ignoreMs: POST_AGENT_INBOUND_SILENCE_MS,
      })
    }
  }

  async flushIfReady(): Promise<void> {
    if (this.closed) {
      return
    }

    const nowMs = Date.now()
    if (nowMs < this.ignoreInboundUntil) {
      return
    }

    if (this.transcriptionUnavailable) {
      return
    }

    if (Date.now() < this.nextTranscriptionAttemptAt) {
      return
    }

    if (this.packetCount >= MIN_UTTERANCE_PACKETS) {
      const idleMs = Date.now() - this.lastInboundDecodedAt
      if (idleMs >= ENDPOINT_SILENCE_MS) {
        await this.flushUtterance('endpoint_silence')
        return
      }
    }

    if (this.packetCount > 0) {
      const now = Date.now()
      if (!VOICE_VERBOSE_LOGS && now - this.lastMinSpeechLogAt < 10000) {
        return
      }
      this.lastMinSpeechLogAt = now
      logger.info('[voice.werift] Aguardando fala minima para transcrever', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        decodedPackets: this.packetCount,
        minPackets: MIN_UTTERANCE_PACKETS,
      })
    }
  }

  async close(): Promise<void> {
    if (this.closed) {
      return
    }

    this.clearEndpointSilenceDebounce()
    this.closed = true
    this.decoder.delete()
    this.encoder.delete()
  }

  private consumePcm(): Buffer {
    const pcm = Buffer.concat(this.pcmChunks)
    this.pcmChunks.length = 0
    this.packetCount = 0
    this.lastInboundDecodedAt = 0
    return pcm
  }

  private async flushUtterance(reason: string): Promise<void> {
    if (this.closed) {
      return
    }

    this.clearEndpointSilenceDebounce()

    if (this.processing || this.speaking) {
      return
    }

    if (this.transcriptionUnavailable) {
      this.consumePcm()
      return
    }

    if (Date.now() < this.nextTranscriptionAttemptAt) {
      return
    }

    const pcmRaw = this.consumePcm()
    let pcm =
      EDGE_TRIM_RMS > 0 ? trimPcm16SilentEdges(pcmRaw, PCM_FRAME_BYTES, EDGE_TRIM_RMS) : pcmRaw

    if (!pcm.length) {
      logger.info('[voice.werift] Fala ignorada — buffer efetivamente vazio apos corte de bordas', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        reason,
      })
      return
    }

    const pcmRms = computePcm16Rms(pcm)
    logger.info('[voice.werift] Fala capturada para transcricao', {
      callId: this.session.callId || this.session.sessionId,
      agentId: this.session.agentId,
      reason,
      pcmBytes: pcm.length,
      pcmRms: Number(pcmRms.toFixed(2)),
    })

    if (pcm.length < FRAME_SIZE * BYTES_PER_SAMPLE * MIN_UTTERANCE_PACKETS) {
      logger.warn('[voice.werift] Fala descartada por audio insuficiente', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        pcmBytes: pcm.length,
        minBytes: FRAME_SIZE * BYTES_PER_SAMPLE * MIN_UTTERANCE_PACKETS,
      })
      return
    }

    const strongWindowFallback = pcmHasStrongWindowAbove(
      pcm,
      PCM_FRAME_BYTES,
      Math.min(MIN_PCM_RMS, 45) * 0.52
    )
    const passesEnergyGate = pcmRms >= MIN_PCM_RMS || strongWindowFallback

    if (!passesEnergyGate) {
      logger.info('[voice.werift] Audio descartado por baixa energia', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        pcmRms: Number(pcmRms.toFixed(2)),
        minPcmRms: MIN_PCM_RMS,
      })
      return
    }

    if (pcmRms < MIN_PCM_RMS && strongWindowFallback) {
      logger.info('[voice.werift] RMS medio baixo, mas ha trechos audiveis — seguindo pra transcricao', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        pcmRms: Number(pcmRms.toFixed(2)),
      })
    }

    this.processing = true
    try {
      const turnStartedAt = Date.now()
      const wav = await pcm16ToWav(pcm, {
        sampleRate: SAMPLE_RATE,
        channels: CHANNELS,
      })
      const wavReadyAt = Date.now()

      const transcript = await transcribeVoiceCallAudio({
        audio: wav,
        mimeType: 'audio/wav',
        filename: `${this.session.callId || this.session.sessionId}.wav`,
        language: 'pt',
      })
      const transcriptionReadyAt = Date.now()

      if (!transcript) {
        logger.info('[voice.werift.timing] Turno sem transcricao util', {
          callId: this.session.callId || this.session.sessionId,
          agentId: this.session.agentId,
          reason,
          timings: {
            wavEncodingMs: wavReadyAt - turnStartedAt,
            transcriptionMs: transcriptionReadyAt - wavReadyAt,
            totalTurnMs: transcriptionReadyAt - turnStartedAt,
          },
        })
        return
      }

      logger.info('[voice.werift] Fala transcrita na ligacao', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        reason,
        transcriptPreview: redactedText(transcript),
      })

      if (this.closed) {
        return
      }

      const userEmail = String(this.session.userEmail || '').trim()
      if (!userEmail) {
        logger.warn('[voice.werift] Chamada sem userEmail; nao foi possivel chamar o agente', {
          callId: this.session.callId || this.session.sessionId,
          agentId: this.session.agentId,
        })
        return
      }

      const recentHistory = this.callTurns
        .slice(-4)
        .map((turn, index) => `${index + 1}. Usuario: ${turn.user}\nAssistente: ${turn.assistant}`)
        .join('\n')
      const agentInput = recentHistory
        ? `Historico recente desta chamada:\n${recentHistory}\n\nUltima fala do usuario:\n${transcript}\n\nResponda diretamente a ultima fala, sem reiniciar a saudacao.`
        : transcript

      // voice_last_transcript: só a ultima fala (confianca/heuristicas); agentInput pode incluir historico no texto
      const reply = await chatWithAgent(userEmail, this.session.agentId, agentInput, {
        channel: 'whatsapp_call',
        call_id: this.session.callId || this.session.sessionId,
        integration_id: this.session.integrationId,
        phone_number: this.session.caller || null,
        call_turns: this.callTurns.length,
        voice_last_transcript: transcript,
      })
      const agentReplyReadyAt = Date.now()

      const replyText = String(reply || '').trim()
      if (this.closed) {
        return
      }

      if (!replyText) {
        logger.warn('[voice.werift] Agente nao retornou texto para chamada', {
          callId: this.session.callId || this.session.sessionId,
          agentId: this.session.agentId,
          transcriptPreview: redactedText(transcript),
        })
        return
      }

      const audio = await generateVoiceResponse({
        agentId: this.session.agentId,
        text: replyText,
        channel: 'web',
        ...elevenLabsCallOpts(),
      })
      const ttsReadyAt = Date.now()
      if (this.closed) {
        return
      }

      const outboundPcm = await audioToPcm16(audio.buffer, {
        sampleRate: SAMPLE_RATE,
        channels: CHANNELS,
      })
      const pcmReadyAt = Date.now()

      await this.sendPcmAsRtp(outboundPcm)
      const rtpSentAt = Date.now()
      this.schedulePostAgentInboundSilence('apos_resposta_llm')

      this.callTurns.push({ user: transcript, assistant: replyText })
      if (this.callTurns.length > 6) {
        this.callTurns.splice(0, this.callTurns.length - 6)
      }

      logger.info('[voice.werift.timing] Turno de voz concluido', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        reason,
        transcriptChars: transcript.length,
        replyChars: replyText.length,
        timings: {
          wavEncodingMs: wavReadyAt - turnStartedAt,
          transcriptionMs: transcriptionReadyAt - wavReadyAt,
          agentFormulationMs: agentReplyReadyAt - transcriptionReadyAt,
          speechGenerationMs: ttsReadyAt - agentReplyReadyAt,
          outboundPcmMs: pcmReadyAt - ttsReadyAt,
          rtpSendMs: rtpSentAt - pcmReadyAt,
          totalTurnMs: rtpSentAt - turnStartedAt,
        },
      })
      console.log(
        formatVoiceTurnTimingBlock({
          callId: String(this.session.callId || this.session.sessionId),
          agentId: this.session.agentId,
          transcriptChars: transcript.length,
          replyChars: replyText.length,
          timings: {
            wavEncodingMs: wavReadyAt - turnStartedAt,
            transcriptionMs: transcriptionReadyAt - wavReadyAt,
            agentFormulationMs: agentReplyReadyAt - transcriptionReadyAt,
            speechGenerationMs: ttsReadyAt - agentReplyReadyAt,
            outboundPcmMs: pcmReadyAt - ttsReadyAt,
            rtpSendMs: rtpSentAt - pcmReadyAt,
            totalTurnMs: rtpSentAt - turnStartedAt,
          },
        })
      )
    } catch (error: any) {
      const errorCode = String(error?.code || error?.status || '').trim().toLowerCase()
      const errorMessage = String(error?.message || error || '').toLowerCase()
      const isQuotaError = errorCode === 'insufficient_quota' || errorMessage.includes('insufficient_quota')

      if (isQuotaError) {
        this.transcriptionUnavailable = true
        await this.sendTranscriptionUnavailableNotice()
      } else if (TRANSCRIPTION_FAILURE_COOLDOWN_MS > 0) {
        this.nextTranscriptionAttemptAt = Date.now() + TRANSCRIPTION_FAILURE_COOLDOWN_MS
      }

      logger.warn('[voice.werift] Falha no pipeline de audio da ligacao', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        error: error?.message,
      })
    } finally {
      this.processing = false
    }
  }

  private async sendTranscriptionUnavailableNotice(): Promise<void> {
    if (this.closed) {
      return
    }

    if (this.notifiedTranscriptionUnavailable) {
      return
    }

    this.notifiedTranscriptionUnavailable = true

    try {
      const audio = await generateVoiceResponse({
        agentId: this.session.agentId,
        text: 'Estou com a transcricao de audio indisponivel neste momento. Por favor, tente novamente em alguns instantes.',
        channel: 'web',
        ...elevenLabsCallOpts(),
      })

      const outboundPcm = await audioToPcm16(audio.buffer, {
        sampleRate: SAMPLE_RATE,
        channels: CHANNELS,
      })

      if (this.closed) {
        return
      }

      await this.sendPcmAsRtp(outboundPcm)
      this.schedulePostAgentInboundSilence('apos_aviso_stt_indisponivel')
    } catch (noticeError: any) {
      logger.warn('[voice.werift] Falha ao avisar indisponibilidade de transcricao', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        error: noticeError?.message || String(noticeError),
      })
    }
  }

  async sendInitialGreeting(): Promise<void> {
    if (this.closed) {
      return
    }

    const greetingText = getInitialGreetingText()
    if (!greetingText) {
      return
    }

    try {
      const greetingStartedAt = Date.now()
      const cacheKey = `${this.session.agentId}:${greetingText}:${String(VOICE_CALL_ELEVENLABS_LATENCY_OPT ?? 'none')}`
      logger.info('[voice.werift] Gerando saudacao inicial da chamada', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        cached: initialGreetingPcmCache.has(cacheKey),
      })

      let outboundPcm = initialGreetingPcmCache.get(cacheKey)
      const cacheHit = Boolean(outboundPcm)
      if (!outboundPcm) {
        const audio = await generateVoiceResponse({
          agentId: this.session.agentId,
          text: greetingText,
          channel: 'web',
          ...elevenLabsCallOpts(),
        })

        outboundPcm = await audioToPcm16(audio.buffer, {
          sampleRate: SAMPLE_RATE,
          channels: CHANNELS,
        })
        initialGreetingPcmCache.set(cacheKey, Buffer.from(outboundPcm))
      }

      if (this.closed) {
        return
      }

      await this.sendPcmAsRtp(outboundPcm)
      logger.info('[voice.werift.timing] Saudacao inicial concluida', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        cached: cacheHit,
        totalDurationMs: Date.now() - greetingStartedAt,
      })
      console.log(
        formatGreetingTimingBlock({
          callId: String(this.session.callId || this.session.sessionId),
          agentId: this.session.agentId,
          cached: cacheHit,
          totalDurationMs: Date.now() - greetingStartedAt,
        })
      )
      this.schedulePostAgentInboundSilence('apos_saudacao_inicial')
    } catch (error: any) {
      logger.warn('[voice.werift] Falha ao enviar saudacao inicial da chamada', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        error: error?.message || String(error),
      })
    }
  }

  private async sendPcmAsRtp(pcm: Buffer): Promise<void> {
    if (this.closed) {
      return
    }

    this.speaking = true

    try {
      const sendStartedAt = Date.now()
      logger.info('[voice.werift] Enviando audio do agente como RTP', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        pcmBytes: pcm.length,
      })

      const frameBytes = FRAME_SIZE * BYTES_PER_SAMPLE * CHANNELS
      const tail = pcm.length % frameBytes
      const pcmPadded =
        tail === 0 ? pcm : Buffer.concat([pcm, Buffer.alloc(frameBytes - tail, 0)])

      let sentPackets = 0
      let scheduleBase = Date.now()
      let frameIndex = 0

      for (let offset = 0; offset + frameBytes <= pcmPadded.length; offset += frameBytes) {
        if (this.closed) {
          break
        }

        const frame = pcmPadded.subarray(offset, offset + frameBytes)
        const opusPayload = this.encoder.encode(frame, FRAME_SIZE)
        const packet = new WeriftRtpPacket(
          new RtpHeader({
            version: 2,
            marker: offset === 0,
            payloadType: 111,
            sequenceNumber: this.sequenceNumber,
            timestamp: this.timestamp,
            ssrc: this.localAudioTrack.ssrc || 0,
          }),
          opusPayload
        )

        let targetTime = scheduleBase + frameIndex * OUTBOUND_PACKET_INTERVAL_MS
        const lag = Date.now() - targetTime
        if (lag > RTP_PACER_MAX_LAG_MS) {
          scheduleBase = Date.now()
          frameIndex = 0
          targetTime = scheduleBase
        }

        const waitMs = targetTime - Date.now()
        if (waitMs > 0) {
          await delay(waitMs)
        }

        this.localAudioTrack.writeRtp(packet)
        sentPackets += 1
        this.sequenceNumber = (this.sequenceNumber + 1) & 0xffff
        this.timestamp = (this.timestamp + FRAME_SIZE) >>> 0
        frameIndex += 1
      }

      logger.info('[voice.werift] Audio RTP do agente enviado', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        sentPackets,
        durationMs: Date.now() - sendStartedAt,
      })
    } finally {
      this.speaking = false
      this.mergeOverflowIntoMainBuffer()
    }
  }
}

export class WeriftVoiceCallAdapter {
  private readonly sessions = new Map<string, ActiveWeriftSession>()

  supportsRealtimeCalls(): boolean {
    return true
  }

  async prepareInboundWhatsAppCall(session: VoiceCallSession): Promise<PreparedVoiceCallSession> {
    const sessionKey = getSessionKey(session)
    const sdpOffer = String(session.sdpOffer || '').trim()

    if (!sessionKey) {
      throw new Error('callId/sessionId ausente para chamada WebRTC.')
    }

    if (!sdpOffer.startsWith('v=0')) {
      throw new Error('sdpOffer ausente ou invalido para chamada WebRTC.')
    }

    await this.closeSession(sessionKey)

    const peer = new RTCPeerConnection({
      iceServers: parseIceServers(),
    })

    const localAudioTrack = new MediaStreamTrack({ kind: 'audio' })
    peer.addTrack(localAudioTrack)

    const audioPipeline = new VoiceCallAudioPipeline(session, localAudioTrack)

    const activeSession: ActiveWeriftSession = {
      peer,
      localAudioTrack,
      startedAt: new Date().toISOString(),
      inboundPackets: 0,
      inboundBytes: 0,
      audioPipeline,
    }
    this.sessions.set(sessionKey, activeSession)

    peer.onTrack.subscribe((track) => {
      if (track.kind !== 'audio') {
        return
      }

      logger.info('[voice.werift] Track remota de audio recebida', {
        callId: sessionKey,
        agentId: session.agentId,
      })

      track.onReceiveRtp.subscribe((rtp: RtpPacket) => {
        activeSession.inboundPackets += 1
        activeSession.inboundBytes += rtp.payload.length
        activeSession.audioPipeline.handleInboundRtp(rtp)

        if (VOICE_VERBOSE_LOGS && (activeSession.inboundPackets === 1 || activeSession.inboundPackets % 250 === 0)) {
          logger.info('[voice.werift] Audio RTP recebido da chamada', {
            callId: sessionKey,
            packets: activeSession.inboundPackets,
            bytes: activeSession.inboundBytes,
          })
        }
      })
    })

    peer.connectionStateChange.subscribe((state) => {
      logger.info('[voice.werift] Estado WebRTC atualizado', {
        callId: sessionKey,
        state,
      })

      if (state === 'closed' || state === 'failed' || state === 'disconnected') {
        void this.closeSession(sessionKey)
      }
    })

    const flushTimer = setInterval(() => {
      void activeSession.audioPipeline.flushIfReady()
    }, FLUSH_INTERVAL_MS)

    peer.connectionStateChange.subscribe((state) => {
      if (state === 'closed' || state === 'failed' || state === 'disconnected') {
        clearInterval(flushTimer)
      }
    })

    await peer.setRemoteDescription({
      type: 'offer',
      sdp: sdpOffer,
    })

    const answer = await peer.createAnswer()
    await peer.setLocalDescription(answer)

    const sdpAnswer = String(peer.localDescription?.sdp || answer.sdp || '').trim()
    if (!sdpAnswer) {
      throw new Error('Falha ao gerar sdpAnswer WebRTC.')
    }

    return {
      sdpAnswer,
      metadata: {
        adapter: 'werift',
        startedAt: activeSession.startedAt,
        iceServers: parseIceServers().map((server) => server.urls),
        audioPipeline: 'rtp-stt-agent-tts-ready',
      },
    }
  }

  async attachAgentVoice(session: VoiceCallSession): Promise<void> {
    const sessionKey = getSessionKey(session)
    const activeSession = this.sessions.get(sessionKey)

    if (!activeSession) {
      throw new Error('Sessao WebRTC nao encontrada para anexar voz do agente.')
    }

    logger.info('[voice.werift] Chamada aceita e sessao WebRTC pronta para pipeline de audio', {
      callId: sessionKey,
      agentId: session.agentId,
      integrationId: session.integrationId,
      inboundPackets: activeSession.inboundPackets,
      startedAt: activeSession.startedAt,
    })

    void activeSession.audioPipeline.sendInitialGreeting()
  }

  async closeSession(callId: string): Promise<void> {
    const sessionKey = String(callId || '').trim()
    const activeSession = this.sessions.get(sessionKey)
    if (!activeSession) {
      return
    }

    this.sessions.delete(sessionKey)
    activeSession.localAudioTrack.stop()
    await activeSession.audioPipeline.close().catch(() => undefined)
    await activeSession.peer.close().catch(() => undefined)
  }
}
