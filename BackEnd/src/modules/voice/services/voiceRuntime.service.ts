import logger from '../../../lib/logger'
import { sendWhatsApp } from '../../../services/integrations/whatsapp/whatsapp.dispatcher'
import { type SendWhatsAppInput } from '../../../services/integrations/whatsapp/whatsapp.service'
import {
  tryGenerateVoiceResponse,
} from './voiceGeneration.service'
import {
  type GeneratedVoiceAudio,
  type PreparedVoiceCallSession,
  type RealtimeVoiceAgentService,
  type VoiceCallSession,
  type WhatsAppMediaAudioPayload,
  type WhatsAppMediaSender,
} from '../types/voice.types'

class UnsupportedWhatsAppMediaSender implements WhatsAppMediaSender {
  supportsAudioMessages(): boolean {
    return false
  }

  async sendAudioMessage(): Promise<{ success: boolean; error?: string }> {
    return {
      success: false,
      error: 'TODO: envio de audio via WhatsApp Cloud API ainda nao foi implementado neste projeto.',
    }
  }
}

export class UnsupportedRealtimeVoiceAgentService implements RealtimeVoiceAgentService {
  async supportsRealtimeCalls(): Promise<boolean> {
    return false
  }

  async prepareInboundWhatsAppCall(_session: VoiceCallSession): Promise<PreparedVoiceCallSession> {
    throw new Error('TODO: camada WebRTC/SIP para chamadas de voz ainda nao foi implementada.')
  }

  async attachAgentVoice(_session: VoiceCallSession): Promise<void> {
    throw new Error('TODO: camada realtime para chamadas de voz ainda nao foi implementada.')
  }
}

let whatsappMediaSender: WhatsAppMediaSender = new UnsupportedWhatsAppMediaSender()
let realtimeVoiceAgentService: RealtimeVoiceAgentService = new UnsupportedRealtimeVoiceAgentService()

export function registerWhatsAppMediaSender(sender: WhatsAppMediaSender): void {
  whatsappMediaSender = sender
}

export function resetWhatsAppMediaSender(): void {
  whatsappMediaSender = new UnsupportedWhatsAppMediaSender()
}

export function getWhatsAppMediaSender(): WhatsAppMediaSender {
  return whatsappMediaSender
}

export function registerRealtimeVoiceAgentService(service: RealtimeVoiceAgentService): void {
  realtimeVoiceAgentService = service
}

export function resetRealtimeVoiceAgentService(): void {
  realtimeVoiceAgentService = new UnsupportedRealtimeVoiceAgentService()
}

export function getRealtimeVoiceAgentService(): RealtimeVoiceAgentService {
  return realtimeVoiceAgentService
}

export async function sendAgentWhatsAppResponseWithVoiceFallback(params: {
  integrationId: string
  to: string
  text: string
  agentId: string
  context?: Record<string, any>
}): Promise<{
  delivery: 'audio' | 'text'
  messageId?: string
  error?: string
  audio?: GeneratedVoiceAudio | null
  sendResult: Awaited<ReturnType<typeof sendWhatsApp>>
}> {
  const canSendAudio = await whatsappMediaSender.supportsAudioMessages({
    integrationId: params.integrationId,
    agentId: params.agentId,
  })

  if (canSendAudio) {
    const audio = await tryGenerateVoiceResponse({
      agentId: params.agentId,
      text: params.text,
      channel: 'whatsapp_audio',
      integrationId: params.integrationId,
      recipient: params.to,
    })

    if (audio) {
      const audioResult = await whatsappMediaSender.sendAudioMessage({
        integrationId: params.integrationId,
        recipient: params.to,
        agentId: params.agentId,
        textFallback: params.text,
        audio,
        metadata: params.context,
      } satisfies WhatsAppMediaAudioPayload)

      if (audioResult.success) {
        logger.info('[voice.runtime] Audio enviado via WhatsApp', {
          integrationId: params.integrationId,
          agentId: params.agentId,
          recipient: params.to,
        })
        return {
          delivery: 'audio',
          messageId: audioResult.messageId,
          audio,
          sendResult: { success: true, messageId: audioResult.messageId },
        }
      }

      logger.warn('[voice.runtime] Envio de audio falhou; fallback para texto', {
        integrationId: params.integrationId,
        agentId: params.agentId,
        recipient: params.to,
        error: audioResult.error,
      })
    }
  } else {
    logger.info('[voice.runtime] WhatsApp sem suporte a audio; fallback para texto', {
      integrationId: params.integrationId,
      agentId: params.agentId,
    })
  }

  const sendInput: SendWhatsAppInput = {
    to: params.to,
    message: params.text,
    agentId: params.agentId,
    context: params.context,
  }

  const sendResult = await sendWhatsApp(params.integrationId, sendInput)

  if (!sendResult.success) {
    logger.warn('[voice.runtime] Falha no fallback em texto do WhatsApp', {
      integrationId: params.integrationId,
      agentId: params.agentId,
      recipient: params.to,
      error: sendResult.error,
    })
  }

  return {
    delivery: 'text',
    error: sendResult.error,
    sendResult,
  }
}
