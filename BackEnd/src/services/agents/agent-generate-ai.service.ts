import '../../lib/env'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import { canCreateAgent, getPlanInfo } from '../../utils/plan-helper'
import { getActiveAgentCount } from '../usage-tracker.service'
import { PLATFORM_TEMPLATE_INTEGRATION_TOOLS_SECTION } from './agent-integration-tools-prompt'
import {
  buildExtraFeaturesFromSelection,
  type AgentToolSelectionInput,
} from './agent-extra-features'
import {
  buildFlexSchedTemplateRoleWithBusinessContext,
  buildFlexSchedPersonalityWithBusinessContext,
  FLEX_SCHED_TEMPLATE_DESCRIPTION,
  FLEX_SCHED_SPECIALTY,
  FLEX_SCHED_MEETING_LABEL,
} from '../../content/flexible-scheduling-template-pack'
import {
  appendSingleAgentTemplateFooter,
  appendUserProvidedUrlsBlock,
  buildAgentDesignBriefWithClaude,
  buildAgentAiDisplayName,
  buildAgentAiTemplateName,
  generateSingleAgentConversationPlanWithOpenAI,
  MIN_CONVERSATION_TEMPLATE_CHARS,
  patchAgentRecord,
  rpcCreateAgent,
  rpcCreateAgentTemplate,
  type RefinementProvider,
} from './agent-ai-generation.shared'
import {
  runAgentGenerateSmokeTest,
  type AgentGenerateValidationReport,
  type AgentAiArchetype,
} from './agent-generate-smoke-test.service'

export type { AgentAiArchetype }

export type AgentGenerateAiIntegrations = {
  whatsappIntegrationId?: string | null
  calendlyIntegrationId?: string | null
  crmIntegrationId?: string | null
}

export type GenerationStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped'

export type GenerationStep = {
  id: string
  label: string
  status: GenerationStepStatus
  detail?: string
}

export type GenerateAgentAiResult = {
  success: boolean
  /** Smoke test pós-criação; `success` indica que o agente foi persistido. */
  validationOk: boolean
  agent: {
    id: string
    nome: string
    templateId: string
    templateName: string
  }
  validationReport: AgentGenerateValidationReport
  refinedBrief: string
  refinementProvider: RefinementProvider
  generationSteps: GenerationStep[]
}


function buildToolsSummary(selectedTools: AgentToolSelectionInput[]): string {
  const enabled = (selectedTools || []).filter((t) => t.enabled !== false)
  if (enabled.length === 0) return '(nenhuma ferramenta selecionada)'
  return enabled
    .map((t) => {
      const key = t.toolKey || `${t.provider}.${t.toolName}`
      const ids: string[] = []
      if (t.integrationId) ids.push(`integrationId=${t.integrationId}`)
      if (t.crmIntegrationId) ids.push(`crmIntegrationId=${t.crmIntegrationId}`)
      return `- ${key}${ids.length ? ` (${ids.join(', ')})` : ''}`
    })
    .join('\n')
}

// ─── PRINCÍPIO GERAL DE GERAÇÃO ─────────────────────────────────────────────
// Toda integração/ferramenta segue o mesmo contrato:
//   • ATIVADA  → incluída no prompt gerado e nas regras do arquétipo.
//   • DESATIVADA → completamente ignorada; nenhum conteúdo relacionado é gerado.
//
// Ao adicionar novas integrações à plataforma, basta verificar `enabledTools`
// pelo campo `provider` (ex.: 'calendly', 'hubspot', 'whatsapp', 'future-crm')
// e inserir o bloco correspondente em `archetypeHint` e `appendArchetypeRules`.
// ─────────────────────────────────────────────────────────────────────────────

function resolveActiveProviders(enabledTools: AgentToolSelectionInput[]) {
  return {
    hasCalendly: enabledTools.some((t) => t.provider === 'calendly'),
    hasCRM: enabledTools.some((t) => t.provider === 'hubspot'),
    hasWhatsApp: enabledTools.some((t) => t.provider === 'whatsapp'),
    // Adicione novos providers aqui conforme chegarem na plataforma:
    // hasGmail: enabledTools.some((t) => t.provider === 'gmail'),
  }
}

function archetypeHint(archetype: AgentAiArchetype, enabledTools: AgentToolSelectionInput[]): string {
  const { hasCalendly, hasCRM } = resolveActiveProviders(enabledTools)

  if (archetype === 'faq') {
    return 'FAQ agent: answer questions, guide users, consultive tone, no aggressive sales or mandatory scheduling flow.'
  }

  if (archetype === 'receptive') {
    const parts: string[] = ['Receptive agent: welcome and assist inbound users via WhatsApp', 'collect relevant user data progressively']
    if (hasCalendly) parts.push('schedule/reschedule/cancel appointments via Calendly tools')
    if (hasCRM) parts.push('save and update contact data in CRM (HubSpot)')
    if (!hasCalendly && !hasCRM) parts.push('handle requests through conversation and escalate to human when needed')
    return parts.join(', ') + '.'
  }

  // SDR — preparado para quando o arquétipo for habilitado na plataforma.
  // Lógica mais complexa que o Receptivo: foco em prospecção, qualificação (BANT)
  // e pipeline. Cada ferramenta ativa adiciona uma camada ao funil automatizado.
  if (archetype === 'sdr') {
    const parts: string[] = [
      'SDR agent: proactively qualify inbound and outbound leads via WhatsApp',
      'collect qualification data progressively (budget, authority, need, timeline)',
      'adapt conversation pace to lead engagement and intent signals',
    ]
    if (hasCalendly) parts.push('schedule discovery calls or demos via Calendly only after minimum qualification is confirmed (interest + basic fit)')
    if (hasCRM) parts.push('create contact records and update deal/lead stages in CRM (HubSpot) after each relevant qualification step')
    if (!hasCalendly && !hasCRM) parts.push('qualify via conversation only and hand off hot leads to human sales rep with full context')
    return parts.join('; ') + '.'
  }

  return `Unknown archetype: ${archetype}`
}

function appendArchetypeRules(
  roleBody: string,
  archetype: AgentAiArchetype,
  language: string,
  enabledTools: AgentToolSelectionInput[]
): string {
  const isPt = language.toLowerCase().startsWith('pt')
  const { hasCalendly, hasCRM } = resolveActiveProviders(enabledTools)

  if (archetype === 'faq') {
    const block = isPt
      ? `\n\n---\nMODO FAQ:\n- Priorize respostas claras a duvidas; nao force agendamento.\n- Se o usuario pedir humano, oriente contato com a equipe.\n- Use ferramentas de integracao apenas quando o tema exigir.`
      : `\n\n---\nFAQ MODE: Answer questions clearly; do not force scheduling.`
    return (roleBody + block).slice(0, 32000)
  }

  if (archetype === 'receptive') {
    const rules: string[] = []
    if (hasCalendly) {
      rules.push(isPt
        ? '- Colete nome completo e e-mail antes de agendar, consultar ou cancelar reunioes.'
        : '- Collect full name and email before scheduling, querying, or cancelling appointments.')
      rules.push(isPt
        ? '- Use Calendly em silencio (sem avisar que vai consultar agenda).'
        : '- Use Calendly tools silently, without announcing the lookup.')
    }
    if (hasCRM) {
      rules.push(isPt
        ? '- Registre e atualize dados do contato no CRM quando aplicavel.'
        : '- Save and update contact data in the CRM when applicable.')
    }
    if (!hasCalendly && !hasCRM) {
      rules.push(isPt
        ? '- Colete informacoes relevantes progressivamente para entender a necessidade do usuario.'
        : '- Collect relevant information progressively to understand user needs.')
      rules.push(isPt
        ? '- Sem ferramentas externas habilitadas, auxilie com base na conversa e encaminhe para humano quando necessario.'
        : '- Without external tools, assist via conversation and escalate to human when needed.')
    }
    if (rules.length === 0) return roleBody
    const header = isPt ? '\n\n---\nMODO RECEPTIVO:\n' : '\n\n---\nRECEPTIVE MODE:\n'
    return (roleBody + header + rules.join('\n')).slice(0, 32000)
  }

  // SDR — regras preparadas para quando o arquétipo for habilitado.
  // Mais complexo que o Receptivo: combina prospecção, qualificação estruturada
  // e pipeline. As regras variam dinamicamente com base nas ferramentas ativas.
  if (archetype === 'sdr') {
    const rules: string[] = []
    // Regras base — sempre presentes no SDR
    rules.push(isPt
      ? '- Qualifique o lead com perguntas naturais (interesse, necessidade, perfil) antes de qualquer acao externa.'
      : '- Qualify the lead with natural questions (interest, need, fit) before any external action.')
    rules.push(isPt
      ? '- Nao seja agressivo; adapte o ritmo ao engajamento e aos sinais de intencao do lead.'
      : '- Avoid aggressive tactics; adapt conversation pace to lead engagement and intent signals.')
    rules.push(isPt
      ? '- Nunca invente disponibilidade, precos, prazos ou condicoes comerciais.'
      : '- Never invent availability, prices, deadlines, or commercial terms.')
    // Regras condicionais por integração
    if (hasCalendly) {
      rules.push(isPt
        ? '- Agende reuniao (discovery call / demo) somente apos qualificacao minima confirmada (interesse + fit basico).'
        : '- Schedule a meeting (discovery call / demo) only after minimum qualification is confirmed (interest + basic fit).')
      rules.push(isPt
        ? '- Use Calendly em silencio para verificar disponibilidade; confirme horario antes de enviar o link.'
        : '- Use Calendly silently to check availability; confirm the time slot before sending the link.')
    }
    if (hasCRM) {
      rules.push(isPt
        ? '- Crie o contato e registre as informacoes de qualificacao no CRM apos cada etapa relevante da conversa.'
        : '- Create the contact record and log qualification data in the CRM after each relevant conversation stage.')
      rules.push(isPt
        ? '- Atualize o estagio do negocio (deal stage) no CRM conforme o lead avanca no funil.'
        : '- Update the deal stage in the CRM as the lead advances through the funnel.')
    }
    if (!hasCalendly && !hasCRM) {
      rules.push(isPt
        ? '- Sem ferramentas externas ativas, qualifique exclusivamente via conversa e encaminhe leads quentes para o vendedor humano com contexto completo.'
        : '- Without active external tools, qualify exclusively via conversation and route hot leads to a human sales rep with full context.')
    }
    // Regra de handoff — sempre presente no SDR
    rules.push(isPt
      ? '- Ao encaminhar para humano, resuma: intencao do lead, dados coletados, nivel de qualificacao, proximos passos recomendados.'
      : '- When handing off, summarize: lead intent, collected data, qualification level, recommended next steps.')
    const header = isPt ? '\n\n---\nMODO SDR:\n' : '\n\n---\nSDR MODE:\n'
    return (roleBody + header + rules.join('\n')).slice(0, 32000)
  }

  return roleBody
}

function buildRoleFromPlan(
  plan: {
    conversationTemplate?: string
    brainPrompt?: string
  },
  brief: string,
  rawDescription: string,
  language: string,
  archetype: AgentAiArchetype,
  hasCalendlyTools: boolean,
  enabledTools: AgentToolSelectionInput[]
): string {
  let role = String(plan.conversationTemplate || plan.brainPrompt || '').trim()

  if (hasCalendlyTools && archetype === 'receptive') {
    role = buildFlexSchedTemplateRoleWithBusinessContext(brief)
  } else if (role.length < MIN_CONVERSATION_TEMPLATE_CHARS) {
    throw new Error(
      'Não foi possível gerar o template conversacional com a IA. Tente uma descrição mais detalhada.'
    )
  }

  role = appendUserProvidedUrlsBlock(
    appendSingleAgentTemplateFooter(appendArchetypeRules(role, archetype, language, enabledTools), language),
    language,
    rawDescription,
    brief
  )

  if (!role.includes('FERRAMENTAS DE INTEGRACAO')) {
    role = `${role}\n\n${PLATFORM_TEMPLATE_INTEGRATION_TOOLS_SECTION}`.slice(0, 32000)
  }

  return role
}

export async function generateAgentWithAi(
  userEmail: string,
  params: {
    description: string
    language: string
    archetype: AgentAiArchetype
    agentName?: string
    selectedTools: AgentToolSelectionInput[]
    integrations?: AgentGenerateAiIntegrations
  }
): Promise<GenerateAgentAiResult> {
  const steps: GenerationStep[] = [
    { id: 'brief', label: 'Brief de design (Claude)', status: 'pending' },
    { id: 'template', label: 'Template e personalidade (GPT)', status: 'pending' },
    { id: 'persist', label: 'Criar template e agente', status: 'pending' },
    { id: 'validate', label: 'Testar integrações e chat', status: 'pending' },
  ]

  const setStep = (id: string, status: GenerationStepStatus, detail?: string) => {
    const step = steps.find((s) => s.id === id)
    if (step) {
      step.status = status
      if (detail) step.detail = detail
    }
  }

  if (params.archetype === 'sdr') {
    throw new Error('IA SDR em desenvolvimento. Escolha FAQ ou Receptivo.')
  }

  const lang = params.language || 'pt-BR'
  const rawDescription = String(params.description || '').trim()
  if (!rawDescription) {
    throw new Error('Descreva o tema e a finalidade do agente.')
  }

  const companiesId = await getCompanyIdByEmail(userEmail)
  if (!companiesId) {
    throw new Error('Empresa não encontrada para o usuário.')
  }

  const planCheck = await canCreateAgent(companiesId)
  if (!planCheck.allowed) {
    throw new Error(planCheck.reason || 'Não é possível criar agentes no plano atual.')
  }

  const activeCount = await getActiveAgentCount(companiesId)
  const planInfo = await getPlanInfo(companiesId)
  const limit = planInfo.limits.agents
  if (limit !== null && activeCount + 1 > limit) {
    throw new Error(
      `Seu plano permite apenas ${limit} agente(s) ativo(s) (${activeCount} em uso). Faça upgrade ou desative agentes antigos.`
    )
  }

  const toolsSummary = buildToolsSummary(params.selectedTools)
  const enabledTools = (params.selectedTools || []).filter((t) => t.enabled !== false)
  const hasCalendlyTools = enabledTools.some((t) => t.provider === 'calendly')

  if (params.archetype === 'receptive' && enabledTools.length === 0) {
    throw new Error('Agente receptivo exige ao menos uma integração/ferramenta selecionada.')
  }

  setStep('brief', 'running')
  const briefResult = await buildAgentDesignBriefWithClaude({
    rawDescription,
    language: lang,
    archetype: params.archetype,
    toolsSummary,
  })

  if (!briefResult.ok) {
    setStep('brief', 'failed', briefResult.message)
    throw new Error(briefResult.message || 'Falha ao gerar brief com Claude.')
  }

  const refinedBrief = briefResult.text
  setStep('brief', 'done')

  setStep('template', 'running')
  const plan = await generateSingleAgentConversationPlanWithOpenAI(refinedBrief, lang, {
    archetypeHint: archetypeHint(params.archetype, enabledTools),
    toolsSummary,
    rawDescription,
  })

  if (!plan) {
    setStep('template', 'failed', 'GPT não retornou plano válido')
    throw new Error('Não foi possível gerar o template com a IA. Tente uma descrição mais detalhada.')
  }

  const roleFull = buildRoleFromPlan(plan, refinedBrief, rawDescription, lang, params.archetype, hasCalendlyTools, enabledTools)

  const displayTitle =
    String(params.agentName || '').trim() ||
    plan.agentDisplayName?.trim() ||
    plan.suggestedFlowName?.trim() ||
    (params.archetype === 'receptive' ? 'Assistente receptivo' : 'Assistente FAQ')

  const templateDescription =
    plan.templateDescription?.trim().slice(0, 800) ||
    plan.structureSummary?.trim().slice(0, 800) ||
    `Agente ${params.archetype} gerado por IA.`

  let personality =
    plan.personalityPrompt?.trim() ||
    (params.archetype === 'receptive'
      ? buildFlexSchedPersonalityWithBusinessContext(refinedBrief)
      : `Assistente virtual profissional. Tom cordial e objetivo. Contexto: ${refinedBrief.slice(0, 1500)}`)

  const welcomeMessage =
    plan.welcomeMessage?.trim() ||
    (params.archetype === 'receptive'
      ? 'Olá! Posso ajudar com informações ou com sua agenda. Como posso ajudar você hoje?'
      : 'Olá! Como posso ajudar você hoje?')

  setStep('template', 'done')

  setStep('persist', 'running')
  const agentNome = buildAgentAiDisplayName(
    params.agentName,
    plan.agentDisplayName?.trim() || displayTitle
  )
  const templateName = buildAgentAiTemplateName(agentNome, params.archetype)
  const templateId = await rpcCreateAgentTemplate(userEmail, templateName, roleFull, templateDescription)
  const agentBio = `Agente ${params.archetype} criado com IA. ${templateDescription}`.slice(0, 800)
  const agentId = await rpcCreateAgent(userEmail, agentNome, templateId, lang, agentBio)

  const extraFeaturesJson = buildExtraFeaturesFromSelection({
    selectedTools: params.selectedTools,
    welcomeMessage,
    schedulingEngine: hasCalendlyTools ? 'template' : undefined,
    defaultCalendlySpecialty: FLEX_SCHED_SPECIALTY,
    defaultMeetingLabel: FLEX_SCHED_MEETING_LABEL,
  })

  const whatsappId = String(params.integrations?.whatsappIntegrationId || '').trim() || null
  const crmId = String(params.integrations?.crmIntegrationId || '').trim() || null

  const patch: Record<string, unknown> = {
    personality_prompt: personality.slice(0, 32000),
    extra_features: extraFeaturesJson,
  }
  if (whatsappId) patch.integrations_id = whatsappId
  if (crmId) patch.crm_integration_id = crmId

  await patchAgentRecord(agentId, companiesId, patch)
  setStep('persist', 'done')

  setStep('validate', 'running')
  const validationReport = await runAgentGenerateSmokeTest({
    agentId,
    userEmail,
    archetype: params.archetype,
    selectedTools: params.selectedTools,
    integrations: params.integrations,
  })
  setStep('validate', validationReport.ok ? 'done' : 'failed', validationReport.ok ? undefined : 'Alguns testes falharam')

  return {
    success: true,
    validationOk: validationReport.ok,
    agent: {
      id: agentId,
      nome: agentNome,
      templateId,
      templateName,
    },
    validationReport,
    refinedBrief,
    refinementProvider: 'claude',
    generationSteps: steps,
  }
}
