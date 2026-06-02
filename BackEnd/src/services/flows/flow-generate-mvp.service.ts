import '../../lib/env'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import { canCreateAgent, getPlanInfo } from '../../utils/plan-helper'
import { getActiveAgentCount } from '../usage-tracker.service'
import { listCalendlyIntegrationConfigsForUser } from '../integrations/calendly'
import {
  buildFlexSchedExtraFeaturesJson,
  buildFlexSchedPersonalityWithBusinessContext,
  buildFlexSchedTemplateRoleWithBusinessContext,
  FLEX_SCHED_TEMPLATE_DESCRIPTION,
} from '../../content/flexible-scheduling-template-pack'
import {
  type RefinementProvider,
  refineUserDescription,
  refineFlowDescriptionWithClaudeForGeneration,
  isAnthropicConfiguredForFlowRefine,
  generateSingleAgentConversationPlanWithOpenAI,
  rpcCreateAgentTemplate,
  rpcCreateAgent,
  patchAgentRecord,
  appendUserProvidedUrlsBlock,
  appendSingleAgentTemplateFooter,
  makeIaRunTag,
  buildIaAgentName,
  buildIaTemplateName,
  MIN_CONVERSATION_TEMPLATE_CHARS,
} from '../agents/agent-ai-generation.shared'

export type FlowAgentArchetype = 'generic' | 'receptive' | 'sdr'

export { RefinementProvider, refineFlowDescriptionWithClaudeForGeneration, isAnthropicConfiguredForFlowRefine }

export interface FlowGenerateMvpPayload {
  startNodeId: string
  nodes: Record<string, unknown>[]
  edges: { source: string; target: string; sourceHandle?: string }[]
}

export type FlowGenerationMode = 'single_agent'

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
  createdResources?: {
    roleTemplateNames: string[]
    agentNames: string[]
  }
}

const FLOW_IA_PREFIX = '[FLUXO IA]'

function buildAgentNodeData(params: {
  label: string
  agentId: string
  agentName: string
  templateId: string
  templateName: string
  primaryLanguage?: string
  additionalInstructions?: string
  skipReplyConfidence?: boolean
  executionMode?: 'agent' | 'template'
}): Record<string, unknown> {
  return {
    label: params.label,
    executionMode: params.executionMode || 'template',
    templateId: params.templateId,
    templateName: params.templateName,
    agentId: params.agentId,
    agentName: params.agentName,
    primaryLanguage: params.primaryLanguage || null,
    additionalInstructions: params.additionalInstructions || '',
    bio: null,
    skipReplyConfidence: params.skipReplyConfidence === true,
  }
}

function buildLinearAgentFlow(params: {
  agentId: string
  agentName: string
  nodeLabel: string
  templateId: string
  templateName: string
  primaryLanguage: string
  executionMode?: 'agent' | 'template'
}): FlowGenerateMvpPayload {
  const startId = 'n-start'
  const agentNodeId = 'n-agent'
  const stopId = 'n-stop'
  return {
    startNodeId: startId,
    nodes: [
      { id: startId, type: 'start', position: { x: 420, y: 72 }, data: { label: 'Início' } },
      {
        id: agentNodeId,
        type: 'agent',
        position: { x: 420, y: 200 },
        data: buildAgentNodeData({
          label: params.nodeLabel,
          agentId: params.agentId,
          agentName: params.agentName,
          templateId: params.templateId,
          templateName: params.templateName,
          primaryLanguage: params.primaryLanguage,
          additionalInstructions: '',
          skipReplyConfidence: false,
          executionMode: params.executionMode || 'template',
        }),
      },
      { id: stopId, type: 'stop', position: { x: 420, y: 352 }, data: { label: 'Fim' } },
    ],
    edges: [
      { source: startId, target: agentNodeId },
      { source: agentNodeId, target: stopId },
    ],
  }
}

function inferReceptiveNames(rawDescription: string, refinedDescription: string): {
  suggestedFlowName: string
  agentDisplayName: string
} {
  const source = String(refinedDescription || rawDescription || '').trim()
  const firstLine = source.split(/\n+/)[0]?.trim() || 'Atendimento receptivo'
  const short = firstLine.replace(/\s+/g, ' ').slice(0, 72) || 'Atendimento receptivo'
  return {
    suggestedFlowName: short,
    agentDisplayName: 'Assistente receptivo',
  }
}

async function resolveCalendlyIntegrationIdForUser(
  userEmail: string,
  preferredId?: string | null
): Promise<string | null> {
  const preferred = String(preferredId || '').trim()
  if (preferred) return preferred
  const configs = await listCalendlyIntegrationConfigsForUser(userEmail)
  const active = configs.find((c) => c.isActive !== false) || configs[0]
  return active?.integrationId ? String(active.integrationId) : null
}

async function generateReceptiveCalendlyFlowFromDescription(
  userEmail: string,
  companiesId: string,
  rawDescription: string,
  refinedDescription: string,
  language: string,
  calendlyIntegrationId?: string | null
): Promise<FlowGenerateMvpResponse> {
  const lang = language || 'pt-BR'
  const runTag = makeIaRunTag()
  const names = inferReceptiveNames(rawDescription, refinedDescription)
  const calendlyId = await resolveCalendlyIntegrationIdForUser(userEmail, calendlyIntegrationId)

  const roleFull = buildFlexSchedTemplateRoleWithBusinessContext(refinedDescription)
  const templateName = buildIaTemplateName(FLOW_IA_PREFIX, names.suggestedFlowName, 'Receptivo + Calendly')
  const templateId = await rpcCreateAgentTemplate(
    userEmail,
    templateName,
    roleFull,
    FLEX_SCHED_TEMPLATE_DESCRIPTION.slice(0, 800)
  )

  const agentNome = buildIaAgentName(FLOW_IA_PREFIX, names.agentDisplayName, runTag)
  const agentBio =
    'Assistente receptivo com agenda Calendly (template flexivel). Identifica o cliente por nome e e-mail antes de agendar ou cancelar.'.slice(
      0,
      800
    )

  const agentId = await rpcCreateAgent(userEmail, agentNome, templateId, lang, agentBio)

  const personality = buildFlexSchedPersonalityWithBusinessContext(refinedDescription)
  const extraFeatures = calendlyId ? buildFlexSchedExtraFeaturesJson(calendlyId) : null

  await patchAgentRecord(agentId, companiesId, {
    personality_prompt: personality.slice(0, 32000),
    ...(extraFeatures ? { extra_features: extraFeatures } : {}),
  })

  const flow = buildLinearAgentFlow({
    agentId,
    agentName: agentNome,
    nodeLabel: names.agentDisplayName,
    templateId,
    templateName,
    primaryLanguage: lang,
    executionMode: 'agent',
  })

  const calendlyNote = calendlyId
    ? 'Ferramentas Calendly ativas no agente (modo agente no fluxo).'
    : 'Nenhuma integracao Calendly encontrada: configure em Integracoes e ative as ferramentas no agente.'

  return {
    refinedDescription,
    refinementProvider: 'none',
    flow,
    resourceChoice: {
      executionMode: 'agent',
      templateId,
      templateName,
      agentId,
      agentName: agentNome,
      nodeLabel: names.agentDisplayName,
      additionalInstructions: '',
    },
    generationMode: 'single_agent',
    suggestedFlowName: names.suggestedFlowName,
    structureSummary: `IA receptiva: template flexivel com Calendly + execucao via agente. ${calendlyNote}`,
    createdResources: {
      roleTemplateNames: [templateName],
      agentNames: [agentNome],
    },
  }
}

export async function generateMvpFlowFromDescription(
  userEmail: string,
  rawDescription: string,
  language: string,
  options?: { archetype?: FlowAgentArchetype; calendlyIntegrationId?: string | null }
): Promise<FlowGenerateMvpResponse> {
  const archetype = options?.archetype || 'generic'
  if (archetype === 'sdr') {
    throw new Error('IA SDR em desenvolvimento. Use IA receptiva por enquanto.')
  }

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

  const totalNewAgents = 1
  const activeCount = await getActiveAgentCount(companiesId)
  const planInfo = await getPlanInfo(companiesId)
  const limit = planInfo.limits.agents

  if (limit !== null && activeCount + totalNewAgents > limit) {
    throw new Error(
      `Este rascunho precisa criar ${totalNewAgents} agente novo, mas seu plano permite apenas ${limit} ativo(s) (${activeCount} em uso). Faça upgrade ou desative agentes antigos.`
    )
  }

  if (archetype === 'receptive') {
    const receptive = await generateReceptiveCalendlyFlowFromDescription(
      userEmail,
      companiesId,
      rawDescription,
      refinedDescription,
      lang,
      options?.calendlyIntegrationId
    )
    return { ...receptive, refinementProvider }
  }

  const plan = await generateSingleAgentConversationPlanWithOpenAI(refinedDescription, lang)
  const templateRaw = String(plan?.conversationTemplate || plan?.brainPrompt || '').trim()
  if (!plan || templateRaw.length < MIN_CONVERSATION_TEMPLATE_CHARS) {
    throw new Error(
      'Não foi possível gerar o template conversacional com a IA. Tente uma descrição mais detalhada do negócio e do atendimento desejado.'
    )
  }

  const runTag = makeIaRunTag()
  const flowDisplayName = (plan.suggestedFlowName?.trim() || 'Fluxo').slice(0, 120)
  const rawTrim = rawDescription.trim()
  const roleFull = appendUserProvidedUrlsBlock(
    appendSingleAgentTemplateFooter(templateRaw, lang),
    lang,
    rawTrim,
    refinedDescription
  )

  const templateName = buildIaTemplateName(FLOW_IA_PREFIX, flowDisplayName, 'Assistente (modelo único)')
  const templateId = await rpcCreateAgentTemplate(
    userEmail,
    templateName,
    roleFull,
    plan.structureSummary?.trim().slice(0, 800) ||
      'Template conversacional único gerado por Criar fluxo com IA (fluxo linear).'
  )

  const agentBaseName = String(plan.agentDisplayName || 'Assistente').trim().slice(0, 80) || 'Assistente'
  const agentNome = buildIaAgentName(FLOW_IA_PREFIX, agentBaseName, runTag)
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
    templateId,
    templateName,
    primaryLanguage: lang,
  })

  return {
    refinedDescription,
    refinementProvider,
    flow,
    resourceChoice: {
      executionMode: 'template',
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
