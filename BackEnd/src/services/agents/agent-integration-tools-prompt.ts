import {
  type AgentExtraFeaturesV2,
  buildToolKey,
  getEnabledTools,
  parseAgentExtraFeatures,
  resolveSchedulingConfig,
} from './agent-extra-features'
import { listIntegrationToolkitCatalog } from '../integrations/toolkit/toolkit.service'

/**
 * Bloco que TODO template de agente com integrações deve ter no campo "Papel" (role).
 * Copie/adapte no editor de templates — não depende da demo Onsmart.
 */
export const PLATFORM_TEMPLATE_INTEGRATION_TOOLS_SECTION = `
## FERRAMENTAS DE INTEGRACAO (obrigatorio se o agente usa integracoes)

Este agente pode ter ferramentas ligadas no painel (Calendly, HubSpot, WhatsApp, e-mail).
O sistema injeta automaticamente no prompt a lista de ferramentas ATIVAS deste agente.
Voce deve definir aqui QUANDO e COMO usar cada capacidade — o backend executa, mas voce conduz a conversa.

### Configuracao operacional (painel do agente — nao repetir aqui)
- Ligar/desligar cada ferramenta por integracao.
- Escolher qual conta Calendly/CRM/WhatsApp usar.
- Mensagem inicial (welcome) na aba Prompt.
- Historico da conversa no canal.

### Calendly — agendamento conversacional
- NAO invente horarios confirmados nem envie links externos do Calendly.
- Agendar: primeiro pergunte dia e horario (action reply, sem ferramenta). So depois use check_availability com a data informada. NUNCA diga ao usuario que vai verificar/consultar agenda.
- Nunca use ferramentas Calendly em saudacao (oi/ola) sem pedido explicito de agendar/consultar/cancelar.
- Consultar reuniao: use a ferramenta de listar/consultar quando o usuario perguntar data da reuniao; se nao achar, peca o e-mail da reserva.
- Cancelar: use a ferramenta de cancelar quando pedirem; se nao achar evento, peca o e-mail usado no agendamento.
- Horario ocupado: diga que esta ocupado e ofereca outros horarios no mesmo dia quando existirem vagas.
- Saudacao (oi/ola): breve e neutra; NAO mencione cancelamento ou reunioes antigas na saudacao.

### HubSpot — CRM
- Buscar/criar/atualizar contato apenas quando o fluxo do negocio exigir e a ferramenta estiver ativa.

### WhatsApp / E-mail
- Envio de mensagens so quando o fluxo e as politicas do canal permitirem.

### Tom
- Portugues do Brasil, mensagens curtas em canais como WhatsApp.
`.trim()

const TOOL_USAGE_HINTS: Record<string, string> = {
  [buildToolKey('calendly', 'check_availability')]:
    'Apos o cliente informar dia (e horario): verifica no Calendly se esta livre. Nao avisar que vai consultar.',
  [buildToolKey('calendly', 'book_appointment')]:
    'Confirmar agendamento apos o usuario escolher horario e informar nome/e-mail.',
  [buildToolKey('calendly', 'cancel_appointment')]:
    'Cancelar evento ativo quando o usuario pedir cancelamento.',
  [buildToolKey('calendly', 'list_upcoming_appointments')]:
    'Informar proxima reuniao; buscar por e-mail ou telefone do contato.',
  [buildToolKey('calendly', 'list_event_types')]: 'Listar tipos de evento da conta Calendly.',
  [buildToolKey('hubspot', 'lookup_contact')]: 'Buscar contato no CRM.',
  [buildToolKey('hubspot', 'create_contact')]: 'Criar contato no CRM.',
  [buildToolKey('hubspot', 'update_contact')]: 'Atualizar contato no CRM.',
  [buildToolKey('whatsapp', 'send_session_message')]: 'Enviar mensagem na sessao WhatsApp.',
  [buildToolKey('whatsapp', 'send_template')]: 'Enviar template WhatsApp aprovado.',
  [buildToolKey('email', 'send_email')]: 'Enviar e-mail pela integracao configurada.',
}

export function buildRuntimeIntegrationToolsSection(
  features: AgentExtraFeaturesV2 | null
): string {
  const enabled = getEnabledTools(features)
  if (enabled.length === 0) return ''

  const catalog = listIntegrationToolkitCatalog()
  const catalogByKey = new Map(catalog.map((t) => [t.toolKey || buildToolKey(t.provider, t.toolName), t]))

  const lines = enabled.map((tool) => {
    const key = tool.toolKey || buildToolKey(tool.provider, tool.toolName)
    const meta = catalogByKey.get(key)
    const hint = TOOL_USAGE_HINTS[key] || meta?.description || ''
    const integrationNote = tool.integrationId
      ? `integracao: ${tool.integrationId}`
      : tool.crmIntegrationId
        ? `CRM: ${tool.crmIntegrationId}`
        : ''
    const configNote = tool.config?.specialty ? `specialty: ${tool.config.specialty}` : ''
    const extras = [integrationNote, configNote].filter(Boolean).join(', ')
    return `- ${key} (${meta?.displayName || tool.toolName}): ${hint}${extras ? ` [${extras}]` : ''}`
  })

  const actionBlock = buildIntegrationToolLlmActionBlock(features)
  const tail = actionBlock
    ? actionBlock
    : 'Para acionar uma ferramenta, conduza o dialogo e siga as regras do template; o motor executa Calendly/CRM quando o fluxo exigir.'

  return [
    'FERRAMENTAS ATIVAS NESTE AGENTE (gerado automaticamente — use conforme o papel do template acima):',
    ...lines,
    '',
    tail,
  ].join('\n')
}

/** Instrucoes JSON para o LLM executar ferramentas (modo template, sem motor coordinator). */
export const INTEGRATION_TOOL_LLM_ACTION_BLOCK = `
FORMATO JSON COM FERRAMENTAS ATIVAS:
- action "reply": resposta normal ao usuario. tool_key e tool_payload devem ser null.
- action "integration_tool": executar Calendly somente quando ja tiver os dados necessarios (ex.: preferredDate apos o cliente dizer o dia).
  - tool_key: ex. calendly.check_availability (obrigatorio)
  - tool_payload: string JSON com parametros (integrationId e specialty preenchidos automaticamente se omitidos)
  - message: APENAS o resultado para o usuario (horario livre, ocupado, confirmado). PROIBIDO: "vou verificar", "consultando", "aguarde", "um momento".
- check_availability: so apos dia informado pelo cliente; nunca na saudacao nem ao dizer "quero agendar" sem dia/horario.
- Nunca invente horarios confirmados; use check_availability antes de book_appointment.
`.trim()

export function buildIntegrationToolLlmActionBlock(features: AgentExtraFeaturesV2 | null): string {
  if (getEnabledTools(features).length === 0) return ''
  if (useSchedulingCoordinatorEngine(features)) return ''
  return INTEGRATION_TOOL_LLM_ACTION_BLOCK
}

export function buildAgentSystemPromptSections(input: {
  personalityPrompt?: string | null
  templateRole?: string | null
  primaryLanguage?: string | null
  extraFeaturesRaw?: unknown
}): string[] {
  const features = parseAgentExtraFeatures(input.extraFeaturesRaw)
  const personality = String(input.personalityPrompt || '').trim()
  const templateRole = String(input.templateRole || '').trim()
  const runtimeTools = buildRuntimeIntegrationToolsSection(features)

  const parts: string[] = []
  if (personality) parts.push(personality)
  if (templateRole) parts.push(templateRole)
  if (runtimeTools) parts.push(runtimeTools)

  return parts
}

export function useSchedulingCoordinatorEngine(features: AgentExtraFeaturesV2 | null): boolean {
  if (!resolveSchedulingConfig(features)) return false
  return features?.scheduling_engine === 'coordinator'
}
