import '../../lib/env'
import { supabase } from '../../lib/supabase'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import { chatText } from '../llm/openai'
import logger from '../../lib/logger'

export type RefinementProvider = 'openai' | 'claude' | 'none'

export interface FlowGenerateMvpPayload {
  startNodeId: string
  nodes: Record<string, unknown>[]
  edges: { source: string; target: string; sourceHandle?: string }[]
}

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
}

type AgentRow = { id: string; nome?: string; bio?: string | null }
type TemplateRow = { id: string; name?: string; description?: string | null }

/** Preferência de refino: openai primeiro, claude primeiro, ou desligado. Valores antigos google/gemini tratam como claude. */
function getRefinerPreference(): 'openai' | 'claude' | 'none' {
  const v = (process.env.FLOW_DESCRIPTION_REFINER || 'openai').toLowerCase().trim()
  if (v === 'none' || v === 'off' || v === 'false') return 'none'
  if (v === 'claude' || v === 'anthropic' || v === 'google' || v === 'gemini') return 'claude'
  return 'openai'
}

async function listAgentsForEmail(email: string): Promise<AgentRow[]> {
  const { data, error } = await supabase.rpc('sp_list_agents_by_email', {
    p_email: email,
  })
  if (error) {
    logger.warn('[flow-generate-mvp] sp_list_agents_by_email:', error.message)
    return []
  }
  const rows = Array.isArray(data) ? data : data ? [data] : []
  return rows
    .map((a: any) => ({
      id: String(a.id || ''),
      nome: a.nome || '',
      bio: a.bio ?? null,
    }))
    .filter((a) => a.id)
}

async function listTemplatesForEmail(email: string): Promise<TemplateRow[]> {
  const companiesId = await getCompanyIdByEmail(email)
  let query = supabase
    .from('tb_agents_templates')
    .select('id, name, description')
    .order('created_at', { ascending: false })

  if (companiesId) {
    query = query.or(`companies_id.eq.${companiesId},companies_id.is.null`)
  } else {
    query = query.is('companies_id', null)
  }

  const { data, error } = await query
  if (error) {
    logger.warn('[flow-generate-mvp] templates:', error.message)
    return []
  }
  return (data || [])
    .map((t: any) => ({
      id: String(t.id || ''),
      name: t.name || '',
      description: t.description ?? null,
    }))
    .filter((t) => t.id)
}

async function refineDescriptionWithOpenAI(
  rawDescription: string,
  language: string
): Promise<string | null> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const system = `You improve short user descriptions for building a minimal chatbot flow.
Output a single clear paragraph (3–6 sentences) in the locale ${language} (BCP-47, e.g. pt-BR, en-US, es-ES).
Include: main goal, channel/context if implied, tone, and any explicit business rules.
Do not invent confidential data. If the input is vague, still produce the best possible brief.
Return ONLY the improved text, no quotes or markdown.`

  const res = await chatText({
    system,
    user: rawDescription,
    model,
    temperature: 0.35,
    maxTokens: 600,
  })
  if (!res.success || !res.content?.trim()) return null
  return res.content.trim()
}

async function refineDescriptionWithClaude(
  rawDescription: string,
  language: string
): Promise<string | null> {
  const key =
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.CLAUDE_API_KEY?.trim() ||
    process.env.ANTHROPIC_AUTH_TOKEN?.trim()
  if (!key) return null

  const model =
    process.env.ANTHROPIC_MODEL?.trim() ||
    process.env.CLAUDE_MODEL?.trim() ||
    'claude-3-5-haiku-20241022'

  const system = `You improve short user descriptions for building a minimal chatbot flow.
Output a single clear paragraph (3–6 sentences) in the locale ${language} (BCP-47).
Include: main goal, channel/context if implied, tone, and any explicit business rules.
Do not invent confidential data. Return ONLY the improved text, no quotes or markdown.`

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
        max_tokens: 1024,
        temperature: 0.35,
        system,
        messages: [{ role: 'user', content: rawDescription }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      logger.warn('[flow-generate-mvp] Claude refine HTTP', response.status, errText.slice(0, 240))
      return null
    }

    const json = (await response.json()) as {
      content?: { type: string; text?: string }[]
      error?: { message?: string }
    }
    if (json.error?.message) {
      logger.warn('[flow-generate-mvp] Claude API error:', json.error.message)
      return null
    }
    const text =
      json.content?.map((b) => (b.type === 'text' ? b.text || '' : '')).join('') || ''
    const trimmed = text.trim()
    return trimmed || null
  } catch (e: any) {
    logger.warn('[flow-generate-mvp] Claude refine error:', e?.message)
    return null
  }
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

interface LlmPick {
  executionMode: 'template' | 'agent'
  templateId: string
  agentId: string
  nodeLabel: string
  additionalInstructions: string
}

function parseLlmPick(raw: string): LlmPick | null {
  try {
    const j = JSON.parse(raw) as Partial<LlmPick>
    const mode = j.executionMode === 'agent' ? 'agent' : 'template'
    return {
      executionMode: mode,
      templateId: typeof j.templateId === 'string' ? j.templateId : '',
      agentId: typeof j.agentId === 'string' ? j.agentId : '',
      nodeLabel: typeof j.nodeLabel === 'string' ? j.nodeLabel.trim() : 'Assistente',
      additionalInstructions:
        typeof j.additionalInstructions === 'string' ? j.additionalInstructions.trim() : '',
    }
  } catch {
    return null
  }
}

async function pickResourceWithOpenAI(
  refinedDescription: string,
  language: string,
  agents: AgentRow[],
  templates: TemplateRow[]
): Promise<LlmPick | null> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  const agentLines = agents
    .map((a) => `- id="${a.id}" name="${(a.nome || '').replace(/"/g, "'")}"`)
    .join('\n')
  const tplLines = templates
    .map(
      (t) =>
        `- id="${t.id}" name="${(t.name || '').replace(/"/g, "'")}" desc="${(t.description || '').slice(0, 160).replace(/"/g, "'")}"`
    )
    .join('\n')

  const system = `You choose ONE resource for a minimal chatbot flow: either a template OR an agent from the lists.
The flow will be: Start → single Agent node → End.
Respond with JSON only, no markdown:
{
  "executionMode": "template" | "agent",
  "templateId": "<uuid or empty string>",
  "agentId": "<uuid or empty string>",
  "nodeLabel": "<short UI label for the node, max 40 chars>",
  "additionalInstructions": "<optional extra instructions for this step; write in the locale ${language} (BCP-47); may be empty string>"
}
Rules:
- If executionMode is "template", templateId MUST be exactly one id from the templates list and agentId MUST be "".
- If executionMode is "agent", agentId MUST be exactly one id from the agents list and templateId MUST be "".
- Prefer template when the user needs a fixed playbook; prefer agent when they need a free-form persona.
- nodeLabel and additionalInstructions MUST be written in the locale ${language} (agents will speak that language).`

  const user = `Refined business description:\n${refinedDescription}\n\n--- TEMPLATES ---\n${tplLines || '(none)'}\n\n--- AGENTS ---\n${agentLines || '(none)'}`

  const res = await chatText({
    system,
    user,
    model,
    temperature: 0.25,
    maxTokens: 500,
    responseFormat: { type: 'json_object' },
  })

  if (!res.success || !res.content) return null
  return parseLlmPick(res.content)
}

function validateAndResolvePick(
  pick: LlmPick | null,
  agents: AgentRow[],
  templates: TemplateRow[]
): {
  executionMode: 'template' | 'agent'
  templateId: string | null
  templateName: string | null
  agentId: string | null
  agentName: string | null
  nodeLabel: string
  additionalInstructions: string
} {
  const fallbackTpl = templates[0]
  const fallbackAg = agents[0]

  if (
    pick &&
    pick.executionMode === 'template' &&
    pick.templateId &&
    templates.some((t) => t.id === pick.templateId)
  ) {
    const t = templates.find((x) => x.id === pick.templateId)!
    return {
      executionMode: 'template',
      templateId: t.id,
      templateName: t.name || null,
      agentId: null,
      agentName: null,
      nodeLabel: pick.nodeLabel || t.name || 'Template',
      additionalInstructions: pick.additionalInstructions,
    }
  }

  if (
    pick &&
    pick.executionMode === 'agent' &&
    pick.agentId &&
    agents.some((a) => a.id === pick.agentId)
  ) {
    const a = agents.find((x) => x.id === pick.agentId)!
    return {
      executionMode: 'agent',
      templateId: null,
      templateName: null,
      agentId: a.id,
      agentName: a.nome || null,
      nodeLabel: pick.nodeLabel || a.nome || 'Agente',
      additionalInstructions: pick.additionalInstructions,
    }
  }

  if (fallbackTpl) {
    return {
      executionMode: 'template',
      templateId: fallbackTpl.id,
      templateName: fallbackTpl.name || null,
      agentId: null,
      agentName: null,
      nodeLabel: fallbackTpl.name || 'Template',
      additionalInstructions: pick?.additionalInstructions || '',
    }
  }

  if (fallbackAg) {
    return {
      executionMode: 'agent',
      templateId: null,
      templateName: null,
      agentId: fallbackAg.id,
      agentName: fallbackAg.nome || null,
      nodeLabel: fallbackAg.nome || 'Agente',
      additionalInstructions: pick?.additionalInstructions || '',
    }
  }

  return {
    executionMode: 'agent',
    templateId: null,
    templateName: null,
    agentId: null,
    agentName: null,
    nodeLabel: 'Agente',
    additionalInstructions: '',
  }
}

function buildMvpFlow(resource: ReturnType<typeof validateAndResolvePick>): FlowGenerateMvpPayload {
  const startId = 'n-start'
  const agentId = 'n-agent-main'
  const stopId = 'n-stop'

  const agentData: Record<string, unknown> = {
    label: resource.nodeLabel,
    executionMode: resource.executionMode,
    templateId: resource.templateId || '',
    templateName: resource.templateName || '',
    agentId: resource.agentId || '',
    agentName: resource.agentName || '',
    additionalInstructions: resource.additionalInstructions || '',
    bio: null,
  }

  const nodes: Record<string, unknown>[] = [
    { id: startId, type: 'start', position: { x: 400, y: 40 }, data: { label: 'Início' } },
    { id: agentId, type: 'agent', position: { x: 360, y: 180 }, data: agentData },
    { id: stopId, type: 'stop', position: { x: 360, y: 340 }, data: { label: 'Fim' } },
  ]

  const edges = [
    { source: startId, target: agentId },
    { source: agentId, target: stopId },
  ]

  return { startNodeId: startId, nodes, edges }
}

/**
 * MVP: refina descrição (OpenAI e/ou Google conforme env) e monta fluxo mínimo Início → 1 agente/template → Fim.
 */
export async function generateMvpFlowFromDescription(
  userEmail: string,
  rawDescription: string,
  language: string
): Promise<FlowGenerateMvpResponse> {
  const agents = await listAgentsForEmail(userEmail)
  const templates = await listTemplatesForEmail(userEmail)

  if (agents.length === 0 && templates.length === 0) {
    throw new Error('Nenhum agente nem template disponível para montar o fluxo.')
  }

  const { text: refinedDescription, provider: refinementProvider } = await refineUserDescription(
    rawDescription,
    language || 'pt-BR'
  )

  const llmPick = await pickResourceWithOpenAI(
    refinedDescription,
    language || 'pt-BR',
    agents,
    templates
  )
  const resourceChoice = validateAndResolvePick(llmPick, agents, templates)

  if (!resourceChoice.templateId && !resourceChoice.agentId) {
    throw new Error('Não foi possível escolher um template ou agente válido.')
  }

  const flow = buildMvpFlow(resourceChoice)

  return {
    refinedDescription,
    refinementProvider,
    flow,
    resourceChoice,
  }
}
