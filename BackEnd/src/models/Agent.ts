export interface Agent {
  id: string
  nome: string
  bio: string
  personality_prompt: string
  role?: string // Conteúdo técnico vindo do template
  role_template_id: string
  primary_language: string
  provider: string
  provider_model: string
  temperature: number
  max_tokens: number
  api_key: string
  integrations_id: string
  crm_integration_id?: string
  status_id?: number | null
}
