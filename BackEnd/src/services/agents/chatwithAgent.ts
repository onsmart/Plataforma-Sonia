import { chatText } from '../llm/openai'
import { getAgentsByEmail } from './index'
import { getAgentFromCache } from './getagentfromcache'
import { sendEmail } from '../integrations/email/email.service'

const DEFAULT_MESSAGE = 'Olá! Como posso te ajudar hoje? 😊'

export async function chatWithAgent(
  email: string,
  agentId: string,
  message?: string
) {
  // 1️⃣ Carrega agentes do usuário
  const agents = await getAgentsByEmail(email)
  const agent = getAgentFromCache(agents, agentId)

  // 2️⃣ Mensagem vazia
  if (!message || message.trim() === '') {
    return DEFAULT_MESSAGE
  }

  // 3️⃣ Chamada ao LLM
  const llmResponse = await chatText({
    system: agent.system_instructions,
    user: message,
    model: agent.provider_model,
    temperature: agent.temperature,
    maxTokens: agent.max_tokens,
    apiKey: agent.api_key,
  })

  // 🔍 LOG CRÍTICO PARA DEBUG
  console.log('🧠 Resposta bruta do agente:', llmResponse)

  // 4️⃣ Parse do JSON
  let parsed: any = null
  try {
    parsed = JSON.parse(llmResponse)
    console.log('✅ JSON parseado:', parsed)
  } catch (err) {
    console.warn('⚠️ Resposta não é JSON válido')
    return '❌ Erro ao interpretar a resposta do agente.'
  }

  // 5️⃣ Ação: enviar email
  if (parsed.action === 'send_email') {
    try {
      console.log('📨 Enviando email com dados:', {
        to: parsed.to,
        subject: parsed.subject,
        integrations_id: agent.integrations_id,
      })

      await sendEmail(agent.integrations_id, {
        to: parsed.to,
        subject: parsed.subject,
        text: parsed.body,
        visual_style: parsed.visual_style, // Estilo visual para gerar HTML (opcional)
      })

      console.log('✅ Email enviado com sucesso')
      return '📧 Email enviado com sucesso.'
    } catch (err) {
      console.error('❌ Erro ao enviar email:', err)
      return '❌ Não foi possível enviar o email no momento.'
    }
  }

  // 6️⃣ Ação: reply
  if (parsed.action === 'reply') {
    return parsed.message
  }

  // 7️⃣ Fallback de segurança
  console.warn('⚠️ Ação não reconhecida:', parsed)
  return '❌ Ação não reconhecida pelo agente.'
}
