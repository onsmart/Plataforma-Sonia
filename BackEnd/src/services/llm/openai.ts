import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface ChatTextOptions {
  system: string       // prompt do sistema
  user: string         // mensagem do usuário
  model: string       // modelo do agente (ex: gpt-4o)
  temperature?: number // temperatura do agente
  maxTokens?: number   // limite de tokens
}

export async function chatText({
  system,
  user,
  model,
  temperature = 0.7,
  maxTokens = 500,
}: ChatTextOptions): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature,
    max_tokens: maxTokens,
  })

  // Garante que nunca retornamos null
  return response.choices[0].message.content ?? 'Sem resposta da LLM'
}

