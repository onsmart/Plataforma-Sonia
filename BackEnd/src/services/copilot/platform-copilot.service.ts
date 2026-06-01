import '../../lib/env'
import OpenAI from 'openai'
import { buildPlatformCopilotSystemPrompt } from '../../content/platform-copilot/system-prompt'
import { normalizeAgentLanguageCode } from '../../utils/agent-language'
import { searchPlatformCopilotKnowledge } from './platform-copilot-rag.service'
import logger from '../../lib/logger'

export type CopilotChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type PlatformCopilotChatInput = {
  messages: CopilotChatMessage[]
  context?: {
    currentRoute?: string
    language?: string
    sessionId?: string
  }
}

export type PlatformCopilotChatResult = {
  role: 'assistant'
  content: string
  sessionId?: string
}

const COPILOT_MODEL = process.env.PLATFORM_COPILOT_MODEL || 'gpt-4o-mini'
const MAX_HISTORY = 12

function sanitizeMessages(messages: CopilotChatMessage[]): CopilotChatMessage[] {
  return messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content.trim().slice(0, 8000),
    }))
    .filter((m) => m.content.length > 0)
    .slice(-MAX_HISTORY)
}

export async function runPlatformCopilotChat(
  input: PlatformCopilotChatInput
): Promise<PlatformCopilotChatResult> {
  const history = sanitizeMessages(input.messages || [])
  if (history.length === 0) {
    throw new Error('messages é obrigatório')
  }

  const lastUser = [...history].reverse().find((m) => m.role === 'user')
  if (!lastUser) {
    throw new Error('É necessária ao menos uma mensagem do usuário')
  }

  const language = normalizeAgentLanguageCode(input.context?.language)
  const currentRoute = input.context?.currentRoute?.trim() || null

  const { contextText } = await searchPlatformCopilotKnowledge(lastUser.content, {
    topK: 5,
    currentRoute,
  })

  const systemPrompt = buildPlatformCopilotSystemPrompt({
    language,
    currentRoute,
    ragContext: contextText,
  })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    logger.error('[platform-copilot] OPENAI_API_KEY ausente')
    throw new Error('Serviço de IA temporariamente indisponível')
  }

  const client = new OpenAI({ apiKey })

  const completion = await client.chat.completions.create({
    model: COPILOT_MODEL,
    temperature: 0.3,
    max_tokens: 900,
    messages: [{ role: 'system', content: systemPrompt }, ...history],
  })

  const content = completion.choices[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('Resposta vazia da IA')
  }

  return {
    role: 'assistant',
    content,
    sessionId: input.context?.sessionId,
  }
}

export const __test__ = {
  sanitizeMessages,
  buildPlatformCopilotSystemPrompt,
}
