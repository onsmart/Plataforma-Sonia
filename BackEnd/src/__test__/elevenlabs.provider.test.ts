import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { ElevenLabsProvider } from '../modules/voice/providers/elevenlabs.provider'

describe('elevenlabs.provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    process.env.ELEVENLABS_API_KEY = 'test-elevenlabs-key'
    process.env.ELEVENLABS_DEFAULT_MODEL_ID = 'eleven_multilingual_v2'
  })

  it('lista vozes disponiveis com autenticacao no backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          voices: [{ voice_id: 'voice-1', name: 'Sonia', category: 'premade' }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    const provider = new ElevenLabsProvider()
    const voices = await provider.listVoices()

    expect(voices).toEqual([{ voice_id: 'voice-1', name: 'Sonia', category: 'premade' }])
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.elevenlabs.io/v1/voices',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'xi-api-key': 'test-elevenlabs-key',
        }),
      })
    )
  })

  it('gera audio com payload normalizado para a API da ElevenLabs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(Buffer.from('audio-binary'), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new ElevenLabsProvider()
    const buffer = await provider.generateSpeech({
      text: 'Ola mundo',
      voiceId: 'voice-xyz',
      stability: 0.45,
      similarityBoost: 0.75,
      style: 0.2,
      useSpeakerBoost: true,
    })

    expect(buffer.equals(Buffer.from('audio-binary'))).toBe(true)

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/text-to-speech/voice-xyz/stream')
    expect(url).toContain('output_format=mp3_44100_128')
    expect(options.method).toBe('POST')

    const body = JSON.parse(String(options.body))
    expect(body).toEqual({
      text: 'Ola mundo',
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0.2,
        use_speaker_boost: true,
      },
    })
  })
})
