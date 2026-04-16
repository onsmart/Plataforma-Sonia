import logger from '../../lib/logger'
import { sendWhatsApp } from '../integrations/whatsapp/whatsapp.dispatcher'
import { FlowService } from './flow.service'
import { FlowExecutionContext } from './flow.types'

type FlowDeliveryChannel = 'none' | 'whatsapp'

interface ExecuteFlowForChannelParams {
  flowId: string
  userEmail: string
  initialData?: Record<string, any>
  deliveryChannel?: FlowDeliveryChannel
  integrationsId?: string
  recipientId?: string
  agentId?: string
  requestStartedAt?: string
}

interface FlowDeliveryResult {
  attempted: boolean
  success: boolean
  queued?: boolean
  error?: string
}

export interface FlowChannelExecutionResult {
  context: FlowExecutionContext
  outboundMessage: string | null
  delivery: FlowDeliveryResult
}

function isControlOnlyOutput(output: Record<string, any>): boolean {
  if (output && typeof output === 'object' && !Array.isArray(output)) {
    const k = (output as { kind?: string }).kind
    if (k === 'debug' || k === 'comment' || k === 'wa_template' || k === 'wa_session_window') {
      return true
    }
  }

  const keys = Object.keys(output)
  if (keys.length === 0) {
    return true
  }

  const controlKeys = new Set([
    'started',
    'stopped',
    'conditionResult',
    'delayed',
    'loopCompleted',
    'comment',
    'kind',
    'label',
    'condition',
    'branch',
    'durationMs',
    'contextDataKeyCount',
    'at',
    'snapshot',
    'predecessorSummary',
    'message'
  ])

  return keys.every((key) => controlKeys.has(key))
}

function extractMessageCandidate(value: any): string | null {
  if (value === null || value === undefined) {
    return null
  }

  let normalizedValue = value

  if (typeof normalizedValue === 'string') {
    const trimmed = normalizedValue.trim()
    if (!trimmed) {
      return null
    }

    try {
      normalizedValue = JSON.parse(trimmed)
    } catch {
      return trimmed
    }
  }

  if (typeof normalizedValue !== 'object' || Array.isArray(normalizedValue)) {
    return null
  }

  const candidateFields = ['response', 'message', 'reply', 'answer', 'content', 'text', 'output']

  for (const field of candidateFields) {
    const candidate = extractMessageCandidate((normalizedValue as Record<string, any>)[field])
    if (candidate) {
      return candidate
    }
  }

  return null
}

function extractMessageFromOutput(output: any): string | null {
  if (output === null || output === undefined) {
    return null
  }

  let normalizedOutput = output

  if (typeof normalizedOutput === 'string') {
    const trimmed = normalizedOutput.trim()
    if (!trimmed) {
      return null
    }

    try {
      normalizedOutput = JSON.parse(trimmed)
    } catch {
      return trimmed
    }
  }

  if (typeof normalizedOutput !== 'object' || Array.isArray(normalizedOutput)) {
    return null
  }

  if (isControlOnlyOutput(normalizedOutput)) {
    return null
  }

  const action = String(normalizedOutput.action || '').trim().toLowerCase()
  const candidateFields = ['response', 'message', 'reply', 'answer', 'content', 'text', 'output']

  for (const field of candidateFields) {
    const candidate = extractMessageCandidate(normalizedOutput[field])
    if (candidate) {
      return candidate
    }
  }

  if (['reply', 'send_whatsapp', 'whatsapp'].includes(action)) {
    const candidate = extractMessageCandidate(normalizedOutput.message)
    if (candidate) {
      return candidate
    }
  }

  return null
}

export function extractFlowOutboundMessage(context: FlowExecutionContext): string | null {
  for (let index = context.executionHistory.length - 1; index >= 0; index -= 1) {
    const step = context.executionHistory[index]

    if (!step.success) {
      continue
    }

    const extracted = extractMessageFromOutput(step.output)
    if (extracted) {
      return extracted
    }
  }

  return null
}

export async function executeFlowForChannel({
  flowId,
  userEmail,
  initialData = {},
  deliveryChannel = 'none',
  integrationsId,
  recipientId,
  agentId,
  requestStartedAt
}: ExecuteFlowForChannelParams): Promise<FlowChannelExecutionResult> {
  const shouldDeliverToWhatsApp = deliveryChannel === 'whatsapp'
  const flowInitialData = {
    ...initialData,
    disable_channel_delivery: shouldDeliverToWhatsApp || !!initialData.disable_channel_delivery
  }

  const context = await FlowService.executeFlow(flowId, userEmail, flowInitialData)
  const outboundMessage = extractFlowOutboundMessage(context)

  if (!shouldDeliverToWhatsApp) {
    return {
      context,
      outboundMessage,
      delivery: {
        attempted: false,
        success: true
      }
    }
  }

  if (!integrationsId || !recipientId) {
    logger.warn('[executeFlowForChannel] Fluxo executado sem dados suficientes para envio WhatsApp', {
      flowId,
      integrationsId,
      recipientId
    })

    return {
      context,
      outboundMessage,
      delivery: {
        attempted: false,
        success: false,
        error: 'Integracao ou destinatario ausente para entrega no WhatsApp'
      }
    }
  }

  const metaTemplateAlreadySent = Boolean((context.data as Record<string, unknown> | undefined)?.__flow_meta_outbound_already_sent)
  if (metaTemplateAlreadySent) {
    logger.log('[executeFlowForChannel] Entrega por texto livre ignorada: template Meta ja enviado no executor do fluxo', {
      flowId
    })
    return {
      context,
      outboundMessage,
      delivery: {
        attempted: true,
        success: true,
        queued: false
      }
    }
  }

  if (!outboundMessage) {
    logger.warn('[executeFlowForChannel] Fluxo executado sem mensagem final extraivel para WhatsApp', {
      flowId,
      executionSteps: context.executionHistory.length
    })

    return {
      context,
      outboundMessage: null,
      delivery: {
        attempted: false,
        success: false,
        error: 'Fluxo executado sem resposta final enviavel'
      }
    }
  }

  const sendResult = await sendWhatsApp(integrationsId, {
    to: recipientId,
    message: outboundMessage,
    agentId,
    context: {
      ...(requestStartedAt ? { request_started_at: requestStartedAt } : {}),
      automation_source: 'flow',
      flow_id: flowId,
      flow_execution_id: context.executionId
    }
  })

  return {
    context,
    outboundMessage,
    delivery: {
      attempted: true,
      success: !!sendResult.success,
      queued: !!sendResult.queued,
      error: sendResult.success ? undefined : sendResult.error || 'Falha ao enviar resposta do flow'
    }
  }
}
