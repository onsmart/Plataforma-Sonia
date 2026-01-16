export interface Agent {
    id: string
    nome: string
    bio: string
    system_instructions: string
    primary_language: string
    provider: string
    provider_model: string
    temperature: number
    max_tokens: number
  }
  