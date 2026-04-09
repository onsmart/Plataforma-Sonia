import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { chatText } from '../llm/openai'
import { buildAgentSystemPrompt } from '../agents/prompt-builder'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import { getHistoryFromRedis } from '../integrations/whatsapp/whatsapp.redis'

const DEFAULT_TEMPLATE_MODEL = 'gpt-4o'
const DEFAULT_TEMPLATE_TEMPERATURE = 0.2
const DEFAULT_TEMPLATE_MAX_TOKENS = 1200

interface TemplateExecutionParams {
  userEmail: string
  templateId: string
  message: string
  context?: Record<string, any>
  additionalInstructions?: string
}

interface FlowTemplate {
  id: string
  name: string
  role: string | null
  description?: string | null
  companies_id?: string | null
}

function replaceTemplateVariables(text: string, context?: Record<string, any>): string {
  if (!text || typeof text !== 'string' || !context) {
    return text
  }

  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    let value = context[key]

    if (value === undefined) {
      for (const nestedValue of Object.values(context)) {
        if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue) && nestedValue[key] !== undefined) {
          value = nestedValue[key]
          break
        }
      }
    }

    return value !== undefined && value !== null ? String(value) : match
  })
}

async function getTemplateById(userEmail: string, templateId: string): Promise<FlowTemplate> {
  const companiesId = await getCompanyIdByEmail(userEmail)

  let query = supabase
    .from('tb_agents_templates')
    .select('id, name, role, description, companies_id')
    .eq('id', templateId)

  if (companiesId) {
    query = query.or(`companies_id.eq.${companiesId},companies_id.is.null`)
  } else {
    query = query.is('companies_id', null)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw new Error(`Erro ao buscar template: ${error.message}`)
  }

  if (!data) {
    throw new Error(`Template ${templateId} não encontrado ou não pertence à empresa do usuário`)
  }

  return data as FlowTemplate
}

function appendChannelContext(systemPrompt: string, context?: Record<string, any>): string {
  const channelContext = String(context?.channel || '').trim().toLowerCase()
  const isInternalWebchat = channelContext === 'webchat' || channelContext === 'playground'
  const hasWhatsAppContext =
    channelContext === 'whatsapp' ||
    (!isInternalWebchat && !!(context?.phone_number || context?.from || context?.to))
  const disableChannelDelivery = Boolean(context?.disable_channel_delivery)

  if (isInternalWebchat) {
    return `${systemPrompt}

CONTEXTO DO CANAL:
- Esta conversa esta acontecendo no chat interno da plataforma (webchat/playground).
- Responda de forma compatível com um fluxo interno da plataforma.
- Se o template precisar devolver dados estruturados, siga exatamente o formato pedido nas instruções.`
  }

  if (hasWhatsAppContext) {
    const whatsappPrompt = `${systemPrompt}

CONTEXTO DO CANAL:
- Esta conversa esta acontecendo via WhatsApp.
- Responda considerando um tom conversacional, direto e natural para WhatsApp.
- Se o template precisar devolver JSON ou dados estruturados para o fluxo, mantenha o formato pedido sem adicionar texto extra.`

    if (disableChannelDelivery) {
      return `${whatsappPrompt}

CONTEXTO DE EXECUCAO:
- Voce esta executando dentro de um flow.
- Nao tente disparar mensagens externas diretamente.
- Produza apenas o conteudo final ou os dados estruturados necessarios para o flow.`
    }

    return whatsappPrompt
  }

  return systemPrompt
}

const FLOW_WHATSAPP_CONTINUITY_BLOCK = `
CONTINUIDADE (FLOW WHATSAPP):
- Use o histórico da conversa para saber em qual etapa o usuário está.
- Não repita menu, saudação inicial ou opções já enviadas pelo assistente; avance só o próximo passo lógico.
- Envie UMA mensagem coesa ao usuário, sem colar o menu inteiro de novo antes da continuação.`

export async function executeFlowTemplateNode({
  userEmail,
  templateId,
  message,
  context,
  additionalInstructions
}: TemplateExecutionParams): Promise<string> {
  const template = await getTemplateById(userEmail, templateId)
  const runtimeInstructions = replaceTemplateVariables(additionalInstructions || '', context)

  let systemPrompt = buildAgentSystemPrompt(runtimeInstructions, template.role || '')
  if (!systemPrompt.trim()) {
    systemPrompt = 'Você é um assistente virtual útil.'
  }

  systemPrompt = appendChannelContext(systemPrompt, context)

  let userMessageForLlm = message
  const channelLower = String(context?.channel || '').trim().toLowerCase()
  const integrationsId = String(context?.integrations_id || '').trim()
  const chatRef = String(context?.phone_number || context?.from || context?.to || '').trim()

  if (channelLower === 'whatsapp' && integrationsId && chatRef) {
    try {
      const waHist = await getHistoryFromRedis(integrationsId, chatRef, 20)
      if (waHist.length > 0) {
        const historyText = waHist.map((m) => `${m.role}: ${m.content}`).join('\n')
        userMessageForLlm = `Histórico recente da conversa no WhatsApp (ordem cronológica):\n${historyText}\n\n---\n\n${message}`
        systemPrompt = `${systemPrompt}\n${FLOW_WHATSAPP_CONTINUITY_BLOCK}`
        logger.log(`[executeFlowTemplateNode] Histórico WhatsApp injetado (${waHist.length} mensagens)`)
      }
    } catch (e: any) {
      logger.warn('[executeFlowTemplateNode] Falha ao ler histórico Redis:', e?.message)
    }
  }

  logger.info(`[executeFlowTemplateNode] Executando template ${template.id} (${template.name}) em memória`)
  logger.log(`[executeFlowTemplateNode] Prompt preparado:`, {
    templateId: template.id,
    templateName: template.name,
    hasAdditionalInstructions: !!runtimeInstructions,
    systemPromptLength: systemPrompt.length,
    messageLength: userMessageForLlm?.length || 0
  })

  const result = await chatText({
    system: systemPrompt,
    user: userMessageForLlm,
    model: DEFAULT_TEMPLATE_MODEL,
    temperature: DEFAULT_TEMPLATE_TEMPERATURE,
    maxTokens: DEFAULT_TEMPLATE_MAX_TOKENS,
  })

  if (!result.success) {
    logger.error('[executeFlowTemplateNode] Erro ao executar template:', {
      templateId,
      error: result.error
    })
    throw new Error(result.content || 'Falha ao executar template no flow')
  }

  return result.content
}
