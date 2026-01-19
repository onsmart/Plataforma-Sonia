import { chatText } from '../llm/openai'
import { getAgentsByEmail } from './index'
import { getAgentFromCache } from './getagentfromcache'

const DEFAULT_MESSAGE =
  'Olá! Como posso te ajudar hoje? 😊'

export async function chatWithAgent(
  email: string,
  agentId: string,
  message?: string
) {
  // 1️⃣ Garante que os agents do usuário estão em memória
  const agents = await getAgentsByEmail(email)

  // 2️⃣ Resolve o agent localmente
  const agent = getAgentFromCache(agents, agentId)

  // 3️⃣ Mensagem padrão
  if (!message || message.trim() === '') {
    return DEFAULT_MESSAGE
  }

  // 4️⃣ Prompt dinâmico
  const systemPrompt = `
You are an AI assistant.

Name: ${agent.nome}
Bio: ${agent.bio}
Language: ${agent.primary_language}

Instructions:
${agent.system_instructions}
  `.trim()

  // 5️⃣ Chamada LLM
  return chatText({
    system: systemPrompt,
    user: message,
    model: agent.provider_model,
    temperature: agent.temperature,
    maxTokens: agent.max_tokens,
    apiKey: agent.api_key, // Usa a API key do agente se disponível
  })
}
