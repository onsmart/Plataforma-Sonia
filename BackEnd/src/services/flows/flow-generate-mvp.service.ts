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

export type FlowGenerationMode = 'structured' | 'simple'

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

const MAX_STRUCTURED_BRANCHES = 4
const STRUCTURED_MODEL = process.env.FLOW_GENERATE_STRUCTURED_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini'
const FLOW_IA_PREFIX = '[Fluxo IA]'

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
  const system = `You improve short user descriptions for building a chatbot flow for non-technical business users.
Output a single clear paragraph (3–8 sentences) in the locale ${language} (BCP-47).
Include: main goal, channel if implied, tone, distinct intents/topics, and business rules.
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

  const system = `You rewrite informal notes from non-technical business users into a detailed brief for another AI that will design an automated customer-service flow: an intent classifier, separate branches per topic, and a fallback path.

Output one coherent text in the locale ${language} (BCP-47). Prefer a short paragraph plus, if useful, a few lines starting with "•" for distinct intents (no markdown headings, no code fences). The tone of the brief should stay simple for laypeople, but include enough detail for flow design: business context if given, channel (e.g. WhatsApp), main goal, tone of voice, distinct intents or topics to branch, business rules (hours, what not to promise), and when to hand off to a human.

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

/** Plano: um único “cérebro” (template) + lista de intenções; ramos usam o mesmo modelo. */
interface LlmUnifiedPlanRaw {
  suggestedFlowName?: string
  structureSummary?: string
  brainPrompt?: string
  intents?: Array<{ intent?: string; label?: string }>
  classifierHints?: string
}

function parseUnifiedPlan(raw: string): LlmUnifiedPlanRaw | null {
  try {
    return JSON.parse(raw) as LlmUnifiedPlanRaw
  } catch {
    return null
  }
}

function slugifyIntent(raw: string): string {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
  return s || 'topico'
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

function flowIaTemplateName(displayName: string, runTag: string): string {
  const clean = String(displayName || 'Agente').trim().slice(0, 88) || 'Agente'
  const tag = String(runTag || 'xxxx').trim().slice(0, 48)
  return `${FLOW_IA_PREFIX} ${clean} · modelo · ${tag}`.slice(0, 200)
}

function classifierJsonSuffix(intents: string[], language: string): string {
  const list = [...new Set([...intents, 'outros'])].join(', ')
  const isPt = language.toLowerCase().startsWith('pt')
  if (isPt) {
    return `

--- FORMATO OBRIGATORIO NA PLATAFORMA SONIA ---
Voce DEVE responder usando action "reply". No campo "message" coloque APENAS (sem markdown, sem texto antes ou depois) um JSON em UMA linha:
{"intent":"<token>"}
Onde <token> e exatamente um destes valores em minusculas: ${list}
Use "outros" quando nenhuma outra opcao servir.
Nao escreva nada alem desse JSON dentro de "message".`
  }
  return `

--- REQUIRED SONIA PLATFORM FORMAT ---
You MUST respond with action "reply". In "message" put ONLY (no markdown) a one-line JSON:
{"intent":"<token>"}
where <token> is exactly one of: ${list}
Use "outros" when nothing else fits.`
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

async function updateAgentRuntime(agentId: string, companiesId: string, personalityPrompt: string): Promise<void> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const { error } = await supabase
    .from('tb_agents')
    .update({
      personality_prompt: personalityPrompt.slice(0, 32000),
      provider: 'openai',
      provider_model: model,
      temperature: 0.45,
      max_tokens: 1600,
    })
    .eq('id', agentId)
    .eq('companies_id', companiesId)

  if (error) {
    logger.warn('[flow-generate-mvp] Falha ao atualizar runtime do agente:', error.message)
  }
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

function buildTemplateNodeData(params: {
  label: string
  templateId: string
  templateName: string
  additionalInstructions: string
  skipReplyConfidence?: boolean
}): Record<string, unknown> {
  return {
    label: params.label,
    executionMode: 'template',
    templateId: params.templateId,
    templateName: params.templateName,
    agentId: '',
    agentName: '',
    additionalInstructions: params.additionalInstructions,
    bio: null,
    skipReplyConfidence: params.skipReplyConfidence === true,
  }
}

function buildUnifiedClassifierRole(language: string, intentTokens: string[], hints?: string): string {
  const list = intentTokens.join(', ')
  const hint = hints?.trim()
  const isPt = language.toLowerCase().startsWith('pt')
  const head = isPt
    ? `Voce e um classificador INTERNO da plataforma. Sua unica funcao e escolher UMA intencao tecnica para a mensagem mais recente do usuario.

PROIBIDO na saida: saudacoes, explicacoes, perguntas ao usuario, textos "digite 1 ou 2" ou menus numerados, qualquer mensagem em linguagem natural destinada ao usuario final. Apenas o JSON em uma linha e processado pelo sistema.

Intencoes permitidas (use exatamente o token): ${list}, outros.

${hint ? `Contexto do negocio (nao repetir ao usuario): ${hint}\n` : ''}`
    : `Internal classifier only. No greetings or menus. Allowed intent tokens: ${list}, outros.
${hint ? `Context: ${hint}\n` : ''}`
  return head + classifierJsonSuffix(intentTokens, language)
}

function branchTemplateInstructions(intent: string, label: string, language: string): string {
  const isPt = language.toLowerCase().startsWith('pt')
  if (isPt) {
    return `CONTEXTO DO RAMO (interno — nao mencione ao usuario): a mensagem foi classificada como "${label}" (codigo ${intent}).

Siga integralmente o modelo de papel (persona, empresa, tom, regras e exemplos). Responda de forma breve quando fizer sentido (por exemplo 1–4 frases), sem interrogatorio longo. Evite menu numerado ("digite 1 ou 2") salvo se o proprio modelo de papel exigir de forma explicita e curta.
Use o historico da conversa; a mensagem atual do usuario esta no contexto. Nao diga que esta "classificando" ou "em um ramo do fluxo".`
  }
  return `Internal branch: "${label}" (${intent}). Follow the role template fully; keep replies concise; no technical jargon about routing.`
}

function fallbackTemplateInstructions(language: string): string {
  const isPt = language.toLowerCase().startsWith('pt')
  if (isPt) {
    return `CONTEXTO DO RAMO (interno): intencao generica ou "outros".

Siga o modelo de papel. Respostas uteis e curtas; sem menu numerado longo; nao mencione classificacao tecnica.`
  }
  return 'Internal: general / fallback branch. Follow the role template.'
}

async function createBrainTemplateOnly(params: {
  email: string
  brainPrompt: string
  runTag: string
}): Promise<{ id: string; name: string }> {
  const name = flowIaTemplateName('Modelo principal', params.runTag)
  const id = await rpcCreateAgentTemplate(
    params.email,
    name,
    params.brainPrompt,
    'Modelo unico de atendimento compartilhado por todos os ramos (Criar fluxo com IA).'
  )
  return { id, name }
}

const CLASSIFIER_FLOW_DISPLAY = 'Classificador'

async function createClassifierAgentOnly(params: {
  email: string
  companiesId: string
  language: string
  classifierRole: string
  runTag: string
}): Promise<{ agentId: string; agentName: string; templateName: string }> {
  const tplName = flowIaTemplateName(`${CLASSIFIER_FLOW_DISPLAY} · tecnico`, params.runTag)
  const roleId = await rpcCreateAgentTemplate(
    params.email,
    tplName,
    params.classifierRole,
    'Classificador interno: apenas JSON de intent (IA).'
  )
  const agentNome = flowIaAgentName(CLASSIFIER_FLOW_DISPLAY, params.runTag)
  const agentId = await rpcCreateAgent(
    params.email,
    agentNome,
    roleId,
    params.language,
    'Classifica intencoes para o fluxo (nao conversa com o usuario).'
  )
  await updateAgentRuntime(agentId, params.companiesId, params.classifierRole)
  return { agentId, agentName: agentNome, templateName: tplName }
}

function buildStructuredFlowUnified(params: {
  classifierAgentId: string
  classifierLabel: string
  classifierName: string
  classifierExtraInstructions: string
  brainTemplateId: string
  brainTemplateName: string
  branches: Array<{ intent: string; label: string }>
  language: string
}): FlowGenerateMvpPayload {
  const startId = 'n-start'
  const classifierId = 'n-classifier'

  /** Mesmo padrão “escada” do Organizar fluxo no front (ELSE desce à direita, IF à esquerda). */
  const SPINE_X0 = 420
  const STAIRCASE_DX = 92
  const BRANCH_COL_X = 52
  const START_Y = 40
  const CLASSIFIER_Y = 176
  const LANE_Y = 292
  const FIRST_IF_Y = CLASSIFIER_Y + 172

  const nodes: Record<string, unknown>[] = [
    { id: startId, type: 'start', position: { x: SPINE_X0, y: START_Y }, data: { label: 'Início' } },
    {
      id: classifierId,
      type: 'agent',
      position: { x: SPINE_X0 - 36, y: CLASSIFIER_Y },
      data: buildAgentNodeData({
        label: params.classifierLabel,
        agentId: params.classifierAgentId,
        agentName: params.classifierName,
        additionalInstructions: params.classifierExtraInstructions,
        skipReplyConfidence: true,
      }),
    },
  ]

  const edges: { source: string; target: string; sourceHandle?: string }[] = [
    { source: startId, target: classifierId },
  ]

  let prevIfId: string | null = null

  params.branches.forEach((b, index) => {
    const ifId = `n-if-${index + 1}`
    const replyNodeId = `n-branch-${index + 1}`
    const stopId = `n-stop-${index + 1}`
    const cond = `{{intent}} contém ${b.intent}`
    const xIf = SPINE_X0 + index * STAIRCASE_DX
    const yIf = FIRST_IF_Y + index * LANE_Y

    nodes.push({
      id: ifId,
      type: 'if-else',
      position: { x: xIf, y: yIf },
      data: { label: `Se · ${b.intent}`, condition: cond },
    })
    nodes.push({
      id: replyNodeId,
      type: 'agent',
      position: { x: BRANCH_COL_X, y: yIf + 54 },
      data: buildTemplateNodeData({
        label: b.label,
        templateId: params.brainTemplateId,
        templateName: params.brainTemplateName,
        additionalInstructions: branchTemplateInstructions(b.intent, b.label, params.language),
      }),
    })
    nodes.push({
      id: stopId,
      type: 'stop',
      position: { x: BRANCH_COL_X, y: yIf + 224 },
      data: { label: 'Fim' },
    })

    if (index === 0) {
      edges.push({ source: classifierId, target: ifId })
    } else if (prevIfId) {
      edges.push({ source: prevIfId, target: ifId, sourceHandle: 'false' })
    }

    edges.push({ source: ifId, target: replyNodeId, sourceHandle: 'true' })
    edges.push({ source: replyNodeId, target: stopId })

    prevIfId = ifId
  })

  const fallbackReplyNode = 'n-fallback'
  const fallbackStopId = 'n-stop-fallback'
  const nBranch = params.branches.length
  const lastI = nBranch - 1
  const xFb =
    nBranch === 0 ? SPINE_X0 + 248 : SPINE_X0 + (lastI + 1) * STAIRCASE_DX + 220
  const yFb = nBranch === 0 ? CLASSIFIER_Y + 96 : FIRST_IF_Y + lastI * LANE_Y + 28
  nodes.push({
    id: fallbackReplyNode,
    type: 'agent',
    position: { x: xFb, y: yFb },
    data: buildTemplateNodeData({
      label: 'Demais assuntos',
      templateId: params.brainTemplateId,
      templateName: params.brainTemplateName,
      additionalInstructions: fallbackTemplateInstructions(params.language),
    }),
  })
  nodes.push({
    id: fallbackStopId,
    type: 'stop',
    position: { x: xFb, y: yFb + 204 },
    data: { label: 'Fim' },
  })

  if (prevIfId) {
    edges.push({ source: prevIfId, target: fallbackReplyNode, sourceHandle: 'false' })
  } else {
    edges.push({ source: classifierId, target: fallbackReplyNode })
  }

  edges.push({ source: fallbackReplyNode, target: fallbackStopId })

  return { startNodeId: startId, nodes, edges }
}

async function generateUnifiedFlowPlanWithOpenAI(
  refinedDescription: string,
  language: string
): Promise<LlmUnifiedPlanRaw | null> {
  const system = `You design WhatsApp / chat support flows for non-technical business owners. Output ONLY valid JSON (no markdown).

Architecture (important):
- ONE shared "brain" role text (brainPrompt) used for ALL user-facing replies. It must include: company/context, goals, tone, behavior rules, short examples, what NOT to do (no long interrogations, avoid numbered menus like "type 1 or 2" unless strictly necessary and brief), medical/legal limits if relevant.
- Several routing intents (topics) for if-else only — they do NOT get separate personas; the same brainPrompt applies everywhere.
- The platform will add a technical classifier agent automatically; you may add classifierHints (short, PT or ${language}) to help it map messages to intents.

Intent tokens: lowercase ASCII a-z, 0-9, underscore only; 1–${MAX_STRUCTURED_BRANCHES} intents, most specific first. Do NOT use the token "outros" (the system adds it).

JSON shape:
{
  "suggestedFlowName": string,
  "structureSummary": string,
  "brainPrompt": string,
  "intents": [ { "intent": string, "label": string } ],
  "classifierHints": string (optional)
}`

  const res = await chatText({
    system,
    user: `Business / flow description:\n${refinedDescription}`,
    model: STRUCTURED_MODEL,
    temperature: 0.28,
    maxTokens: 8000,
    responseFormat: { type: 'json_object' },
  })

  if (!res.success || !res.content) {
    logger.warn('[flow-generate-mvp] plan LLM failed', res.error)
    return null
  }
  return parseUnifiedPlan(res.content)
}

function appendBrainPromptPlatformFooter(brainPrompt: string, language: string): string {
  const core = brainPrompt.trim()
  const isPt = language.toLowerCase().startsWith('pt')
  const footer = isPt
    ? `

---
EXECUCAO NO FLUXO (plataforma):
- Os nos do fluxo apenas indicam o TEMA predominante da mensagem; voce continua sendo a mesma assistente e segue este modelo de papel.
- Instrucoes curtas por ramo podem aparecer junto — integre-as sem mencionar "classificador", "fluxo" ou "intencao tecnica" ao usuario.
- Prefira respostas curtas e naturais; evite menus "digite 1 ou 2" longos.`
    : `

---
Flow execution: branch nodes only bias the topic; remain one assistant. Do not mention routing to the user. Avoid long numbered menus.`
  return `${core}${footer}`.slice(0, 32000)
}

/**
 * Gera fluxo: 1 modelo principal (template) compartilhado + 1 agente classificador + grafo com nos em modo template nos ramos.
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

  const plan = await generateUnifiedFlowPlanWithOpenAI(refinedDescription, lang)
  const brainPromptRaw = typeof plan?.brainPrompt === 'string' ? plan.brainPrompt.trim() : ''
  if (!plan || brainPromptRaw.length < 80) {
    throw new Error('Não foi possível planejar o fluxo com a IA. Tente uma descrição mais detalhada.')
  }

  const seen = new Set<string>()
  const branchRows: Array<{ intent: string; label: string }> = []
  for (const row of plan.intents || []) {
    const intent = slugifyIntent(row?.intent || '')
    const label = String(row?.label || intent || '')
      .trim()
      .slice(0, 120) || intent
    if (!intent || intent === 'outros' || seen.has(intent)) continue
    seen.add(intent)
    branchRows.push({ intent, label })
  }

  if (branchRows.length === 0) {
    throw new Error('O plano da IA precisa de pelo menos uma intenção (tema) para os ramos do fluxo.')
  }

  const totalNewAgents = 1
  const activeCount = await getActiveAgentCount(companiesId)
  const planInfo = await getPlanInfo(companiesId)
  const limit = planInfo.limits.agents

  if (limit !== null && activeCount + totalNewAgents > limit) {
    throw new Error(
      `Este rascunho precisa criar ${totalNewAgents} agente novo (classificador), mas seu plano permite apenas ${limit} ativo(s) (${activeCount} em uso). Faça upgrade ou desative agentes antigos.`
    )
  }

  const intentTokens = branchRows.map((b) => b.intent)
  const classifierRole = buildUnifiedClassifierRole(lang, intentTokens, plan.classifierHints)

  const roleTemplateNames: string[] = []
  const agentNames: string[] = []
  const runTag = makeFlowIaRunTag()

  const brainFull = appendBrainPromptPlatformFooter(brainPromptRaw, lang)
  const brain = await createBrainTemplateOnly({
    email: userEmail,
    brainPrompt: brainFull,
    runTag,
  })
  roleTemplateNames.push(brain.name)

  const classifier = await createClassifierAgentOnly({
    email: userEmail,
    companiesId,
    language: lang,
    classifierRole,
    runTag,
  })
  roleTemplateNames.push(classifier.templateName)
  agentNames.push(classifier.agentName)

  const flow = buildStructuredFlowUnified({
    classifierAgentId: classifier.agentId,
    classifierLabel: CLASSIFIER_FLOW_DISPLAY,
    classifierName: classifier.agentName,
    classifierExtraInstructions: '',
    brainTemplateId: brain.id,
    brainTemplateName: brain.name,
    branches: branchRows,
    language: lang,
  })

  return {
    refinedDescription,
    refinementProvider,
    flow,
    resourceChoice: {
      executionMode: 'template',
      templateId: brain.id,
      templateName: brain.name,
      agentId: classifier.agentId,
      agentName: classifier.agentName,
      nodeLabel: brain.name,
      additionalInstructions: '',
    },
    generationMode: 'structured',
    suggestedFlowName: plan.suggestedFlowName?.trim() || null,
    structureSummary:
      plan.structureSummary?.trim() ||
      `Um modelo principal de atendimento (compartilhado por todos os ramos) e 1 agente classificador técnico.`,
    createdResources: {
      roleTemplateNames,
      agentNames,
    },
  }
}
