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

/** Chaves comuns no contexto do flow / integração para substituir [link] no prompt (antes do LLM). */
function resolveContextLinkValue(context?: Record<string, any>): string {
  if (!context || typeof context !== 'object') return ''
  const keys = [
    'scheduling_url',
    'schedulingUrl',
    'agendamento_url',
    'link_agendamento',
    'linkAgendamento',
    'linkUrl',
    'link_url',
    'booking_url',
    'bookingUrl',
    'url',
    'link',
  ]
  for (const k of keys) {
    const v = context[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

/** Substitui [link] / [url] no texto do prompt se o contexto trouxer URL (evita modelo copiar placeholder literal). */
function replaceBracketLinkShortcuts(text: string, context?: Record<string, any>): string {
  if (!text || typeof text !== 'string') return text
  const link = resolveContextLinkValue(context)
  if (!link) return text
  return text
    .replace(/\[link\]/gi, link)
    .replace(/\[URL\]/g, link)
    .replace(/\[url\]/g, link)
}

function preparePromptSegment(raw: string, context?: Record<string, any>): string {
  return replaceBracketLinkShortcuts(replaceTemplateVariables(raw || '', context), context)
}

function extractHttpUrlsFromText(text: string): string[] {
  if (!text || typeof text !== 'string') return []
  const re = /https?:\/\/[^\s\])}>'"\]]+/gi
  const found = text.match(re) || []
  return [...new Set(found)]
}

/**
 * Se o modelo ainda devolver [link], troca por URLs presentes no system prompt (instruções).
 */
function repairAssistantLinkPlaceholders(reply: string, systemPrompt: string): string {
  if (!reply || typeof reply !== 'string') return reply
  if (!/\[(?:link|url|URL)\]/i.test(reply)) return reply
  const urls = extractHttpUrlsFromText(systemPrompt)
  if (urls.length === 0) return reply
  let i = 0
  return reply.replace(/\[(?:link|url|URL)\]/gi, () => {
    const u = urls[Math.min(i, urls.length - 1)]
    i += 1
    return u
  })
}

const FLOW_ANTI_PLACEHOLDER_BLOCK = `
FORMATO DAS RESPOSTAS (obrigatorio):
- Nao envie ao usuario placeholders como [link], [URL], [aqui] ou chaves {{assim}}: use sempre texto final.
- Toda URL que voce mencionar deve ser copiada literalmente das instrucoes acima (completa, comecando com http ou https).
- Se as instrucoes descrevem um link de agendamento ou suporte, inclua essa URL real na mensagem quando for relevante.`

const FLOW_WHATSAPP_CONTINUITY_BLOCK = `
CONTINUIDADE (FLOW WHATSAPP):
- Se o historico ainda NAO contiver mensagens anteriores do assistente, pode cumprimentar e seguir o modelo de papel (incluindo opcoes iniciais breves, se estiverem descritas).
- Depois que o assistente ja respondeu nesta conversa, evite repetir o mesmo menu ou saudacao longa; avance o proximo passo logico.
- Envie UMA mensagem coesa por vez.`

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

export async function executeFlowTemplateNode({
  userEmail,
  templateId,
  message,
  context,
  additionalInstructions
}: TemplateExecutionParams): Promise<string> {
  const template = await getTemplateById(userEmail, templateId)
  const runtimeInstructions = preparePromptSegment(additionalInstructions || '', context)
  const runtimeRole = preparePromptSegment(template.role || '', context)

  let systemPrompt = buildAgentSystemPrompt(runtimeInstructions, runtimeRole)
  if (!systemPrompt.trim()) {
    systemPrompt = 'Você é um assistente virtual útil.'
  }

  systemPrompt = appendChannelContext(systemPrompt, context)
  systemPrompt = `${systemPrompt}\n${FLOW_ANTI_PLACEHOLDER_BLOCK}`

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

  return repairAssistantLinkPlaceholders(String(result.content || ''), systemPrompt)
}
