import { supabase } from '../../lib/supabase'
import { normalizeAgentLanguageCode } from '../../utils/agent-language'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import type { FlowData, FlowNode } from './flow.types'

type SupportedLanguage = 'pt-BR' | 'en-US' | string

export interface TestFlowGeneratedAgent {
  key: 'classifier' | 'commercial' | 'support' | 'financial'
  id: string
  name: string
  bio: string
  additionalInstructions: string
}

export interface GenerateConditionalSwitchTestFlowResult {
  flowId: string
  flowName: string
  templateId: string
  templateName: string
  templateDescription: string
  agents: TestFlowGeneratedAgent[]
  flow: FlowData
}

function unwrapRpcId(data: unknown): string {
  if (typeof data === 'string' && data.trim()) return data.trim()
  if (typeof data === 'object' && data && 'id' in data && typeof (data as { id?: unknown }).id === 'string') {
    return String((data as { id: string }).id).trim()
  }
  throw new Error('Resposta RPC sem ID válido.')
}

function buildTimestampSuffix(now = new Date()): string {
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  return `${yyyy}${mm}${dd}-${hh}${mi}`
}

function buildTemplateContent(language: SupportedLanguage): string {
  if (String(language).trim().toLowerCase() === 'en-us') {
    return `1. ROLE
You are a shared operational template used by four test agents inside Sonia flows.

2. GOAL
Follow the current step of the flow and continue from the latest conversation state without restarting the journey.

3. FLOW STATE
Always read and respect these context keys when available:
- current_stage
- intent_detected
- intent
- route_reason
- customer_name
- last_response
- message
- userMessage
- originalMessage

4. PRIORITY
Follow this order:
- First: the node additional instructions.
- Second: the current flow state.
- Third: the shared rules in this template.

5. GLOBAL RULES
- Never pretend the conversation is starting again if the flow already advanced.
- Keep answers short, practical, and appropriate for WhatsApp.
- If the flow is missing information, ask only one focused question at a time.
- Do not invent policies, prices, deadlines, or links.
- If intent_detected is false, help the user clarify the request before moving on.

6. HANDOFF CONTRACT
- Continue from the current situation.
- Mention only what is useful for the next step.
- Avoid repeating long greetings or full menus after the first turn.
- If the agent is a classifier, output only the JSON requested in the node instructions.

7. OUTPUT QUALITY
- Be objective.
- Use natural language.
- Keep continuity with the latest state.
- Prefer the next best action over generic explanations.`
  }

  return `1. PAPEL
Você é um template operacional compartilhado por quatro agentes de teste dentro dos fluxos da Sonia.

2. OBJETIVO
Seguir o passo atual do fluxo e continuar a conversa a partir do estado mais recente, sem reiniciar o atendimento.

3. ESTADO DO FLUXO
Leia e respeite sempre estas chaves do contexto quando existirem:
- current_stage
- intent_detected
- intent
- route_reason
- customer_name
- last_response
- message
- userMessage
- originalMessage

4. ORDEM DE PRIORIDADE
Siga esta ordem:
- Primeiro: as instruções adicionais do nó atual.
- Segundo: o estado atual do fluxo.
- Terceiro: as regras compartilhadas deste template.

5. REGRAS GERAIS
- Nunca aja como se a conversa estivesse começando de novo se o fluxo já avançou.
- Responda de forma curta, prática e adequada para WhatsApp.
- Se faltar contexto, faça apenas uma pergunta objetiva por vez.
- Não invente políticas, preços, prazos ou links.
- Se intent_detected for false, ajude o usuário a esclarecer a necessidade antes de avançar.

6. CONTRATO DE CONTINUIDADE
- Prossiga a partir da situação atual.
- Mencione somente o que for útil para o próximo passo.
- Evite repetir saudação longa ou menu completo depois da primeira interação.
- Se o agente atual for classificador, devolva apenas o JSON pedido nas instruções do nó.

7. QUALIDADE DA SAÍDA
- Seja objetivo.
- Use linguagem natural.
- Preserve continuidade com o estado mais recente.
- Prefira indicar a próxima melhor ação em vez de explicações genéricas.`
}

function buildTemplateName(flowName: string): string {
  return `[TESTE FLUXO] ${flowName} - Template Compartilhado`.slice(0, 200)
}

function buildAgentNodeData(params: {
  label: string
  agentId: string
  agentName: string
  templateId: string
  templateName: string
  additionalInstructions: string
  skipReplyConfidence?: boolean
}): FlowNode['data'] {
  return {
    label: params.label,
    executionMode: 'template',
    templateId: params.templateId,
    templateName: params.templateName,
    agentId: params.agentId,
    agentName: params.agentName,
    additionalInstructions: params.additionalInstructions,
    bio: null,
    skipReplyConfidence: params.skipReplyConfidence === true,
  }
}

export function buildConditionalSwitchTestFlowPreset(params: {
  templateId: string
  templateName: string
  agents: TestFlowGeneratedAgent[]
}): FlowData {
  const classifier = params.agents.find((agent) => agent.key === 'classifier')
  const commercial = params.agents.find((agent) => agent.key === 'commercial')
  const support = params.agents.find((agent) => agent.key === 'support')
  const financial = params.agents.find((agent) => agent.key === 'financial')

  if (!classifier || !commercial || !support || !financial) {
    throw new Error('Preset incompleto: os quatro agentes são obrigatórios.')
  }

  const startId = 'n-start'
  const classifierId = 'n-classifier'
  const conditionId = 'n-intent-detected'
  const switchId = 'n-intent-switch'
  const commercialId = 'n-commercial'
  const supportId = 'n-support'
  const financialId = 'n-financial'
  const stopId = 'n-stop'

  return {
    startNodeId: startId,
    nodes: [
      {
        id: startId,
        type: 'start',
        position: { x: 520, y: 40 },
        data: { label: 'Início' },
      },
      {
        id: classifierId,
        type: 'agent',
        position: { x: 520, y: 180 },
        data: buildAgentNodeData({
          label: 'Agente Classificador',
          agentId: classifier.id,
          agentName: classifier.name,
          templateId: params.templateId,
          templateName: params.templateName,
          additionalInstructions: classifier.additionalInstructions,
          skipReplyConfidence: true,
        }),
      },
      {
        id: conditionId,
        type: 'if-else',
        position: { x: 520, y: 340 },
        data: {
          label: 'Intento identificado?',
          branchField: 'custom',
          branchCustomField: 'intent_detected',
          ifValue: 'true,sim,yes,1',
          elseLabel: 'Precisa esclarecer',
        },
      },
      {
        id: switchId,
        type: 'switch',
        position: { x: 520, y: 520 },
        data: {
          label: 'Rotear intenção',
          branchField: 'intent',
          switchCases: [
            { id: 'commercial', label: 'Comercial', value: 'comercial,vendas,orcamento,preco' },
            { id: 'support', label: 'Suporte', value: 'suporte,duvida,ajuda,problema' },
            { id: 'financial', label: 'Financeiro', value: 'financeiro,boleto,pagamento,cobranca' },
          ],
          switchDefaultLabel: 'Outros',
        },
      },
      {
        id: commercialId,
        type: 'agent',
        position: { x: 180, y: 760 },
        data: buildAgentNodeData({
          label: 'Agente Comercial',
          agentId: commercial.id,
          agentName: commercial.name,
          templateId: params.templateId,
          templateName: params.templateName,
          additionalInstructions: commercial.additionalInstructions,
        }),
      },
      {
        id: supportId,
        type: 'agent',
        position: { x: 520, y: 760 },
        data: buildAgentNodeData({
          label: 'Agente de Suporte',
          agentId: support.id,
          agentName: support.name,
          templateId: params.templateId,
          templateName: params.templateName,
          additionalInstructions: support.additionalInstructions,
        }),
      },
      {
        id: financialId,
        type: 'agent',
        position: { x: 860, y: 760 },
        data: buildAgentNodeData({
          label: 'Agente Financeiro',
          agentId: financial.id,
          agentName: financial.name,
          templateId: params.templateId,
          templateName: params.templateName,
          additionalInstructions: financial.additionalInstructions,
        }),
      },
      {
        id: stopId,
        type: 'stop',
        position: { x: 520, y: 980 },
        data: { label: 'Fim' },
      },
    ],
    edges: [
      { source: startId, target: classifierId },
      { source: classifierId, target: conditionId },
      { source: conditionId, target: switchId, sourceHandle: 'true' },
      { source: conditionId, target: supportId, sourceHandle: 'false' },
      { source: switchId, target: commercialId, sourceHandle: 'case:commercial' },
      { source: switchId, target: supportId, sourceHandle: 'case:support' },
      { source: switchId, target: financialId, sourceHandle: 'case:financial' },
      { source: switchId, target: supportId, sourceHandle: 'default' },
      { source: commercialId, target: stopId },
      { source: supportId, target: stopId },
      { source: financialId, target: stopId },
    ],
  }
}

function buildAgentDrafts(flowName: string): Array<Omit<TestFlowGeneratedAgent, 'id'>> {
  return [
    {
      key: 'classifier',
      name: `[TESTE] ${flowName} - Classificador`.slice(0, 120),
      bio: 'Classifica a intenção e atualiza o estado do fluxo com JSON estruturado.',
      additionalInstructions:
        `Você é o classificador inicial deste fluxo de teste. Analise a mensagem atual e devolva apenas JSON válido.
Use exatamente estas chaves:
{
  "intent_detected": boolean,
  "intent": "comercial" | "suporte" | "financeiro" | "",
  "route_reason": string,
  "current_stage": string
}
Regras:
- Se a intenção estiver clara, marque intent_detected como true.
- Se não estiver clara, marque intent_detected como false, deixe intent vazio e current_stage como "aguardando_esclarecimento".
- Nunca escreva texto fora do JSON.`,
    },
    {
      key: 'commercial',
      name: `[TESTE] ${flowName} - Comercial`.slice(0, 120),
      bio: 'Conduz cenários de vendas, orçamento e apresentação de proposta.',
      additionalInstructions:
        'Você é o agente comercial deste fluxo de teste. Continue do estado atual, responda de forma consultiva e avance a conversa para proposta, demonstração ou orçamento. Atualize mentalmente o current_stage e evite reiniciar a abordagem.',
    },
    {
      key: 'support',
      name: `[TESTE] ${flowName} - Suporte`.slice(0, 120),
      bio: 'Assume dúvidas gerais, suporte e também fallback quando a intenção ainda está ambígua.',
      additionalInstructions:
        'Você é o agente de suporte e fallback deste fluxo de teste. Se intent_detected for false, faça uma única pergunta curta para esclarecer. Se intent for suporte, ajude com orientação objetiva e prossiga da situação atual.',
    },
    {
      key: 'financial',
      name: `[TESTE] ${flowName} - Financeiro`.slice(0, 120),
      bio: 'Atende pagamentos, boletos, cobrança e negociações financeiras.',
      additionalInstructions:
        'Você é o agente financeiro deste fluxo de teste. Continue do estágio atual e trate segunda via, pagamento, cobrança ou negociação com linguagem objetiva, sem repetir menus anteriores.',
    },
  ]
}

async function rpcCreateAgentTemplate(email: string, name: string, role: string, description: string): Promise<string> {
  const { data, error } = await supabase.rpc('sp_create_agent_template', {
    p_name: name.slice(0, 200),
    p_role: role.slice(0, 32000),
    p_description: description.slice(0, 800),
    p_icon: 'bot',
    p_complexity: 'Intermediate',
    p_channel_names: ['whatsapp', 'webchat'],
    p_skill_names: [],
    p_email: email,
  })

  if (error) {
    throw new Error(`Criar template compartilhado: ${error.message}`)
  }

  return unwrapRpcId(data)
}

async function rpcCreateAgent(
  email: string,
  nome: string,
  roleTemplateId: string,
  primaryLanguage: string,
  bio: string
): Promise<string> {
  const { data, error } = await supabase.rpc('sp_create_agent_by_email', {
    p_email: email,
    p_nome: nome.slice(0, 120),
    p_role_template_id: roleTemplateId,
    p_primary_language: normalizeAgentLanguageCode(primaryLanguage, 'pt-BR'),
    p_bio: bio.slice(0, 800),
    p_integrations_id: null,
  })

  if (error) {
    throw new Error(`Criar agente "${nome}": ${error.message}`)
  }

  return unwrapRpcId(data)
}

export async function generateConditionalSwitchTestFlow(
  userEmail: string,
  options?: {
    language?: SupportedLanguage
    flowName?: string
  }
): Promise<GenerateConditionalSwitchTestFlowResult> {
  const normalizedLanguage = normalizeAgentLanguageCode(options?.language || 'pt-BR', 'pt-BR')
  const baseName = String(options?.flowName || '').trim() || `Fluxo Teste Condicional + Múltiplas Opções ${buildTimestampSuffix()}`
  const templateName = buildTemplateName(baseName)
  const templateDescription =
    'Template compartilhado de teste para 4 agentes com continuidade de contexto, condicional e bloco de múltiplas opções.'

  const companiesId = await getCompanyIdByEmail(userEmail)
  if (!companiesId) {
    throw new Error('Empresa não encontrada para o usuário autenticado.')
  }

  const templateId = await rpcCreateAgentTemplate(
    userEmail,
    templateName,
    buildTemplateContent(normalizedLanguage),
    templateDescription
  )

  const agents: TestFlowGeneratedAgent[] = []
  for (const draft of buildAgentDrafts(baseName)) {
    const agentId = await rpcCreateAgent(userEmail, draft.name, templateId, normalizedLanguage, draft.bio)
    agents.push({ ...draft, id: agentId })
  }

  const flow = buildConditionalSwitchTestFlowPreset({
    templateId,
    templateName,
    agents,
  })

  const { data, error } = await supabase
    .from('tb_flows')
    .insert({
      name: baseName,
      nodes: flow,
      user_email: userEmail,
      companies_id: companiesId,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new Error(`Salvar fluxo de teste: ${error?.message || 'falha ao persistir fluxo'}`)
  }

  return {
    flowId: String(data.id),
    flowName: baseName,
    templateId,
    templateName,
    templateDescription,
    agents,
    flow,
  }
}
