import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  listElevenLabsVoicesMock,
  getAgentVoiceProfileMock,
  saveAgentVoiceProfileMock,
  generateVoicePreviewMock,
  generateVoiceResponseMock,
} = vi.hoisted(() => ({
  listElevenLabsVoicesMock: vi.fn(),
  getAgentVoiceProfileMock: vi.fn(),
  saveAgentVoiceProfileMock: vi.fn(),
  generateVoicePreviewMock: vi.fn(),
  generateVoiceResponseMock: vi.fn(),
}))

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../modules/voice/services/voiceCatalog.service', () => ({
  listElevenLabsVoices: listElevenLabsVoicesMock,
}))

vi.mock('../modules/voice/services/voiceProfile.service', () => ({
  getAgentVoiceProfile: getAgentVoiceProfileMock,
  saveAgentVoiceProfile: saveAgentVoiceProfileMock,
}))

vi.mock('../modules/voice/services/voicePreview.service', () => ({
  generateVoicePreview: generateVoicePreviewMock,
}))

vi.mock('../modules/voice/services/voiceGeneration.service', () => ({
  generateVoiceResponse: generateVoiceResponseMock,
}))

import {
  createAgentVoicePreviewController,
  getAgentVoiceProfileController,
  listElevenLabsVoicesController,
  updateAgentVoiceProfileController,
} from '../modules/voice/controllers/voice.controller'

function createResponseMock() {
  const response: any = {
    status: vi.fn(() => response),
    json: vi.fn(() => response),
    send: vi.fn(() => response),
    setHeader: vi.fn(),
  }

  return response
}

describe('voice.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista vozes da ElevenLabs pelo backend', async () => {
    listElevenLabsVoicesMock.mockResolvedValue([{ voiceId: 'voice-1', name: 'Sonia' }])

    const res = createResponseMock()
    await listElevenLabsVoicesController({} as any, res)

    expect(res.json).toHaveBeenCalledWith({
      provider: 'elevenlabs',
      voices: [{ voiceId: 'voice-1', name: 'Sonia' }],
    })
  })

  it('salva o perfil de voz do agente autenticado', async () => {
    saveAgentVoiceProfileMock.mockResolvedValue({
      profile: { agentId: 'agent-1', voiceId: 'voice-2' },
      defaults: { provider: 'elevenlabs', modelId: null, previewText: 'Preview' },
      providerConfigured: true,
    })

    const req: any = {
      user: { email: 'user@example.com' },
      params: { agentId: 'agent-1' },
      body: { voiceId: 'voice-2' },
    }
    const res = createResponseMock()

    await updateAgentVoiceProfileController(req, res)

    expect(saveAgentVoiceProfileMock).toHaveBeenCalledWith('agent-1', 'user@example.com', {
      voiceId: 'voice-2',
    })
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({ voiceId: 'voice-2' }),
      })
    )
  })

  it('gera preview em audio sem expor credenciais ao frontend', async () => {
    generateVoicePreviewMock.mockResolvedValue({
      buffer: Buffer.from('preview-audio'),
      mimeType: 'audio/mpeg',
    })

    const req: any = {
      params: { agentId: 'agent-1' },
      body: { text: 'Ola', voiceId: 'voice-1' },
    }
    const res = createResponseMock()

    await createAgentVoicePreviewController(req, res)

    expect(generateVoicePreviewMock).toHaveBeenCalledWith({
      text: 'Ola',
      voiceId: 'voice-1',
      provider: 'elevenlabs',
    })
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'audio/mpeg')
    expect(res.send).toHaveBeenCalledWith(Buffer.from('preview-audio'))
  })

  it('retorna 401 quando tenta buscar perfil sem autenticacao', async () => {
    const req: any = { user: null, params: { agentId: 'agent-1' } }
    const res = createResponseMock()

    await getAgentVoiceProfileController(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(getAgentVoiceProfileMock).not.toHaveBeenCalled()
  })
})
