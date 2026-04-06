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
    'comment'
  ])

  return keys.every((key) => controlKeys.has(key))
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
  const candidateFields = ['message', 'reply', 'answer', 'content', 'text']

  for (const field of candidateFields) {
    const value = normalizedOutput[field]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  if (['reply', 'send_whatsapp', 'whatsapp'].includes(action)) {
    const value = normalizedOutput.message
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
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
    context: requestStartedAt
      ? { request_started_at: requestStartedAt }
      : undefined
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
