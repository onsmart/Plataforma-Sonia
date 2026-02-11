import OpenAI from 'openai'

export interface ChatTextOptions {
  system: string       // prompt do sistema
  user: string         // mensagem do usuário
  model: string       // modelo do agente (ex: gpt-4o)
  temperature: number // temperatura do agente
  maxTokens: number   // limite de tokens
  apiKey?: string     // API key do agente (opcional, usa env se não fornecido)
}

export interface ChatTextResult {
  content: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export async function chatText({
  system,
  user,
  model,
  temperature,
  maxTokens,
  apiKey,
}: ChatTextOptions): Promise<ChatTextResult> {
  // Usa a API key do agente se fornecida, senão usa a do ambiente
  const key = apiKey?.trim() || process.env.OPENAI_API_KEY
  
  if (!key) {
    throw new Error('API key não encontrada. Configure a API key do agente ou a variável OPENAI_API_KEY')
  }

  // Cria cliente com a API key correta
  const client = new OpenAI({
    apiKey: key,
  })

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature,
    max_tokens: maxTokens,
  })

  // Retorna conteúdo e dados de uso
  return {
    content: response.choices[0].message.content ?? 'Sem resposta da LLM',
    usage: response.usage ? {
      prompt_tokens: response.usage.prompt_tokens,
      completion_tokens: response.usage.completion_tokens,
      total_tokens: response.usage.total_tokens,
    } : undefined
  }
}

