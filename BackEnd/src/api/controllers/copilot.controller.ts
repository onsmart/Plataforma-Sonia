import { Request, Response } from 'express'
import logger from '../../lib/logger'
import { runPlatformCopilotChat } from '../../services/copilot/platform-copilot.service'
import { ElevenLabsProvider } from '../../modules/voice/providers/elevenlabs.provider'

/**
 * Voice ID da Fernanda (ElevenLabs).
 * Configure ELEVENLABS_COPILOT_VOICE_ID no .env com o ID da voz Fernanda.
 * Para obter o ID: acesse api.elevenlabs.io/v1/voices e busque "Fernanda".
 */
const COPILOT_VOICE_ID = process.env.ELEVENLABS_COPILOT_VOICE_ID?.trim() || ''
const COPILOT_TTS_MODEL = 'eleven_multilingual_v2'

/**
 * POST /copilot/chat
 * Assistente fixa da plataforma (não é agente de tenant).
 */
export async function copilotChatController(req: Request, res: Response) {
  try {
    const { messages, context } = req.body || {}

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages é obrigatório' })
    }

    const result = await runPlatformCopilotChat({
      messages,
      context: {
        currentRoute: typeof context?.currentRoute === 'string' ? context.currentRoute : undefined,
        language: typeof context?.language === 'string' ? context.language : undefined,
        sessionId:
          typeof context?.sessionId === 'string'
            ? context.sessionId
            : `copilot:${req.user?.email || 'anon'}`,
      },
    })

    return res.json(result)
  } catch (error: unknown) {
    logger.error('[copilotChat] Erro:', error)
    return res.status(500).json({
      error: 'Erro ao processar mensagem da Copilot',
      details: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * GET /copilot/voice-session
 * Gera uma signed URL temporária do ElevenLabs Conversational AI.
 * Mantém o agentId no backend — nunca exposto ao frontend.
 */
export async function copilotVoiceSessionController(req: Request, res: Response) {
  try {
    const agentId = process.env.ELEVENLABS_COPILOT_AGENT_ID?.trim()
    const apiKey  = process.env.ELEVENLABS_API_KEY?.trim()

    if (!agentId) {
      return res.status(503).json({
        error: 'Agente de voz não configurado',
        details: 'Defina ELEVENLABS_COPILOT_AGENT_ID no .env do backend.',
      })
    }
    if (!apiKey) {
      return res.status(503).json({ error: 'ElevenLabs API key não configurada.' })
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agentId)}`,
      { method: 'GET', headers: { 'xi-api-key': apiKey } }
    )

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      logger.error('[copilotVoiceSession] ElevenLabs erro:', response.status, body.slice(0, 200))
      return res.status(502).json({ error: 'Erro ao obter sessão de voz do ElevenLabs.' })
    }

    const data = (await response.json()) as { signed_url?: string }
    if (!data.signed_url) {
      return res.status(502).json({ error: 'ElevenLabs não retornou signed_url.' })
    }

    return res.json({ signedUrl: data.signed_url })
  } catch (error: unknown) {
    logger.error('[copilotVoiceSession] Erro:', error)
    return res.status(500).json({
      error: 'Erro ao iniciar sessão de voz',
      details: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * POST /copilot/tts
 * Sintetiza o texto com a voz Fernanda (ElevenLabs) e retorna áudio MP3.
 */
export async function copilotTtsController(req: Request, res: Response) {
  try {
    const { text } = req.body || {}

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text é obrigatório' })
    }

    if (!COPILOT_VOICE_ID) {
      return res.status(503).json({
        error: 'Voz não configurada',
        details: 'Defina ELEVENLABS_COPILOT_VOICE_ID no .env do backend com o ID da voz Fernanda.',
      })
    }

    const provider = new ElevenLabsProvider()
    if (!provider.isConfigured()) {
      return res.status(503).json({ error: 'ElevenLabs não configurado no servidor.' })
    }

    const cleanText = String(text)
      .replace(/\[.*?\]/g, '')   // remove tags [NAVIGATE:...]
      .replace(/\*\*/g, '')       // remove markdown bold
      .replace(/#{1,6}\s/g, '')   // remove markdown headers
      .trim()
      .slice(0, 2500)             // limite de segurança

    if (!cleanText) {
      return res.status(400).json({ error: 'Texto resultante está vazio após limpeza.' })
    }

    const audioBuffer = await provider.generateSpeech({
      text: cleanText,
      voiceId: COPILOT_VOICE_ID,
      modelId: COPILOT_TTS_MODEL,
      stability: 0.48,
      similarityBoost: 0.78,
      style: 0.12,
      useSpeakerBoost: true,
    })

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Length', audioBuffer.byteLength)
    res.setHeader('Cache-Control', 'no-store')
    return res.send(audioBuffer)
  } catch (error: unknown) {
    logger.error('[copilotTts] Erro ao gerar áudio:', error)
    return res.status(500).json({
      error: 'Erro ao gerar áudio com ElevenLabs',
      details: error instanceof Error ? error.message : String(error),
    })
  }
}
