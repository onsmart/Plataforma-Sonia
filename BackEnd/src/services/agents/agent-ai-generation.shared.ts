import '../../lib/env'
import { randomInt } from 'node:crypto'
import { supabase } from '../../lib/supabase'
import { chatText } from '../llm/openai'
import logger from '../../lib/logger'
import { normalizeAgentLanguageCode } from '../../utils/agent-language'

export type RefinementProvider = 'openai' | 'claude' | 'none'

export const STRUCTURED_MODEL =
  process.env.FLOW_GENERATE_STRUCTURED_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini'

export const MIN_CONVERSATION_TEMPLATE_CHARS = 400

export interface LlmSingleAgentPlanRaw {
  suggestedFlowName?: string
  structureSummary?: string
  conversationTemplate?: string
  brainPrompt?: string
  agentDisplayName?: string
  personalityPrompt?: string
  welcomeMessage?: string
  templateDescription?: string
}

export type ClaudeRefineOk = { ok: true; text: string }
export type ClaudeRefineErr = { ok: false; status?: number; message: string }
export type ClaudeRefineResult = ClaudeRefineOk | ClaudeRefineErr

export function getRefinerPreference(): 'openai' | 'claude' | 'none' {
  const v = (process.env.FLOW_DESCRIPTION_REFINER || 'openai').toLowerCase().trim()
  if (v === 'none' || v === 'off' || v === 'false') return 'none'
  if (v === 'claude' || v === 'anthropic' || v === 'google' || v === 'gemini') return 'claude'
  return 'openai'
}

export function unwrapRpcId(data: unknown): string {
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

export async function refineDescriptionWithOpenAI(
  rawDescription: string,
  language: string,
  purpose: 'flow' | 'agent' = 'flow'
): Promise<string | null> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const flowSystem = `You improve short user descriptions for building ONE WhatsApp/chat agent with a single detailed template (linear flow: start → agent → end).
Output a single clear paragraph (3–8 sentences) in the locale ${language} (BCP-47).
Include: main goal, channel, tone, topics the agent must handle, scheduling/support links if any, and business rules.
If the user pasted any http(s) URLs, copy them into your output exactly (same characters); do not paraphrase, shorten, or replace them with different domains.
Do not invent URLs, example.com, or plausible fake company links. Do not invent confidential data. Return ONLY the improved text, no quotes or markdown.`

  const agentSystem = `You improve short business briefs for creating ONE production-ready conversational agent (template + agent) on WhatsApp.
Output a single clear paragraph (4–10 sentences) in the locale ${language} (BCP-47).
Include: business context, channel, tone, topics, integration usage (scheduling, CRM), policies, and handoff rules.
Copy any http(s) URLs verbatim. Do not invent links or confidential data. Return ONLY the improved text.`

  const res = await chatText({
    system: purpose === 'agent' ? agentSystem : flowSystem,
    user: rawDescription,
    model,
    temperature: 0.35,
    maxTokens: 800,
  })
  if (!res.success || !res.content?.trim()) return null
  return res.content.trim()
}

export function getAnthropicApiKey(): string | null {
  return (
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.CLAUDE_API_KEY?.trim() ||
    process.env.ANTHROPIC_AUTH_TOKEN?.trim() ||
    null
  )
}

export function getAnthropicModel(): string {
  return (
    process.env.ANTHROPIC_MODEL?.trim() ||
    process.env.CLAUDE_MODEL?.trim() ||
    'claude-3-5-haiku-latest'
  )
}

const ANTHROPIC_FALLBACK_MODEL = 'claude-3-haiku-20240307'

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

function shouldRetryClaudeWithFallbackModel(status: number | undefined, message: string): boolean {
  if (status === 404) return true
  const m = message.toLowerCase()
  return (
    m.includes('model') &&
    (m.includes('not found') || m.includes('invalid') || m.includes('does not exist') || m.includes('unknown model'))
  )
}

export async function claudeRefineWithModel(
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
      return { ok: false, message: json.error.message }
    }
    const text = json.content?.map((b) => (b.type === 'text' ? b.text || '' : '')).join('') || ''
    const out = text.trim()
    if (!out) {
      return {
        ok: false,
        message:
          'O Claude não devolveu texto. Ajuste ANTHROPIC_MODEL ou CLAUDE_MODEL.',
      }
    }
    return { ok: true, text: out }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.warn(`[${logLabel}] Claude error:`, msg)
    return { ok: false, message: msg || 'Falha de rede ao contatar api.anthropic.com.' }
  }
}

export function isAnthropicConfiguredForFlowRefine(): boolean {
  return getAnthropicApiKey() !== null
}

export async function claudeRefineWithSystem(
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

If the user message contains any http(s) URLs, copy them verbatim. Never substitute invented domains. Return ONLY the improved brief, no preamble or quotes.`

  return claudeRefineWithSystem(trimmed, system, 'flow-refine-dialog')
}

async function refineDescriptionWithClaude(rawDescription: string, language: string): Promise<string | null> {
  const system = `You improve short user descriptions for building a chatbot flow.
Output a single clear paragraph (3–8 sentences) in the locale ${language} (BCP-47).
If the user pasted http(s) URLs, include them in your output exactly as given; do not invent or replace links.
Return ONLY the improved text, no quotes or markdown.`
  const r = await claudeRefineWithSystem(rawDescription, system, 'flow-generate-mvp')
  return r.ok ? r.text : null
}

export async function refineUserDescription(
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

export function parseSingleAgentPlan(raw: string): LlmSingleAgentPlanRaw | null {
  try {
    return JSON.parse(raw) as LlmSingleAgentPlanRaw
  } catch {
    return null
  }
}

export function makeIaRunTag(): string {
  const alphabet = 'bdfghjkmnpqrstvwxyz'
  let s = ''
  for (let i = 0; i < 4; i++) {
    s += alphabet[randomInt(alphabet.length)]
  }
  return s
}

export function buildIaAgentName(prefix: string, displayName: string, runTag: string): string {
  const clean = String(displayName || 'Agente').trim().slice(0, 100) || 'Agente'
  const tag = String(runTag || 'xxxx').trim().slice(0, 48)
  return `${prefix} ${clean} · ${tag}`.slice(0, 200)
}

export function buildIaTemplateName(prefix: string, flowDisplayName: string, consumerName: string): string {
  const sanitize = (s: string, max: number) => {
    const t = String(s || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max)
    return t || '—'
  }
  const sep = ' - '
  const maxTotal = 200
  let flowPart = sanitize(flowDisplayName, 120)
  let consumerPart = sanitize(consumerName, 120)
  let out = `${prefix} ${flowPart}${sep}${consumerPart}`
  if (out.length <= maxTotal) return out
  const budget = maxTotal - prefix.length - 1 - sep.length
  const half = Math.max(24, Math.floor(budget / 2))
  flowPart = flowPart.slice(0, half)
  consumerPart = consumerPart.slice(0, budget - flowPart.length)
  out = `${prefix} ${flowPart}${sep}${consumerPart}`
  return out.slice(0, maxTotal)
}

export async function rpcCreateAgentTemplate(
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

export async function rpcCreateAgent(
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

export async function patchAgentRecord(
  agentId: string,
  companiesId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('tb_agents')
    .update(patch)
    .eq('id', agentId)
    .eq('companies_id', companiesId)
  if (error) throw new Error(`Atualizar agente: ${error.message}`)
}

export function extractHttpsUrlsFromText(text: string): string[] {
  if (!text || typeof text !== 'string') return []
  const re = /https?:\/\/[^\s\])}>'"\]]+/gi
  const raw = text.match(re) || []
  const cleaned = raw.map((u) => u.replace(/[.,;:!?)'"\]]+$/i, '').trim()).filter(Boolean)
  return [...new Set(cleaned)]
}

export function appendUserProvidedUrlsBlock(
  templateBody: string,
  language: string,
  ...sources: string[]
): string {
  const urls = new Set<string>()
  for (const s of sources) {
    for (const u of extractHttpsUrlsFromText(String(s || ''))) urls.add(u)
  }
  if (urls.size === 0) return templateBody
  const list = [...urls].map((u) => `- ${u}`).join('\n')
  const isPt = language.toLowerCase().startsWith('pt')
  const block = isPt
    ? `\n\n---\nLINKS INFORMADOS PELO USUARIO / BRIEF (uso obrigatorio ao citar link; copie exatamente; nao invente outros dominios nem substitua por URLs parecidas):\n${list}`
    : `\n\n---\nUSER-PROVIDED LINKS FROM BRIEF (required when sending a link; copy exactly; do not invent or substitute URLs):\n${list}`
  return (templateBody + block).slice(0, 32000)
}

export function appendSingleAgentTemplateFooter(templateBody: string, language: string): string {
  const core = templateBody.trim()
  const isPt = language.toLowerCase().startsWith('pt')
  const footer = isPt
    ? `

---
PLATAFORMA SONIA (WhatsApp / atendimento):
- Voce e UM unico assistente: todo roteamento, opcoes e tom estao neste modelo; nao mencione fluxo, classificador, nos ou IA interna.
- Na primeira mensagem do usuario (ex.: saudacao curta), cumprimente e, se este modelo definir opcoes ou temas, apresente de forma breve e legivel no celular.
- Links e URLs: use apenas enderecos que constam neste modelo (incluindo a secao LINKS INFORMADOS, se existir). Nunca invente dominios plausiveis (ex.: example.com, lojas ficticias). Se nao houver URL real no modelo, diga que a equipe enviara o link oficial ou oriente a falar com a empresa — sem URL falsa.
- Nao use placeholders [link] ou [URL] sem o endereco real copiado das instrucoes.
- Se o usuario nao seguir opcoes numeradas, interprete a intencao e continue sem travar; em duvida, peca um esclarecimento curto.
- Ao agendar ou enviar Calendly/link: seja educado, envie somente URLs reais presentes acima, agradeca e encerre com elegancia quando fizer sentido.`
    : `

---
Sonia platform: Single assistant; natural WhatsApp tone; use only URLs that appear in this template; never invent plausible fake domains; no internal jargon; handle off-script users gracefully.`
  return `${core}${footer}`.slice(0, 32000)
}

export async function generateSingleAgentConversationPlanWithOpenAI(
  refinedDescription: string,
  language: string,
  options?: { archetypeHint?: string; toolsSummary?: string }
): Promise<LlmSingleAgentPlanRaw | null> {
  const archetypeBlock = options?.archetypeHint
    ? `\nAgent archetype: ${options.archetypeHint}`
    : ''
  const toolsBlock = options?.toolsSummary
    ? `\nEnabled integration tools (must reference in template when to use each):\n${options.toolsSummary}`
    : ''

  const system = `You are a senior designer of production-ready conversational agent templates for WhatsApp customer service (ElevenLabs-level professionalism).
The platform Sonia will create: (1) ONE agent template (long system-style instructions) and (2) ONE agent linked to it.
Output ONLY valid JSON (no markdown). Write the main content in the locale ${language} (BCP-47).${archetypeBlock}${toolsBlock}

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
10. MENSAGENS EXATAS IMPORTANTES (scheduling/support: copy ONLY https URLs that appear verbatim in the business scenario; never [link] placeholders; NEVER invent example.com or fictional URLs)
11. EXEMPLOS DE CONVERSA (user line / ideal agent line)
12. CRITERIOS DE QUALIDADE

Also set:
- "personalityPrompt": short system personality (2-6 sentences) for runtime LLM tone
- "welcomeMessage": first message to user on WhatsApp (1-3 short sentences)
- "templateDescription": one sentence summary for admin UI (max 200 chars)
- "suggestedFlowName": short title
- "structureSummary": one sentence
- "agentDisplayName": short public-facing agent name

JSON shape:
{
  "suggestedFlowName": string,
  "structureSummary": string,
  "conversationTemplate": string,
  "personalityPrompt": string,
  "welcomeMessage": string,
  "templateDescription": string,
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
    logger.warn('[agent-ai-generation] single-agent plan LLM failed', res.error)
    return null
  }
  return parseSingleAgentPlan(res.content)
}

export async function buildAgentDesignBriefWithClaude(params: {
  rawDescription: string
  language: string
  archetype: 'faq' | 'receptive' | 'sdr'
  toolsSummary: string
}): Promise<ClaudeRefineResult> {
  const trimmed = params.rawDescription.trim()
  if (!trimmed) {
    return { ok: false, message: 'Descrição vazia.' }
  }

  const archetypeLabels: Record<string, string> = {
    faq: 'FAQ — answer questions, help users, no heavy outbound sales',
    receptive: 'Receptive — help users, capture data, schedule meetings via integrations',
    sdr: 'SDR — inbound + outbound (not implemented)',
  }

  const system = `You are a senior conversational AI architect. Produce a structured design brief (in locale ${params.language}, BCP-47) for another AI that will generate a WhatsApp agent template.

Archetype: ${archetypeLabels[params.archetype] || params.archetype}

Integration tools selected by the user:
${params.toolsSummary || '(none)'}

Output sections (plain text, no markdown fences):
## BUSINESS CONTEXT
## AGENT MISSION
## TONE AND CHANNEL
## TOOL USAGE RULES (one bullet per enabled tool — when to call, what to ask first, what never to invent)
## CONVERSATION FLOW
## GUARDRAILS
## HANDOFF TO HUMAN

Copy any http(s) URLs from the user verbatim. Do not invent policies, prices, or links.`

  return claudeRefineWithSystem(
    `User brief:\n${trimmed}`,
    system,
    'agent-generate-ai-brief'
  )
}
