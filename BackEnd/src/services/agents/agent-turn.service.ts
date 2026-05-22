import { supabase } from '../../lib/supabase'
import { chatWithAgent } from './chatwithAgent'
import {
  parseAgentExtraFeatures,
  resolveWelcomeMessage,
  resolveSchedulingConfig,
} from './agent-extra-features'
import { processSchedulingTurn } from './agent-scheduling-coordinator'
import { unwrapAgentReplyText } from './agent-reply-text'

export type AgentConversationChannel = 'whatsapp' | 'webchat'

export interface RunAgentConversationTurnInput {
  userEmail: string
  agentId: string
  message: string
  contactId: string
  channel: AgentConversationChannel
  context?: Record<string, unknown>
  prependGreeting?: string
  /** Telefone do WhatsApp (DDD+número) para não pedir de novo no agendamento */
  fallbackPhone?: string | null
}

export interface RunAgentConversationTurnResult {
  reply: unknown
  mode: 'scheduling' | 'llm'
}

async function loadAgentRow(agentId: string) {
  const { data, error } = await supabase
    .from('tb_agents')
    .select('id, status_id, extra_features')
    .eq('id', agentId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Turno único do agente: coordenador de agendamento (Calendly) antes do LLM.
 * Usado no WhatsApp e no Playground / chat web.
 */
export async function runAgentConversationTurn(
  input: RunAgentConversationTurnInput
): Promise<RunAgentConversationTurnResult> {
  const agent = await loadAgentRow(input.agentId)
  if (!agent) {
    throw new Error('Agente não encontrado')
  }

  if (Number(agent.status_id) !== 1) {
    throw new Error('Agente inativo')
  }

  const extra = parseAgentExtraFeatures(agent.extra_features)
  const schedulingConfig = resolveSchedulingConfig(extra)

  if (schedulingConfig) {
    const scheduling = await processSchedulingTurn({
      agentId: input.agentId,
      contactId: input.contactId,
      message: input.message,
      schedulingConfig,
      fallbackPhone: input.fallbackPhone,
    })

    if (scheduling.handled && scheduling.reply) {
      let replyText = scheduling.reply
      if (input.prependGreeting) {
        replyText = `${input.prependGreeting}\n\n${replyText}`
      }
      return { reply: replyText, mode: 'scheduling' }
    }
  }

  const welcomeMessage = resolveWelcomeMessage(extra)
  const isWhatsApp = input.channel === 'whatsapp'

  let prependGreeting = input.prependGreeting
  if (!prependGreeting && welcomeMessage && input.context?.is_first_turn === true) {
    prependGreeting = welcomeMessage
  }

  const llmContext: Record<string, unknown> = {
    channel: input.channel,
    sessionId: input.contactId,
    scheduling_active: Boolean(schedulingConfig),
    ...(input.context || {}),
  }

  if (isWhatsApp) {
    llmContext.disable_channel_delivery = true
    if (prependGreeting) {
      llmContext.whatsapp_greeting_prepended = true
    }
  }

  const reply = await chatWithAgent(input.userEmail, input.agentId, input.message, llmContext)

  let replyText = unwrapAgentReplyText(reply)

  if (
    /^📱 Resposta enviada automaticamente/i.test(replyText) ||
    /^✅ Resposta gerada e salva na fila/i.test(replyText)
  ) {
    replyText = ''
  }

  if (prependGreeting) {
    replyText = replyText ? `${prependGreeting}\n\n${replyText}` : prependGreeting
  }

  return { reply: replyText, mode: 'llm' }
}
