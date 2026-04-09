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
    'claude-3-5-haiku-20241022'
  )
}

/** True se a plataforma pode chamar a API Anthropic (botão “Melhorar descrição” no modal). */
export function isAnthropicConfiguredForFlowRefine(): boolean {
  return getAnthropicApiKey() !== null
}

async function claudeRefineWithSystem(
  userText: string,
  system: string,
  logLabel: string
): Promise<string | null> {
  const key = getAnthropicApiKey()
  if (!key) return null

  const model = getAnthropicModel()

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

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      logger.warn(`[${logLabel}] Claude HTTP`, response.status, errText.slice(0, 240))
      return null
    }

    const json = (await response.json()) as {
      content?: { type: string; text?: string }[]
      error?: { message?: string }
    }
    if (json.error?.message) {
      logger.warn(`[${logLabel}] Claude API error:`, json.error.message)
      return null
    }
    const text =
      json.content?.map((b) => (b.type === 'text' ? b.text || '' : '')).join('') || ''
    return text.trim() || null
  } catch (e: unknown) {
    logger.warn(`[${logLabel}] Claude error:`, e instanceof Error ? e.message : e)
    return null
  }
}

/**
 * Refino explícito no modal: texto mais rico para a IA que monta o fluxo (classificador, ramos, fallback).
 * Sempre via Claude; não altera o fluxo de refine interno do generate-mvp.
 */
export async function refineFlowDescriptionWithClaudeForGeneration(
  rawDescription: string,
  language: string
): Promise<string | null> {
  const trimmed = rawDescription.trim()
  if (!trimmed) return null

  const system = `You rewrite informal notes from non-technical business users into a detailed brief for another AI that will design an automated customer-service flow: an intent classifier, separate branches per topic, and a fallback path.

Output one coherent text in the locale ${language} (BCP-47). Prefer a short paragraph plus, if useful, a few lines starting with "•" for distinct intents (no markdown headings, no code fences). The tone of the brief should stay simple for laypeople, but include enough detail for flow design: business context if given, channel (e.g. WhatsApp), main goal, tone of voice, distinct intents or topics to branch, business rules (hours, what not to promise), and when to hand off to a human.

Do not invent prices, deadlines, or policies the user did not state. Return ONLY the improved brief, no preamble or quotes.`

  return claudeRefineWithSystem(trimmed, system, 'flow-refine-dialog')
}

async function refineDescriptionWithClaude(rawDescription: string, language: string): Promise<string | null> {
  const system = `You improve short user descriptions for building a chatbot flow.
Output a single clear paragraph (3–8 sentences) in the locale ${language} (BCP-47).
Return ONLY the improved text, no quotes or markdown.`
  return claudeRefineWithSystem(rawDescription, system, 'flow-generate-mvp')
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

interface LlmAgentSpec {
  agentName: string
  bio: string
  rolePrompt: string
}

interface LlmStructuredPlanRaw {
  suggestedFlowName?: string
  structureSummary?: string
  classifier?: Partial<LlmAgentSpec>
  branches?: Array<Partial<LlmAgentSpec> & { intent?: string }>
  fallback?: Partial<LlmAgentSpec>
}

function parseStructuredPlan(raw: string): LlmStructuredPlanRaw | null {
  try {
    return JSON.parse(raw) as LlmStructuredPlanRaw
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

async function createAgentWithRoleTemplate(params: {
  email: string
  companiesId: string
  language: string
  displayName: string
  bio: string
  rolePrompt: string
  roleDescription: string
  runTag: string
}): Promise<string> {
  const tplName = flowIaTemplateName(params.displayName, params.runTag)
  const roleId = await rpcCreateAgentTemplate(
    params.email,
    tplName,
    params.rolePrompt,
    params.roleDescription
  )
  const agentNome = flowIaAgentName(params.displayName, params.runTag)
  const agentId = await rpcCreateAgent(
    params.email,
    agentNome,
    roleId,
    params.language,
    params.bio || 'Criado automaticamente pelo Criar fluxo com IA.'
  )
  await updateAgentRuntime(agentId, params.companiesId, params.rolePrompt)
  return agentId
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

function buildStructuredFlow(params: {
  classifierAgentId: string
  classifierLabel: string
  classifierName: string
  classifierExtraInstructions: string
  branches: Array<{ intent: string; agentId: string; label: string; agentName: string }>
  fallbackAgentId: string
  fallbackLabel: string
  fallbackName: string
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
    const agentNodeId = `n-branch-${index + 1}`
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
      id: agentNodeId,
      type: 'agent',
      position: { x: BRANCH_COL_X, y: yIf + 54 },
      data: buildAgentNodeData({
        label: b.label,
        agentId: b.agentId,
        agentName: b.agentName,
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

    edges.push({ source: ifId, target: agentNodeId, sourceHandle: 'true' })
    edges.push({ source: agentNodeId, target: stopId })

    prevIfId = ifId
  })

  const fallbackAgentNode = 'n-fallback'
  const fallbackStopId = 'n-stop-fallback'
  const nBranch = params.branches.length
  const lastI = nBranch - 1
  const xFb =
    nBranch === 0 ? SPINE_X0 + 248 : SPINE_X0 + (lastI + 1) * STAIRCASE_DX + 220
  const yFb = nBranch === 0 ? CLASSIFIER_Y + 96 : FIRST_IF_Y + lastI * LANE_Y + 28
  nodes.push({
    id: fallbackAgentNode,
    type: 'agent',
    position: { x: xFb, y: yFb },
    data: buildAgentNodeData({
      label: params.fallbackLabel,
      agentId: params.fallbackAgentId,
      agentName: params.fallbackName,
    }),
  })
  nodes.push({
    id: fallbackStopId,
    type: 'stop',
    position: { x: xFb, y: yFb + 204 },
    data: { label: 'Fim' },
  })

  if (prevIfId) {
    edges.push({ source: prevIfId, target: fallbackAgentNode, sourceHandle: 'false' })
  } else {
    edges.push({ source: classifierId, target: fallbackAgentNode })
  }

  edges.push({ source: fallbackAgentNode, target: fallbackStopId })

  return { startNodeId: startId, nodes, edges }
}

async function generateAgentPlanWithOpenAI(
  refinedDescription: string,
  language: string
): Promise<LlmStructuredPlanRaw | null> {
  const system = `You are helping non-technical users build a support/sales chat flow. Output ONLY valid JSON (no markdown).

The backend will:
1) Create one "role template" (name + long role text) per agent in tb_agents_templates via API.
2) Create one agent per role in tb_agents linked to that template.
3) Build a flow graph: Start → Classifier agent → chain of if-else on {{intent}} → branch agents → fallback agent.

Classifier agent: must output ONLY in the assistant structured reply: action "reply" and "message" equal to a single-line JSON {"intent":"<token>"} (see suffix added by server). Your rolePrompt for classifier must describe how to classify user messages into intents.

Branch agents: normal conversational agents for WhatsApp-style replies (clear, helpful).

Rules:
- branches: 1 to ${MAX_STRUCTURED_BRANCHES} items, each with intent token: ASCII lowercase (a-z, 0-9, underscore), short (e.g. agendar, vendas, suporte). Order most important/specific first.
- fallback: default when no branch matches; use human-readable agentName (e.g. Assistente geral).
- suggestedFlowName: short title (${language}).
- structureSummary: 1-2 sentences in ${language} for the user.
- agentName: short human label for the Agents list (2–6 words, plain language, no numbers, codes, IDs or timestamps).
- bio: one line for the Agents list.
- rolePrompt: full system instructions for that agent (locale ${language} for end-user facing agents).

JSON shape:
{
  "suggestedFlowName": string,
  "structureSummary": string,
  "classifier": { "agentName": string, "bio": string, "rolePrompt": string },
  "branches": [ { "intent": string, "agentName": string, "bio": string, "rolePrompt": string } ],
  "fallback": { "agentName": string, "bio": string, "rolePrompt": string }
}`

  const res = await chatText({
    system,
    user: `Business description:\n${refinedDescription}`,
    model: STRUCTURED_MODEL,
    temperature: 0.28,
    maxTokens: 4500,
    responseFormat: { type: 'json_object' },
  })

  if (!res.success || !res.content) {
    logger.warn('[flow-generate-mvp] plan LLM failed', res.error)
    return null
  }
  return parseStructuredPlan(res.content)
}

function normalizeAgentSpec(p: Partial<LlmAgentSpec> | undefined, fallbackName: string): LlmAgentSpec {
  return {
    agentName: String(p?.agentName || fallbackName).trim().slice(0, 120) || fallbackName,
    bio: String(p?.bio || '').trim().slice(0, 500),
    rolePrompt: String(p?.rolePrompt || '').trim().slice(0, 32000),
  }
}

/**
 * Gera fluxo: cria modelos de papel + agentes via RPC e monta o grafo (somente nós agente).
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

  const plan = await generateAgentPlanWithOpenAI(refinedDescription, lang)
  if (!plan || !plan.classifier) {
    throw new Error('Não foi possível planejar o fluxo com a IA. Tente uma descrição mais detalhada.')
  }

  const classifierSpec = normalizeAgentSpec(plan.classifier, 'Classificador')
  if (!classifierSpec.rolePrompt) {
    throw new Error('O plano da IA não definiu o classificador corretamente.')
  }

  const rawBranches = Array.isArray(plan.branches) ? plan.branches : []
  const seen = new Set<string>()
  const branchSpecs: Array<{ intent: string; spec: LlmAgentSpec }> = []

  for (const br of rawBranches.slice(0, MAX_STRUCTURED_BRANCHES)) {
    const intent = slugifyIntent(br.intent || '')
    if (!intent || intent === 'outros' || seen.has(intent)) continue
    seen.add(intent)
    const spec = normalizeAgentSpec(br, intent)
    if (!spec.rolePrompt) continue
    branchSpecs.push({ intent, spec })
  }

  const fallbackSpec = normalizeAgentSpec(plan.fallback, 'Atendimento geral')
  if (branchSpecs.length === 0 || !fallbackSpec.rolePrompt) {
    throw new Error('O plano da IA precisa de pelo menos um ramo e um fallback com instruções.')
  }

  const totalNewAgents = 1 + branchSpecs.length + 1
  const activeCount = await getActiveAgentCount(companiesId)
  const planInfo = await getPlanInfo(companiesId)
  const limit = planInfo.limits.agents

  if (limit !== null && activeCount + totalNewAgents > limit) {
    throw new Error(
      `Este rascunho precisa criar ${totalNewAgents} agentes novos, mas seu plano permite apenas ${limit} ativo(s) (${activeCount} em uso). Faça upgrade ou desative agentes antigos.`
    )
  }

  const intents = branchSpecs.map((b) => b.intent)
  const classifierRole = classifierSpec.rolePrompt + classifierJsonSuffix(intents, lang)

  const roleTemplateNames: string[] = []
  const agentNames: string[] = []
  const runTag = makeFlowIaRunTag()

  const classifierAgentId = await createAgentWithRoleTemplate({
    email: userEmail,
    companiesId,
    language: lang,
    displayName: classifierSpec.agentName,
    bio: classifierSpec.bio,
    rolePrompt: classifierRole,
    roleDescription: `Papel técnico do classificador de intenções do fluxo (IA).`,
    runTag,
  })
  roleTemplateNames.push(flowIaTemplateName(classifierSpec.agentName, runTag))
  agentNames.push(flowIaAgentName(classifierSpec.agentName, runTag))

  const branchAgents: Array<{ intent: string; agentId: string; label: string; agentName: string }> = []
  for (let i = 0; i < branchSpecs.length; i++) {
    const { intent, spec } = branchSpecs[i]
    const branchTag = `${runTag}-${intent}`
    const aid = await createAgentWithRoleTemplate({
      email: userEmail,
      companiesId,
      language: lang,
      displayName: spec.agentName,
      bio: spec.bio,
      rolePrompt: spec.rolePrompt,
      roleDescription: `Papel do ramo "${intent}" gerado pelo Criar fluxo com IA.`,
      runTag: branchTag,
    })
    roleTemplateNames.push(flowIaTemplateName(spec.agentName, branchTag))
    const aname = flowIaAgentName(spec.agentName, branchTag)
    agentNames.push(aname)
    branchAgents.push({
      intent,
      agentId: aid,
      label: spec.agentName,
      agentName: aname,
    })
  }

  const fallbackTag = `${runTag}-geral`
  const fallbackAgentId = await createAgentWithRoleTemplate({
    email: userEmail,
    companiesId,
    language: lang,
    displayName: fallbackSpec.agentName,
    bio: fallbackSpec.bio,
    rolePrompt: fallbackSpec.rolePrompt,
    roleDescription: `Papel padrão (fallback) do fluxo gerado por IA.`,
    runTag: fallbackTag,
  })
  roleTemplateNames.push(flowIaTemplateName(fallbackSpec.agentName, fallbackTag))
  const fallbackAgentName = flowIaAgentName(fallbackSpec.agentName, fallbackTag)
  agentNames.push(fallbackAgentName)

  const flow = buildStructuredFlow({
    classifierAgentId,
    classifierLabel: classifierSpec.agentName,
    classifierName: agentNames[0],
    classifierExtraInstructions: '',
    branches: branchAgents,
    fallbackAgentId,
    fallbackLabel: fallbackSpec.agentName,
    fallbackName: fallbackAgentName,
  })

  return {
    refinedDescription,
    refinementProvider,
    flow,
    resourceChoice: {
      executionMode: 'agent',
      templateId: null,
      templateName: null,
      agentId: classifierAgentId,
      agentName: agentNames[0],
      nodeLabel: classifierSpec.agentName,
      additionalInstructions: '',
    },
    generationMode: 'structured',
    suggestedFlowName: plan.suggestedFlowName?.trim() || null,
    structureSummary:
      plan.structureSummary?.trim() ||
      `Foram criados ${agentNames.length} agentes e ${roleTemplateNames.length} modelos de papel para este fluxo.`,
    createdResources: {
      roleTemplateNames,
      agentNames,
    },
  }
}
