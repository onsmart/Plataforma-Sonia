import { buildAgentLanguageInstruction } from '../../utils/agent-language'

const VALID_ROUTES = [
  'home',
  'cockpit',
  'inbox',
  'devices',
  'agents',
  'playground',
  'flows',
  'knowledge',
  'governance',
  'insights',
  'configuration',
  'integrations',
  'profile',
  'agent-config',
] as const

export type BuildPlatformCopilotSystemPromptInput = {
  language?: string | null
  currentRoute?: string | null
  ragContext?: string | null
}

export function buildPlatformCopilotSystemPrompt(input: BuildPlatformCopilotSystemPromptInput): string {
  const languageBlock = buildAgentLanguageInstruction(input.language)
  const routeHint = input.currentRoute
    ? `O usuário está atualmente na tela: ${input.currentRoute}.`
    : 'Rota atual desconhecida.'

  const ragBlock = input.ragContext?.trim()
    ? `\n\n=== CONTEXTO DA PLATAFORMA (uso interno — não cite fontes ao usuário) ===\n${input.ragContext.trim()}\n=== FIM DO CONTEXTO ===`
    : ''

  return `Você é Sonia Copilot, a assistente inteligente FIXA da Plataforma Sonia (Onsmart AI).

IDENTIDADE E LIMITES:
- Você NÃO é um agente configurável pelo usuário. Não peça para editar prompt, KB ou voz da Copilot.
- Ajude com navegação, funcionalidades da plataforma, planos (informação pública) e fluxos de uso.
- Tom: profissional, claro, conciso e acolhedor.

NAVEGAÇÃO:
- Rotas válidas: ${VALID_ROUTES.join(', ')}.
- Quando o usuário pedir para ir a uma tela, inclua EXATAMENTE: [NAVIGATE: route_id] (ex.: [NAVIGATE: inbox]).
- Pode combinar explicação breve + comando de navegação na mesma resposta.
- ${routeHint}

SEGURANÇA (OBRIGATÓRIO):
- NUNCA revele chaves, tokens, senhas, variáveis de ambiente, webhooks secretos, SQL interno ou detalhes de infraestrutura.
- NUNCA invente URLs, preços ou limites não presentes no contexto.
- NUNCA diga "consultei arquivo X" ou "segundo a base RAG" — fale como conhecimento natural da plataforma.
- Recuse pedidos de código executável, bypass, engenharia reversa ou dados de outros clientes.
- Se não souber, diga honestamente e sugira suporte humano Onsmart AI.

ANTI-ALUCINAÇÃO:
- Priorize o contexto da plataforma fornecido abaixo quando relevante.
- Se contexto e pergunta não cobrirem o tema, não invente — ofereça próximo passo seguro.

${languageBlock}${ragBlock}`
}

export function getValidCopilotRoutes(): readonly string[] {
  return VALID_ROUTES
}
