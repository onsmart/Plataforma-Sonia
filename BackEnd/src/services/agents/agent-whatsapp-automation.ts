import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { chatWithAgent } from './chatwithAgent'
import {
  getHistoryFromRedis,
  saveMessageToHistory,
} from '../integrations/whatsapp/whatsapp.redis'
import { sendAgentWhatsAppResponseWithVoiceFallback } from '../../modules/voice/services/voiceRuntime.service'
import {
  parseOnsmartExtraFeatures,
  resolveOnsmartWelcomeMessage,
  resolveSchedulingConfig,
} from './onsmart-agent-config'
import { processSchedulingTurn } from './agent-scheduling-coordinator'

export interface AgentWhatsAppTurnParams {
  integrationId: string
  agentId: string
  userEmail: string
  messageText: string
  phoneNumber: string
  from: string
  to: string
  contactId: string
  messageDbId?: string
  requestStartedAt?: string
}

export interface AgentWhatsAppTurnResult {
  handled: boolean
  replyText?: string
  agentResult?: unknown
  reason?: string
}

async function loadAgentRow(agentId: string, companiesId: string | null | undefined) {
  let query = supabase
    .from('tb_agents')
    .select('id, nome, status_id, integrations_id, extra_features, companies_id')
    .eq('id', agentId)

  if (companiesId) {
    query = query.eq('companies_id', companiesId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

async function deliverWhatsAppReply(params: {
  integrationId: string
  targetConversationId: string
  agentId: string
  replyText: string
  requestStartedAt: string
}): Promise<void> {
  const delivery = await sendAgentWhatsAppResponseWithVoiceFallback({
    integrationId: params.integrationId,
    to: params.targetConversationId,
    text: params.replyText,
    agentId: params.agentId,
    context: { request_started_at: params.requestStartedAt },
  })

  if (delivery.sendResult?.success) {
    await saveMessageToHistory(
      params.integrationId,
      params.targetConversationId,
      'assistant',
      params.replyText
    )
  } else {
    logger.warn('[agent-whatsapp-automation] Falha ao enviar WhatsApp', {
      error: delivery.sendResult?.error,
    })
  }
}

export async function runAgentWhatsAppTurn(
  params: AgentWhatsAppTurnParams
): Promise<AgentWhatsAppTurnResult> {
  const agent = await loadAgentRow(params.agentId, null)
  if (!agent) {
    return { handled: false, reason: 'Agente nao encontrado' }
  }

  const statusId = Number(agent.status_id)
  if (statusId !== 1) {
    return { handled: false, reason: 'Agente inativo' }
  }

  const integrationId = String(agent.integrations_id || params.integrationId).trim()
  const targetConversationId =
    params.contactId || params.phoneNumber || params.from

  const extra = parseOnsmartExtraFeatures(agent.extra_features)
  const welcomeMessage = resolveOnsmartWelcomeMessage(extra)
  const schedulingConfig = resolveSchedulingConfig(extra)

  const history = await getHistoryFromRedis(integrationId, targetConversationId)
  const isFirstTurn = history.length === 0
  const requestStartedAt = params.requestStartedAt || new Date().toISOString()

  if (schedulingConfig) {
    const scheduling = await processSchedulingTurn({
      agentId: params.agentId,
      contactId: params.contactId,
      message: params.messageText,
      schedulingConfig,
    })

    if (scheduling.handled && scheduling.reply) {
      let replyText = scheduling.reply
      if (isFirstTurn && welcomeMessage) {
        replyText = `${welcomeMessage}\n\n${replyText}`
      }
      await deliverWhatsAppReply({
        integrationId,
        targetConversationId,
        agentId: params.agentId,
        replyText,
        requestStartedAt,
      })
      return { handled: true, replyText, agentResult: { mode: 'scheduling' } }
    }
  }

  const prependGreeting =
    isFirstTurn && welcomeMessage ? welcomeMessage : undefined

  const agentResult = await chatWithAgent(params.userEmail, params.agentId, params.messageText, {
    channel: 'whatsapp',
    phone_number: params.phoneNumber,
    from: params.from,
    to: params.to,
    text: params.messageText,
    input: params.messageText,
    userMessage: params.messageText,
    originalMessage: params.messageText,
    whatsappMessage: params.messageText,
    whatsapp_contact_id: params.contactId,
    integrations_id: integrationId,
    whatsapp_message_id: params.messageDbId,
    request_started_at: requestStartedAt,
    prepend_whatsapp_greeting: prependGreeting,
  })

  return {
    handled: true,
    agentResult,
  }
}
