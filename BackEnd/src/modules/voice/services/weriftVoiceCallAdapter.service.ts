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
const MIN_UTTERANCE_PACKETS = Math.max(parseInt(process.env.VOICE_CALL_MIN_UTTERANCE_PACKETS || '35', 10), 10)
const MAX_UTTERANCE_PACKETS = Math.max(parseInt(process.env.VOICE_CALL_MAX_UTTERANCE_PACKETS || '140', 10), MIN_UTTERANCE_PACKETS)
const OUTBOUND_PACKET_INTERVAL_MS = 20

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

class VoiceCallAudioPipeline {
  private readonly decoder = new OpusScript(SAMPLE_RATE, CHANNELS, OpusScript.Application.VOIP)
  private readonly encoder = new OpusScript(SAMPLE_RATE, CHANNELS, OpusScript.Application.VOIP)
  private readonly pcmChunks: Buffer[] = []
  private packetCount = 0
  private decodeFailures = 0
  private ignoredPayloadBytes = 0
  private processing = false
  private speaking = false
  private sequenceNumber = Math.floor(Math.random() * 0xffff)
  private timestamp = Math.floor(Math.random() * 0xffffffff)

  constructor(
    private readonly session: VoiceCallSession,
    private readonly localAudioTrack: MediaStreamTrack
  ) {
    this.encoder.setBitrate(32000)
  }

  handleInboundRtp(rtp: RtpPacket): void {
    if (this.speaking || this.processing || !rtp.payload.length) {
      return
    }

    try {
      const decoded = this.decoder.decode(rtp.payload)
      if (decoded.length > 0) {
        this.pcmChunks.push(decoded)
        this.packetCount += 1
        if (this.packetCount === 1 || this.packetCount % 100 === 0) {
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
    if (this.packetCount >= MIN_UTTERANCE_PACKETS) {
      await this.flushUtterance('timer')
      return
    }

    if (this.packetCount > 0) {
      logger.info('[voice.werift] Aguardando fala minima para transcrever', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        decodedPackets: this.packetCount,
        minPackets: MIN_UTTERANCE_PACKETS,
      })
    }
  }

  async close(): Promise<void> {
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
    if (this.processing || this.speaking) {
      return
    }

    const pcm = this.consumePcm()
    logger.info('[voice.werift] Fala capturada para transcricao', {
      callId: this.session.callId || this.session.sessionId,
      agentId: this.session.agentId,
      reason,
      pcmBytes: pcm.length,
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
        transcriptPreview: transcript.slice(0, 120),
      })

      const userEmail = String(this.session.userEmail || '').trim()
      if (!userEmail) {
        logger.warn('[voice.werift] Chamada sem userEmail; nao foi possivel chamar o agente', {
          callId: this.session.callId || this.session.sessionId,
          agentId: this.session.agentId,
        })
        return
      }

      const reply = await chatWithAgent(userEmail, this.session.agentId, transcript, {
        channel: 'whatsapp_call',
        call_id: this.session.callId || this.session.sessionId,
        integration_id: this.session.integrationId,
        phone_number: this.session.caller || null,
      })

      const replyText = String(reply || '').trim()
      if (!replyText) {
        logger.warn('[voice.werift] Agente nao retornou texto para chamada', {
          callId: this.session.callId || this.session.sessionId,
          agentId: this.session.agentId,
          transcriptPreview: transcript.slice(0, 120),
        })
        return
      }

      const audio = await generateVoiceResponse({
        agentId: this.session.agentId,
        text: replyText,
        channel: 'web',
      })

      const outboundPcm = await audioToPcm16(audio.buffer, {
        sampleRate: SAMPLE_RATE,
        channels: CHANNELS,
      })

      await this.sendPcmAsRtp(outboundPcm)
    } catch (error: any) {
      logger.warn('[voice.werift] Falha no pipeline de audio da ligacao', {
        callId: this.session.callId || this.session.sessionId,
        agentId: this.session.agentId,
        error: error?.message,
      })
    } finally {
      this.processing = false
    }
  }

  private async sendPcmAsRtp(pcm: Buffer): Promise<void> {
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

        if (activeSession.inboundPackets === 1 || activeSession.inboundPackets % 250 === 0) {
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
    }, 1200)

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
