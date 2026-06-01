import { Request, Response } from 'express'
import logger from '../../lib/logger'
import { runPlatformCopilotChat } from '../../services/copilot/platform-copilot.service'

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
