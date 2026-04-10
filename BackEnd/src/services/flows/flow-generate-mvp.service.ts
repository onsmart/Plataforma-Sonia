import '../../lib/env'
import { randomInt } from 'node:crypto'
import { supabase } from '../../lib/supabase'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import { chatText } from '../llm/openai'
import logger from '../../lib/logger'
import { canCreateAgent, getPlanInfo } from '../../utils/plan-helper'
import { getActiveAgentCount } from '../usage-tracker.service'
import { normalizeAgentLanguageCode } from '../../utils/agent-language'

export type RefinementProvider = 'openai' | 'claude' | 'none'

export interface FlowGenerateMvpPayload {
  startNodeId: string
  nodes: Record<string, unknown>[]
  edges: { source: string; target: string; sourceHandle?: string }[]
}

export type FlowGenerationMode = 'single_agent' | 'structured' | 'simple'

export interface FlowGenerateMvpResponse {
  refinedDescription: string
  refinementProvider: RefinementProvider
  flow: FlowGenerateMvpPayload
  resourceChoice: {
    executionMode: 'template' | 'agent'
    templateId: string | null
    templateName: string | null
    agentId: string | null
    agentName: string | null
    nodeLabel: string
    additionalInstructions: string
  }
  generationMode: FlowGenerationMode
  suggestedFlowName?: string | null
  structureSummary?: string | null
  /** Recursos criados no banco (modelos de papel em tb_agents_templates + agentes em tb_agents). */
  createdResources?: {
    roleTemplateNames: string[]
    agentNames: string[]
  }
}

const STRUCTURED_MODEL = process.env.FLOW_GENERATE_STRUCTURED_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini'
/** Tamanho mínimo do texto do template conversacional gerado pelo plano (caracteres). */
const MIN_CONVERSATION_TEMPLATE_CHARS = 400
/** Prefixo exibido em nomes de recursos criados pelo “Criar fluxo com IA”. */
const FLOW_IA_PREFIX = '[FLUXO IA]'

function getRefinerPreference(): 'openai' | 'claude' | 'none' {
  const v = (process.env.FLOW_DESCRIPTION_REFINER || 'openai').toLowerCase().trim()
  if (v === 'none' || v === 'off' || v === 'false') return 'none'
  if (v === 'claude' || v === 'anthropic' || v === 'google' || v === 'gemini') return 'claude'
  return 'openai'
}

function unwrapRpcId(data: unknown): string {
  if (data == null) throw new Error('RPC retornou vazio')
  if (typeof data === 'string' && data.length > 0) return data
  if (typeof data === 'object' && data !== null && 'id' in data && typeof (data as { id: unknown }).id === 'string') {
    return (data as { id: string }).id
  }
  if (Array.isArray(data) && data.length > 0) {
    const row = data[0] as { id?: string }
    if (row?.id) return row.id
  }
  throw new Error(`Resposta RPC inesperada: ${JSON.stringify(data).slice(0, 200)}`)
}

async function refineDescriptionWithOpenAI(rawDescription: string, language: string): Promise<string | null> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const system = `You improve short user descriptions for building ONE WhatsApp/chat agent with a single detailed template (linear flow: start → agent → end).
Output a single clear paragraph (3–8 sentences) in the locale ${language} (BCP-47).
Include: main goal, channel, tone, topics the agent must handle, scheduling/support links if any, and business rules.
Do not invent confidential data. Return ONLY the improved text, no quotes or markdown.`

  const res = await chatText({
    system,
    user: rawDescription,
    model,
    temperature: 0.35,
    maxTokens: 800,
  })
  if (!res.success || !res.content?.trim()) return null
  return res.content.trim()
}

function getAnthropicApiKey(): string | null {
  return (
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.CLAUDE_API_KEY?.trim() ||
    process.env.ANTHROPIC_AUTH_TOKEN?.trim() ||
    null
  )
}

function getAnthropicModel(): string {
  return (
    process.env.ANTHROPIC_MODEL?.trim() ||
    process.env.CLAUDE_MODEL?.trim() ||
    // Alias mantido pela Anthropic aponta para o Haiku 3.5 atual (evita ID datado inválido)
    'claude-3-5-haiku-latest'
  )
}

type ClaudeRefineOk = { ok: true; text: string }
type ClaudeRefineErr = { ok: false; status?: number; message: string }
type ClaudeRefineResult = ClaudeRefineOk | ClaudeRefineErr

function parseAnthropicErrorBody(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return 'Resposta vazia da API Anthropic.'
  try {
    const j = JSON.parse(trimmed) as { error?: { message?: string }; message?: string }
    const msg = j?.error?.message || j?.message
    if (typeof msg === 'string' && msg.length > 0) return msg
  } catch {
    /* ignore */
  }
  return trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed
}

const ANTHROPIC_FALLBACK_MODEL = 'claude-3-haiku-20240307'

function shouldRetryClaudeWithFallbackModel(status: number | undefined, message: string): boolean {
  if (status === 404) return true
  const m = message.toLowerCase()
  return (
    m.includes('model') &&
    (m.includes('not found') || m.includes('invalid') || m.includes('does not exist') || m.includes('unknown model'))
  )
}

async function claudeRefineWithModel(
  userText: string,
  system: string,
  logLabel: string,
  model: string
): Promise<ClaudeRefineResult> {
  const key = getAnthropicApiKey()
  if (!key) {
    return { ok: false, message: 'Chave Anthropic não configurada no servidor.' }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        temperature: 0.35,
        system,
        messages: [{ role: 'user', content: userText }],
      }),
    })

    const rawBody = await response.text().catch(() => '')

    if (!response.ok) {
      const message = parseAnthropicErrorBody(rawBody)
      logger.warn(`[${logLabel}] Claude HTTP ${response.status} (${model}):`, message.slice(0, 320))
      return { ok: false, status: response.status, message }
    }

    let json: {
      content?: { type: string; text?: string }[]
      error?: { message?: string }
    }
    try {
      json = JSON.parse(rawBody) as typeof json
    } catch {
      return { ok: false, status: response.status, message: 'Resposta JSON inválida da API Anthropic.' }
    }

    if (json.error?.message) {
      logger.warn(`[${logLabel}] Claude API error:`, json.error.message)
      return { ok: false, message: json.error.message }
    }
    const text =
      json.content?.map((b) => (b.type === 'text' ? b.text || '' : '')).join('') || ''
    const out = text.trim()
    if (!out) {
      return {
        ok: false,
        message:
          'O Claude não devolveu texto. Ajuste ANTHROPIC_MODEL ou CLAUDE_MODEL (ex.: claude-3-5-haiku-latest ou claude-3-haiku-20240307).',
      }
    }
    return { ok: true, text: out }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.warn(`[${logLabel}] Claude error:`, msg)
    return { ok: false, message: msg || 'Falha de rede ao contatar api.anthropic.com.' }
  }
}

/** True se a plataforma pode chamar a API Anthropic (botão “Melhorar descrição” no modal). */
export function isAnthropicConfiguredForFlowRefine(): boolean {
  return getAnthropicApiKey() !== null
}

async function claudeRefineWithSystem(
  userText: string,
  system: string,
  logLabel: string
): Promise<ClaudeRefineResult> {
  const primary = getAnthropicModel()
  const first = await claudeRefineWithModel(userText, system, logLabel, primary)
  if (first.ok) return first
  if (
    primary !== ANTHROPIC_FALLBACK_MODEL &&
    shouldRetryClaudeWithFallbackModel(first.status, first.message)
  ) {
    logger.warn(`[${logLabel}] Tentando modelo fallback: ${ANTHROPIC_FALLBACK_MODEL}`)
    return claudeRefineWithModel(userText, system, logLabel, ANTHROPIC_FALLBACK_MODEL)
  }
  return first
}

/**
 * Refino explícito no modal: texto mais rico para a IA que monta o fluxo (classificador, ramos, fallback).
 * Sempre via Claude; não altera o fluxo de refine interno do generate-mvp.
 */
export async function refineFlowDescriptionWithClaudeForGeneration(
  rawDescription: string,
  language: string
): Promise<ClaudeRefineResult> {
  const trimmed = rawDescription.trim()
  if (!trimmed) {
    return { ok: false, message: 'Descrição vazia.' }
  }

  const system = `You rewrite informal notes from non-technical business users into a detailed brief for another AI that will produce ONE conversational agent template and a linear flow (start → single agent → end).

Output one coherent text in the locale ${language} (BCP-47). Include: business context, channel (e.g. WhatsApp), main goal, tone, topics the agent must handle, scheduling/support links if the user gave any (full URLs), business rules, what not to promise, handoff to human when needed.

Do not invent prices, deadlines, or policies the user did not state. Return ONLY the improved brief, no preamble or quotes.`

  return claudeRefineWithSystem(trimmed, system, 'flow-refine-dialog')
}

async function refineDescriptionWithClaude(rawDescription: string, language: string): Promise<string | null> {
  const system = `You improve short user descriptions for building a chatbot flow.
Output a single clear paragraph (3–8 sentences) in the locale ${language} (BCP-47).
Return ONLY the improved text, no quotes or markdown.`
  const r = await claudeRefineWithSystem(rawDescription, system, 'flow-generate-mvp')
  return r.ok ? r.text : null
}

async function refineUserDescription(
  rawDescription: string,
  language: string
): Promise<{ text: string; provider: RefinementProvider }> {
  const preference = getRefinerPreference()

  if (preference === 'none') {
    return { text: rawDescription.trim(), provider: 'none' }
  }

  if (preference === 'claude') {
    const c = await refineDescriptionWithClaude(rawDescription, language)
    if (c) return { text: c, provider: 'claude' }
    const o = await refineDescriptionWithOpenAI(rawDescription, language)
    if (o) return { text: o, provider: 'openai' }
    return { text: rawDescription.trim(), provider: 'none' }
  }

  const o = await refineDescriptionWithOpenAI(rawDescription, language)
  if (o) return { text: o, provider: 'openai' }
  const c = await refineDescriptionWithClaude(rawDescription, language)
  if (c) return { text: c, provider: 'claude' }
  return { text: rawDescription.trim(), provider: 'none' }
}

/** Plano: um único template conversacional denso + metadados (fluxo linear na plataforma). */
interface LlmSingleAgentPlanRaw {
  suggestedFlowName?: string
  structureSummary?: string
  /** Texto completo do modelo de papel (preferido). */
  conversationTemplate?: string
  /** Legado / alias de conversationTemplate. */
  brainPrompt?: string
  /** Nome curto opcional para o agente (ex.: "Sonia Atendimento"). */
  agentDisplayName?: string
}

function parseSingleAgentPlan(raw: string): LlmSingleAgentPlanRaw | null {
  try {
    return JSON.parse(raw) as LlmSingleAgentPlanRaw
  } catch {
    return null
  }
}

/** Código curto por execução (letras), para desambiguar recriações sem timestamps longos. */
function makeFlowIaRunTag(): string {
  const alphabet = 'bdfghjkmnpqrstvwxyz'
  let s = ''
  for (let i = 0; i < 4; i++) {
    s += alphabet[randomInt(alphabet.length)]
  }
  return s
}

function flowIaAgentName(displayName: string, runTag: string): string {
  const clean = String(displayName || 'Agente').trim().slice(0, 100) || 'Agente'
  const tag = String(runTag || 'xxxx').trim().slice(0, 48)
  return `${FLOW_IA_PREFIX} ${clean} · ${tag}`.slice(0, 200)
}

/** Nome padrão de template: [FLUXO IA] {fluxo} - {quem consome} (máx. 200 para RPC). */
function buildFlowIaTemplateName(flowDisplayName: string, consumerName: string): string {
  const sanitize = (s: string, max: number) => {
    const t = String(s || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max)
    return t || '—'
  }
  const prefix = `${FLOW_IA_PREFIX} `
  const sep = ' - '
  const maxTotal = 200
  let flowPart = sanitize(flowDisplayName, 120)
  let consumerPart = sanitize(consumerName, 120)
  let out = `${prefix}${flowPart}${sep}${consumerPart}`
  if (out.length <= maxTotal) return out
  const budget = maxTotal - prefix.length - sep.length
  const half = Math.max(24, Math.floor(budget / 2))
  flowPart = flowPart.slice(0, half)
  consumerPart = consumerPart.slice(0, budget - flowPart.length)
  out = `${prefix}${flowPart}${sep}${consumerPart}`
  return out.slice(0, maxTotal)
}

async function rpcCreateAgentTemplate(
  email: string,
  name: string,
  role: string,
  description: string
): Promise<string> {
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
  if (error) throw new Error(`Criar modelo de papel: ${error.message}`)
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
  if (error) throw new Error(`Criar agente: ${error.message}`)
  return unwrapRpcId(data)
}

function buildAgentNodeData(params: {
  label: string
  agentId: string
  agentName: string
  additionalInstructions?: string
  skipReplyConfidence?: boolean
}): Record<string, unknown> {
  return {
    label: params.label,
    executionMode: 'agent',
    templateId: '',
    templateName: '',
    agentId: params.agentId,
    agentName: params.agentName,
    additionalInstructions: params.additionalInstructions || '',
    bio: null,
    skipReplyConfidence: params.skipReplyConfidence === true,
  }
}

/** Fluxo linear: Início → um agente → Fim (recomendado para assertividade). */
function buildLinearAgentFlow(params: {
  agentId: string
  agentName: string
  nodeLabel: string
}): FlowGenerateMvpPayload {
  const startId = 'n-start'
  const agentNodeId = 'n-agent'
  const stopId = 'n-stop'
  const x = 420
  return {
    startNodeId: startId,
    nodes: [
      { id: startId, type: 'start', position: { x, y: 72 }, data: { label: 'Início' } },
      {
        id: agentNodeId,
        type: 'agent',
        position: { x, y: 200 },
        data: buildAgentNodeData({
          label: params.nodeLabel,
          agentId: params.agentId,
          agentName: params.agentName,
          additionalInstructions: '',
          skipReplyConfidence: false,
        }),
      },
      { id: stopId, type: 'stop', position: { x, y: 352 }, data: { label: 'Fim' } },
    ],
    edges: [
      { source: startId, target: agentNodeId },
      { source: agentNodeId, target: stopId },
    ],
  }
}

function appendSingleAgentTemplateFooter(templateBody: string, language: string): string {
  const core = templateBody.trim()
  const isPt = language.toLowerCase().startsWith('pt')
  const footer = isPt
    ? `

---
PLATAFORMA SONIA (WhatsApp / atendimento):
- Voce e UM unico assistente: todo roteamento, opcoes e tom estao neste modelo; nao mencione fluxo, classificador, nos ou IA interna.
- Na primeira mensagem do usuario (ex.: saudacao curta), cumprimente e, se este modelo definir opcoes ou temas, apresente de forma breve e legivel no celular.
- Mensagens curtas quando possivel; toda URL deve ser completa (https://...), nunca [link] ou [URL] sem o endereco real.
- Se o usuario nao seguir opcoes numeradas, interprete a intencao e continue sem travar; em duvida, peca um esclarecimento curto.
- Ao agendar ou enviar Calendly/link: seja educado, envie o link claro, agradeca e encerre com elegancia quando fizer sentido.`
    : `

---
Sonia platform: Single assistant; natural WhatsApp tone; full URLs only; no internal jargon; handle off-script users gracefully.`
  return `${core}${footer}`.slice(0, 32000)
}

async function generateSingleAgentConversationPlanWithOpenAI(
  refinedDescription: string,
  language: string
): Promise<LlmSingleAgentPlanRaw | null> {
  const system = `You are a senior designer of production-ready conversational agent templates for WhatsApp customer service.
The platform Sonia will create: (1) ONE agent template (long system-style instructions) and (2) ONE agent linked to it, in a linear flow Start → Agent → End. There are NO classifier nodes and NO if-else branches in the canvas—all scenarios live inside the single template.

Output ONLY valid JSON (no markdown). Write the main content in the locale ${language} (BCP-47).

The field "conversationTemplate" must be the FULL template text the agent will follow, structured with clear titled sections in this order (use headings exactly as below, in the output language):
1. NOME DO AGENTE
2. FUNCAO DO AGENTE
3. MISSAO PRINCIPAL
4. CONTEXTO DE USO
5. TOM DE VOZ
6. REGRAS GERAIS
7. FLUXO PRINCIPAL (how the chat starts, options, what happens on each path, how to continue and close)
8. REGRAS DE DECISAO
9. TRATAMENTO DE RESPOSTAS FORA DO FLUXO
10. MENSAGENS EXATAS IMPORTANTES (e.g. scheduling handoff — with REAL full URLs if the user provided any; never [link] placeholders)
11. EXEMPLOS DE CONVERSA (user line / ideal agent line)
12. CRITERIOS DE QUALIDADE

Principles to embed in conversationTemplate:
- Clear role, scope, channel WhatsApp, mission.
- Short, natural messages; numbered options only when helpful; mobile-first reading.
- Explicit rules: language, no invented facts, clarify when confused, confirm next steps when needed.
- Deviation handling: vague message, direct question, scheduling without picking an option, confusion, user wants to keep chatting.
- Controlled, polite closings.
- Quality: organized, unambiguous, non-contradictory, not overly technical for WhatsApp.

Also set:
- "suggestedFlowName": short title for the flow.
- "structureSummary": one sentence (e.g. "Fluxo linear com um agente e template unico detalhado").
- "agentDisplayName" (optional): short public-facing agent name.

JSON shape:
{
  "suggestedFlowName": string,
  "structureSummary": string,
  "conversationTemplate": string,
  "agentDisplayName": string (optional)
}`

  const res = await chatText({
    system,
    user: `Business / service scenario to turn into the template:\n${refinedDescription}`,
    model: STRUCTURED_MODEL,
    temperature: 0.3,
    maxTokens: 16000,
    responseFormat: { type: 'json_object' },
  })

  if (!res.success || !res.content) {
    logger.warn('[flow-generate-mvp] single-agent plan LLM failed', res.error)
    return null
  }
  return parseSingleAgentPlan(res.content)
}

/**
 * Gera fluxo linear: 1 template conversacional detalhado + 1 agente ligado a ele (Início → Agente → Fim).
 */
export async function generateMvpFlowFromDescription(
  userEmail: string,
  rawDescription: string,
  language: string
): Promise<FlowGenerateMvpResponse> {
  const lang = language || 'pt-BR'
  const companiesId = await getCompanyIdByEmail(userEmail)
  if (!companiesId) {
    throw new Error('Empresa não encontrada para o usuário.')
  }

  const { text: refinedDescription, provider: refinementProvider } = await refineUserDescription(
    rawDescription,
    lang
  )

  const planCheck = await canCreateAgent(companiesId)
  if (!planCheck.allowed) {
    throw new Error(planCheck.reason || 'Não é possível criar agentes no plano atual.')
  }

  const plan = await generateSingleAgentConversationPlanWithOpenAI(refinedDescription, lang)
  const templateRaw = String(plan?.conversationTemplate || plan?.brainPrompt || '').trim()
  if (!plan || templateRaw.length < MIN_CONVERSATION_TEMPLATE_CHARS) {
    throw new Error(
      'Não foi possível gerar o template conversacional com a IA. Tente uma descrição mais detalhada do negócio e do atendimento desejado.'
    )
  }

  const totalNewAgents = 1
  const activeCount = await getActiveAgentCount(companiesId)
  const planInfo = await getPlanInfo(companiesId)
  const limit = planInfo.limits.agents

  if (limit !== null && activeCount + totalNewAgents > limit) {
    throw new Error(
      `Este rascunho precisa criar ${totalNewAgents} agente novo, mas seu plano permite apenas ${limit} ativo(s) (${activeCount} em uso). Faça upgrade ou desative agentes antigos.`
    )
  }

  const runTag = makeFlowIaRunTag()
  const flowDisplayName = (plan.suggestedFlowName?.trim() || 'Fluxo').slice(0, 120)
  const roleFull = appendSingleAgentTemplateFooter(templateRaw, lang)

  const templateName = buildFlowIaTemplateName(flowDisplayName, 'Assistente (modelo único)')
  const templateId = await rpcCreateAgentTemplate(
    userEmail,
    templateName,
    roleFull,
    plan.structureSummary?.trim().slice(0, 800) ||
      'Template conversacional único gerado por Criar fluxo com IA (fluxo linear).'
  )

  const agentBaseName = String(plan.agentDisplayName || 'Assistente').trim().slice(0, 80) || 'Assistente'
  const agentNome = flowIaAgentName(agentBaseName, runTag)
  const agentBio =
    `Atendimento alinhado ao modelo «${flowDisplayName}». Responde no canal configurado; segue o template vinculado.`.slice(
      0,
      800
    )

  const agentId = await rpcCreateAgent(userEmail, agentNome, templateId, lang, agentBio)

  const flow = buildLinearAgentFlow({
    agentId,
    agentName: agentNome,
    nodeLabel: agentBaseName,
  })

  return {
    refinedDescription,
    refinementProvider,
    flow,
    resourceChoice: {
      executionMode: 'agent',
      templateId,
      templateName,
      agentId,
      agentName: agentNome,
      nodeLabel: agentBaseName,
      additionalInstructions: '',
    },
    generationMode: 'single_agent',
    suggestedFlowName: plan.suggestedFlowName?.trim() || null,
    structureSummary:
      plan.structureSummary?.trim() ||
      'Fluxo linear: um agente com template único detalhado (sem classificador nem ramos no canvas).',
    createdResources: {
      roleTemplateNames: [templateName],
      agentNames: [agentNome],
    },
  }
}
