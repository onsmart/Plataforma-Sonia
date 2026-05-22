import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { normalizeAgentLanguageCode } from '../../utils/agent-language'
import { getUserIdAndCompanyIdByEmail } from '../../utils/company-helper'
import { listCalendlyIntegrationConfigsForUser } from '../integrations/calendly'
import { ONSMART_FAQ_SEED_TEXT, ONSMART_WELCOME_MESSAGE } from '../../content/onsmart-faq-seed'
import { buildOnsmartExtraFeaturesJson } from './onsmart-agent-config'

const TEMPLATE_NAME = 'Onsmart — Sonia Receptiva + Agenda'
const AGENT_NAME = 'Sonia — Onsmart.AI (Demo)'
const DEFAULT_LANGUAGE = 'pt-BR'
const DEFAULT_SPECIALTY = 'reuniao_diagnostico'

const TEMPLATE_ROLE = `Voce e a Sonia, assistente virtual da Onsmart.AI no WhatsApp.

ESCOPO DE CONHECIMENTO (obrigatorio):
- Responda APENAS sobre tecnologia, inteligencia artificial e os servicos/solucoes da Onsmart (site https://www.onsmart.ai).
- Use a base de conhecimento (RAG) e o contexto abaixo; se nao souber, diga que vai indicar o site ou uma conversa com o time.
- NAO responda temas pessoais, medicos, juridicos, politicos ou produtos de terceiros sem relacao com a Onsmart.

AGENDAMENTO (regra critica):
- Voce NAO confirma horarios por conta propria. Um motor de agendamento integrado ao Calendly valida disponibilidade e cria o evento.
- Quando o usuario quiser agendar, diagnostico, reuniao ou falar com o time: agradeça o interesse e deixe o fluxo de agendamento conduzir a coleta (nome, telefone, e-mail, dia e horario).
- NUNCA invente links de reuniao nem diga "esta marcado" sem confirmacao do sistema.

TOM:
- Profissional, clara, objetiva, em portugues do Brasil.
- Mensagens curtas, adequadas ao WhatsApp.

${onsmartFaqBlock()}`

function onsmartFaqBlock(): string {
  return `CONTEXTO ONSMART (resumo):\n${ONSMART_FAQ_SEED_TEXT.slice(0, 1200)}`
}

const PERSONALITY_PROMPT = `Voce e acolhedora e consultiva. Priorize ajudar o visitante a entender como a Onsmart aplica IA no negocio dele. Se houver interesse comercial, conduza naturalmente ao agendamento de uma conversa.`

export interface ProvisionOnsmartDemoOptions {
  calendlyIntegrationId?: string | null
  whatsappIntegrationId?: string | null
  specialty?: string | null
  welcomeMessage?: string | null
}

export interface ProvisionOnsmartDemoResult {
  templateId: string
  agentId: string
  templateName: string
  agentName: string
  calendlyIntegrationId: string
  whatsappIntegrationId: string | null
  specialty: string
  welcomeMessage: string
  faqSeedHint: string
  setupSteps: string[]
}

function unwrapRpcId(data: unknown): string {
  if (typeof data === 'string' && data.trim()) return data.trim()
  if (data && typeof data === 'object' && 'id' in data) {
    const id = String((data as { id?: unknown }).id || '').trim()
    if (id) return id
  }
  throw new Error('RPC nao retornou ID valido.')
}

async function resolveCalendlyIntegrationId(
  userEmail: string,
  preferred?: string | null
): Promise<string> {
  const normalized = String(preferred || '').trim()
  if (normalized) return normalized

  const integrations = await listCalendlyIntegrationConfigsForUser(userEmail)
  const active = integrations.find((item) => item.isActive !== false && item.isDefault === true)
  const fallback = active || integrations.find((item) => item.isActive !== false)
  if (fallback?.integrationId) {
    return String(fallback.integrationId)
  }
  throw new Error(
    'Integre uma conta Calendly ativa antes de provisionar a demo Onsmart. Mapeie o Event Type com specialty "reuniao_diagnostico" (ou informe specialty no body).'
  )
}

async function ensureTemplate(email: string, companiesId: string): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from('tb_agents_templates')
    .select('id')
    .eq('name', TEMPLATE_NAME)
    .eq('companies_id', companiesId)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Buscar template: ${existingError.message}`)
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('tb_agents_templates')
      .update({
        role: TEMPLATE_ROLE,
        description: 'Demo Onsmart: FAQ tecnologia/IA + agendamento Calendly no chat.',
        icon: 'bot',
        complexity: 'Advanced',
      })
      .eq('id', existing.id)

    if (updateError) throw new Error(`Atualizar template: ${updateError.message}`)
    return String(existing.id)
  }

  const { data, error } = await supabase.rpc('sp_create_agent_template', {
    p_name: TEMPLATE_NAME,
    p_role: TEMPLATE_ROLE,
    p_description: 'Demo Onsmart: FAQ tecnologia/IA + agendamento Calendly no chat.',
    p_icon: 'bot',
    p_complexity: 'Advanced',
    p_channel_names: ['whatsapp', 'webchat'],
    p_skill_names: [],
    p_email: email,
  })

  if (error) throw new Error(`Criar template: ${error.message}`)
  return unwrapRpcId(data)
}

async function ensureAgent(
  email: string,
  companiesId: string,
  templateId: string,
  whatsappIntegrationId: string | null,
  extraFeaturesJson: string
): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from('tb_agents')
    .select('id')
    .eq('nome', AGENT_NAME)
    .eq('companies_id', companiesId)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Buscar agente: ${existingError.message}`)
  }

  const agentPatch = {
    role_template_id: templateId,
    personality_prompt: PERSONALITY_PROMPT,
    extra_features: extraFeaturesJson,
    integrations_id: whatsappIntegrationId,
    provider: 'openai',
    provider_model: 'gpt-4o-mini',
    temperature: 0.35,
    max_tokens: 1400,
    status_id: 1,
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('tb_agents')
      .update(agentPatch)
      .eq('id', existing.id)

    if (updateError) throw new Error(`Atualizar agente: ${updateError.message}`)
    return String(existing.id)
  }

  const { data, error } = await supabase.rpc('sp_create_agent_by_email', {
    p_email: email,
    p_nome: AGENT_NAME,
    p_role_template_id: templateId,
    p_primary_language: normalizeAgentLanguageCode(DEFAULT_LANGUAGE, DEFAULT_LANGUAGE),
    p_bio: 'Assistente demo Onsmart — FAQ e agendamento Calendly.',
    p_integrations_id: whatsappIntegrationId,
  })

  if (error) throw new Error(`Criar agente: ${error.message}`)

  const agentId = unwrapRpcId(data)
  const { error: updateError } = await supabase.from('tb_agents').update(agentPatch).eq('id', agentId)

  if (updateError) throw new Error(`Configurar agente: ${updateError.message}`)
  return agentId
}

async function bindWhatsAppIntegration(
  integrationId: string,
  companiesId: string
): Promise<void> {
  const patch: Record<string, unknown> = {
    automation_mode: 'agent',
    linked_flow_id: null,
    updated_at: new Date().toISOString(),
  }

  let response = await supabase
    .from('tb_integrations')
    .update(patch)
    .eq('id', integrationId)
    .eq('companies_id', companiesId)

  if (response.error && String(response.error.message).toLowerCase().includes('automation_mode')) {
    response = await supabase
      .from('tb_integrations')
      .update({ linked_flow_id: null, updated_at: new Date().toISOString() })
      .eq('id', integrationId)
      .eq('companies_id', companiesId)
  }

  if (response.error) {
    throw new Error(`Vincular WhatsApp: ${response.error.message}`)
  }
}

export async function provisionOnsmartDemo(
  userEmail: string,
  options?: ProvisionOnsmartDemoOptions
): Promise<ProvisionOnsmartDemoResult> {
  const normalizedEmail = String(userEmail || '').trim().toLowerCase()
  if (!normalizedEmail) {
    throw new Error('Email do usuario e obrigatorio.')
  }

  const identity = await getUserIdAndCompanyIdByEmail(normalizedEmail)
  if (!identity.companyId) {
    throw new Error('Empresa nao encontrada para o usuario autenticado.')
  }

  const calendlyIntegrationId = await resolveCalendlyIntegrationId(
    normalizedEmail,
    options?.calendlyIntegrationId
  )
  const specialty = String(options?.specialty || DEFAULT_SPECIALTY).trim() || DEFAULT_SPECIALTY
  const welcomeMessage = String(options?.welcomeMessage || ONSMART_WELCOME_MESSAGE).trim()
  const whatsappIntegrationId = String(options?.whatsappIntegrationId || '').trim() || null

  const extraFeaturesJson = buildOnsmartExtraFeaturesJson({
    calendlyIntegrationId,
    specialty,
    welcomeMessage,
  })

  const templateId = await ensureTemplate(normalizedEmail, identity.companyId)
  const agentId = await ensureAgent(
    normalizedEmail,
    identity.companyId,
    templateId,
    whatsappIntegrationId,
    extraFeaturesJson
  )

  if (whatsappIntegrationId) {
    await bindWhatsAppIntegration(whatsappIntegrationId, identity.companyId)
  }

  const setupSteps = [
    `Calendly: confirme o mapeamento da specialty "${specialty}" para seu Event Type em Configurações → Integrações.`,
    'WhatsApp: integração em modo Agente (sem fluxo vinculado).',
    'Base de conhecimento: envie um arquivo .txt com o FAQ do site onsmart.ai no agente provisionado.',
    'Teste: envie "oi" e depois "quero agendar um diagnóstico".',
  ]

  logger.info('[provision-onsmart-demo] Demo provisionada', {
    userEmail: normalizedEmail,
    companyId: identity.companyId,
    templateId,
    agentId,
    calendlyIntegrationId,
    whatsappIntegrationId,
    specialty,
  })

  return {
    templateId,
    agentId,
    templateName: TEMPLATE_NAME,
    agentName: AGENT_NAME,
    calendlyIntegrationId,
    whatsappIntegrationId,
    specialty,
    welcomeMessage,
    faqSeedHint: ONSMART_FAQ_SEED_TEXT.slice(0, 400) + '...',
    setupSteps,
  }
}

export const __test__ = {
  TEMPLATE_NAME,
  AGENT_NAME,
  DEFAULT_SPECIALTY,
}
