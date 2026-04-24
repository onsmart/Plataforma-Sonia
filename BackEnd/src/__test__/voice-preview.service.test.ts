import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  isConfiguredMock,
  generatePreviewMock,
  getDefaultVoicePreviewTextMock,
} = vi.hoisted(() => ({
  isConfiguredMock: vi.fn(),
  generatePreviewMock: vi.fn(),
  getDefaultVoicePreviewTextMock: vi.fn(),
}))

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../modules/voice/services/voiceProfile.service', () => ({
  getDefaultVoicePreviewText: getDefaultVoicePreviewTextMock,
}))

vi.mock('../modules/voice/providers/elevenlabs.provider', () => ({
  ElevenLabsProvider: class {
    isConfigured() {
      return isConfiguredMock()
    }

    generatePreview(input: unknown) {
      return generatePreviewMock(input)
    }
  },
}))

import { generateVoicePreview } from '../modules/voice/services/voicePreview.service'
import { VoiceModuleError } from '../modules/voice/types/voice.types'

describe('voicePreview.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isConfiguredMock.mockReturnValue(true)
    getDefaultVoicePreviewTextMock.mockReturnValue('Texto padrao de preview')
    generatePreviewMock.mockResolvedValue(Buffer.from('preview-audio'))
  })

  it('sanitiza o texto e retorna audio temporario para o frontend', async () => {
    const audio = await generateVoicePreview({
      text: '  Ola \n mundo \u0001  ',
      voiceId: 'voice-1',
      modelId: 'model-1',
      stability: 0.4,
      similarityBoost: 0.6,
      style: 0.1,
      useSpeakerBoost: true,
    })

    expect(generatePreviewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Ola mundo',
        voiceId: 'voice-1',
      })
    )
    expect(audio).toEqual(
      expect.objectContaining({
        mimeType: 'audio/mpeg',
        fileExtension: 'mp3',
        provider: 'elevenlabs',
        voiceId: 'voice-1',
      })
    )
  })

  it('retorna erro amigavel quando a voz nao foi escolhida', async () => {
    await expect(
      generateVoicePreview({
        text: 'Teste',
        voiceId: '',
      })
    ).rejects.toMatchObject({
      code: 'VOICE_ID_REQUIRED',
      statusCode: 400,
    } satisfies Partial<VoiceModuleError>)
  })
})
