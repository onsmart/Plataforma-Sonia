import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('voiceTranscription.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    process.env.ELEVENLABS_API_KEY = 'test-elevenlabs-key'
    process.env.VOICE_CALL_STT_PROVIDER = 'elevenlabs'
    process.env.VOICE_CALL_ELEVENLABS_TRANSCRIPTION_MODEL = 'scribe_v2'
    process.env.VOICE_CALL_STT_TIMEOUT_MS = '15000'
  })

  it('usa ElevenLabs para transcrever audio de ligacao quando configurado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          language_code: 'pt',
          language_probability: 0.99,
          text: 'Ola, tudo bem?',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    const { transcribeVoiceCallAudio } = await import('../modules/voice/services/voiceTranscription.service')
    const transcript = await transcribeVoiceCallAudio({
      audio: Buffer.from('fake-audio'),
      mimeType: 'audio/wav',
      filename: 'call.wav',
      language: 'pt',
    })

    expect(transcript).toBe('Ola, tudo bem?')
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.elevenlabs.io/v1/speech-to-text')
    expect(options.method).toBe('POST')
    expect(options.headers).toEqual(
      expect.objectContaining({
        'xi-api-key': 'test-elevenlabs-key',
      })
    )
    expect(options.body).toBeInstanceOf(FormData)
  })
})
