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
const MIN_UTTERANCE_PACKETS = getPositiveIntEnv('VOICE_CALL_MIN_UTTERANCE_PACKETS', 70, 10)
const MAX_UTTERANCE_PACKETS = Math.max(
  getPositiveIntEnv('VOICE_CALL_MAX_UTTERANCE_PACKETS', 160, MIN_UTTERANCE_PACKETS),
  MIN_UTTERANCE_PACKETS
)
const FLUSH_INTERVAL_MS = getPositiveIntEnv('VOICE_CALL_FLUSH_INTERVAL_MS', 800, 400)
const MIN_PCM_RMS = getPositiveIntEnv('VOICE_CALL_MIN_PCM_RMS', 60, 0)
const TRANSCRIPTION_FAILURE_COOLDOWN_MS = getPositiveIntEnv('VOICE_CALL_STT_FAILURE_COOLDOWN_MS', 5000, 0)
const OUTBOUND_PACKET_INTERVAL_MS = 20
const VOICE_VERBOSE_LOGS = ['1', 'true', 'yes'].includes(String(process.env.VOICE_CALL_VERBOSE_LOGS || '').trim().toLowerCase())
const initialGreetingPcmCache = new Map<string, Buffer>()

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
  private processing = false
  private speaking = false
  private closed = false
  private lastMinSpeechLogAt = 0
  private readonly callTurns: Array<{ user: string; assistant: string }> = []
  private sequenceNumber = Math.floor(Math.random() * 0xffff)
  private timestamp = Math.floor(Math.random() * 0xffffffff)

  constructor(
    private readonly session: VoiceCallSession,
    private readonly localAudioTrack: MediaStreamTrack
  ) {
    this.encoder.setBitrate(32000)
  }

  handleInboundRtp(rtp: RtpPacket): void {
    if (this.closed) {
      return
    }

    if (this.speaking || this.processing || !rtp.payload.length) {
      return
    }

    try {
      const decoded = this.decoder.decode(rtp.payload)
      if (decoded.length > 0) {
        this.pcmChunks.push(decoded)
        this.packetCount += 1
        if (VOICE_VERBOSE_LOGS && (this.packetCount === 1 || this.packetCount % 100 === 0)) {
          logger.info('[voice.werift] Audio Opus decodificado da chamada', {
            callId: this.session.callId || this.session.sessionId,
            agentId: this.session.agentId,
            decodedPackets: this.packetCount,
            pcmBytes: this.pcmChunks.reduce((total, chunk) => total + chunk.length, 0),
            ignoredPayloadBytes: this.ignoredPayloadBytes,
            decodeFailures: this.decodeFailures,
          })
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

    if (this.packetCount >= MAX_UTTERANCE_PACKETS) {
      void this.flushUtterance('max_packets')
    }
  }

  async flushIfReady(): Promise<void> {
    if (this.closed) {
      return
    }

    if (this.transcriptionUnavailable) {
      return
    }

    if (Date.now() < this.nextTranscriptionAttemptAt) {
      return
    }

    if (this.packetCount >= MIN_UTTERANCE_PACKETS) {
      await this.flushUtterance('timer')
      return
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

    this.closed = true
    this.decoder.delete()
    this.encoder.delete()
  }

  private consumePcm(): Buffer {
    const pcm = Buffer.concat(this.pcmChunks)
    this.pcmChunks.length = 0
    this.packetCount = 0
    return pcm
  }

  private async flushUtterance(reason: string): Promise<void> {
    if (this.closed) {
      return
    }

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

    const pcm = this.consumePcm()
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

    if (pcmRms < MIN_PCM_RMS) {
      logger.info('[voice.werift] Audio descartado por baixa energia', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        pcmRms: Number(pcmRms.toFixed(2)),
        minPcmRms: MIN_PCM_RMS,
      })
      return
    }

    this.processing = true
    try {
      const wav = await pcm16ToWav(pcm, {
        sampleRate: SAMPLE_RATE,
        channels: CHANNELS,
      })

      const transcript = await transcribeVoiceCallAudio({
        audio: wav,
        mimeType: 'audio/wav',
        filename: `${this.session.callId || this.session.sessionId}.wav`,
        language: 'pt',
      })

      if (!transcript) {
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

      const reply = await chatWithAgent(userEmail, this.session.agentId, agentInput, {
        channel: 'whatsapp_call',
        call_id: this.session.callId || this.session.sessionId,
        integration_id: this.session.integrationId,
        phone_number: this.session.caller || null,
        call_turns: this.callTurns.length,
      })

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
      })
      if (this.closed) {
        return
      }

      const outboundPcm = await audioToPcm16(audio.buffer, {
        sampleRate: SAMPLE_RATE,
        channels: CHANNELS,
      })

      await this.sendPcmAsRtp(outboundPcm)
      this.callTurns.push({ user: transcript, assistant: replyText })
      if (this.callTurns.length > 6) {
        this.callTurns.splice(0, this.callTurns.length - 6)
      }
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
      })

      const outboundPcm = await audioToPcm16(audio.buffer, {
        sampleRate: SAMPLE_RATE,
        channels: CHANNELS,
      })

      if (this.closed) {
        return
      }

      await this.sendPcmAsRtp(outboundPcm)
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
      const cacheKey = `${this.session.agentId}:${greetingText}`
      logger.info('[voice.werift] Gerando saudacao inicial da chamada', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        cached: initialGreetingPcmCache.has(cacheKey),
      })

      let outboundPcm = initialGreetingPcmCache.get(cacheKey)
      if (!outboundPcm) {
        const audio = await generateVoiceResponse({
          agentId: this.session.agentId,
          text: greetingText,
          channel: 'web',
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
      logger.info('[voice.werift] Enviando audio do agente como RTP', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        pcmBytes: pcm.length,
      })

      const frameBytes = FRAME_SIZE * BYTES_PER_SAMPLE * CHANNELS
      let sentPackets = 0
      for (let offset = 0; offset + frameBytes <= pcm.length; offset += frameBytes) {
        if (this.closed) {
          break
        }

        const frame = pcm.subarray(offset, offset + frameBytes)
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

        this.localAudioTrack.writeRtp(packet)
        sentPackets += 1
        this.sequenceNumber = (this.sequenceNumber + 1) & 0xffff
        this.timestamp = (this.timestamp + FRAME_SIZE) >>> 0
        await delay(OUTBOUND_PACKET_INTERVAL_MS)
      }

      logger.info('[voice.werift] Audio RTP do agente enviado', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        sentPackets,
      })
    } finally {
      this.speaking = false
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
