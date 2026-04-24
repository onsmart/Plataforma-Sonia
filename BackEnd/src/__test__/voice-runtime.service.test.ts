import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sendWhatsAppMock, tryGenerateVoiceResponseMock } = vi.hoisted(() => ({
  sendWhatsAppMock: vi.fn(),
  tryGenerateVoiceResponseMock: vi.fn(),
}))

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../services/integrations/whatsapp/whatsapp.dispatcher', () => ({
  sendWhatsApp: sendWhatsAppMock,
}))

vi.mock('../modules/voice/services/voiceGeneration.service', () => ({
  tryGenerateVoiceResponse: tryGenerateVoiceResponseMock,
}))

import {
  registerWhatsAppMediaSender,
  resetWhatsAppMediaSender,
  sendAgentWhatsAppResponseWithVoiceFallback,
} from '../modules/voice/services/voiceRuntime.service'
import type { GeneratedVoiceAudio, WhatsAppMediaSender } from '../modules/voice/types/voice.types'

describe('voiceRuntime.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetWhatsAppMediaSender()
    sendWhatsAppMock.mockResolvedValue({ success: true, messageId: 'text-msg-1' })
  })

  it('faz fallback para texto quando o projeto ainda nao suporta envio de audio no WhatsApp', async () => {
    const result = await sendAgentWhatsAppResponseWithVoiceFallback({
      integrationId: 'integration-1',
      to: '5511999999999',
      text: 'Resposta em texto',
      agentId: 'agent-1',
    })

    expect(tryGenerateVoiceResponseMock).not.toHaveBeenCalled()
    expect(sendWhatsAppMock).toHaveBeenCalledWith('integration-1', {
      to: '5511999999999',
      message: 'Resposta em texto',
      agentId: 'agent-1',
      context: undefined,
    })
    expect(result.delivery).toBe('text')
  })

  it('faz fallback para texto quando a geracao de audio falha', async () => {
    const sender: WhatsAppMediaSender = {
      supportsAudioMessages: vi.fn().mockResolvedValue(true),
      sendAudioMessage: vi.fn(),
    }
    registerWhatsAppMediaSender(sender)
    tryGenerateVoiceResponseMock.mockResolvedValue(null)

    const result = await sendAgentWhatsAppResponseWithVoiceFallback({
      integrationId: 'integration-1',
      to: '5511999999999',
      text: 'Resposta em texto',
      agentId: 'agent-1',
    })

    expect(tryGenerateVoiceResponseMock).toHaveBeenCalledWith({
      agentId: 'agent-1',
      text: 'Resposta em texto',
      channel: 'whatsapp_audio',
      integrationId: 'integration-1',
      recipient: '5511999999999',
    })
    expect(sendWhatsAppMock).toHaveBeenCalled()
    expect(result.delivery).toBe('text')
  })

  it('envia audio quando existe sender de midia e a geracao funciona', async () => {
    const audio: GeneratedVoiceAudio = {
      buffer: Buffer.from('audio'),
      mimeType: 'audio/ogg',
      fileExtension: 'ogg',
      provider: 'elevenlabs',
      voiceId: 'voice-1',
      voiceName: 'Sonia',
      modelId: 'model-1',
      channel: 'whatsapp_audio',
      convertedForChannel: true,
    }
    const sender: WhatsAppMediaSender = {
      supportsAudioMessages: vi.fn().mockResolvedValue(true),
      sendAudioMessage: vi.fn().mockResolvedValue({ success: true, messageId: 'audio-msg-1' }),
    }
    registerWhatsAppMediaSender(sender)
    tryGenerateVoiceResponseMock.mockResolvedValue(audio)

    const result = await sendAgentWhatsAppResponseWithVoiceFallback({
      integrationId: 'integration-1',
      to: '5511999999999',
      text: 'Resposta em audio',
      agentId: 'agent-1',
      context: { conversationId: 'conv-1' },
    })

    expect(sender.sendAudioMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationId: 'integration-1',
        recipient: '5511999999999',
        audio,
      })
    )
    expect(sendWhatsAppMock).not.toHaveBeenCalled()
    expect(result.delivery).toBe('audio')
    expect(result.messageId).toBe('audio-msg-1')
  })
})
