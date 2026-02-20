import OpenAI from "openai"

export interface ChatTextOptions {
  system: string       // prompt do sistema
  user: string         // mensagem do usuário
  model: string       // modelo do agente (ex: gpt-4o)
  temperature: number // temperatura do agente
  maxTokens: number   // limite de tokens
  apiKey?: string     // API key do agente (opcional, usa env se não fornecido)
  responseFormat?: any // Formato de resposta (opcional, ex: json_schema)
}

export interface ChatTextResult {
  success: boolean
  content: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  error?: string
}

export async function chatText({
  system,
  user,
  model,
  temperature,
  maxTokens,
  apiKey,
  responseFormat,
}: ChatTextOptions): Promise<ChatTextResult> {

  const key = apiKey?.trim() || process.env.OPENAI_API_KEY

  if (!key) {
    return {
      success: false,
      content: 'Configuração de IA ausente.',
      error: 'API_KEY_MISSING'
    }
  }

  try {
    const client = new OpenAI({ apiKey: key })

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: responseFormat, // Adiciona suporte ao formato de resposta (JSON Schema)
    })

    return {
      success: true,
      content: response.choices[0].message.content ?? 'Sem resposta da LLM',
      usage: response.usage ? {
        prompt_tokens: response.usage.prompt_tokens,
        completion_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens,
      } : undefined
    }

  } catch (error: any) {

    console.error('Erro na chamada OpenAI:', error?.message)

    return {
      success: false,
      content: 'Estou temporariamente com instabilidade na IA. Tente novamente.',
      error: 'LLM_UNAVAILABLE'
    }
  }
}