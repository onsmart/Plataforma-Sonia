import logger from '../../lib/logger'
import { sendWhatsApp } from '../integrations/whatsapp/whatsapp.dispatcher'
import { FlowService } from './flow.service'
import { FlowExecutionContext, FlowExecutionMode } from './flow.types'
import { buildPausedExecutionContext, scheduleFlowStart } from './flow-scheduler.service'

type FlowDeliveryChannel = 'none' | 'whatsapp'

interface ExecuteFlowForChannelParams {
  flowId: string
  userEmail: string
  initialData?: Record<string, any>
  deliveryChannel?: FlowDeliveryChannel
  executionMode?: FlowExecutionMode
  scheduledStartAt?: string
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
    if (
      k === 'debug' ||
      k === 'comment' ||
      k === 'wa_template' ||
      k === 'wa_template_campaign' ||
      k === 'wa_session_window' ||
      k === 'whatsapp_message' ||
      k === 'hubspot_contacts' ||
      k === 'crm_contact' ||
      k === 'appointment' ||
      k === 'document_intake' ||
      k === 'email_send' ||
      k === 'email_send_audience' ||
      k === 'schedule' ||
      k === 'subflow' ||
      k === 'switch' ||
      k === 'simple_branch'
    ) {
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
    'subflow_status',
    'subflow_id',
    'subflow_name',
    'subflow_result_key',
    'subflow_executed_nodes',
    'comment',
    'kind',
    'label',
    'condition',
    'branch',
    'branchField',
    'actualValue',
    'expectedValues',
    'matchedCase',
    'selectedHandle',
    'defaultLabel',
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
      return extractPatientMessageFromStructuredText(trimmed) || (looksLikeStructuredPayload(trimmed) ? null : trimmed)
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

function looksLikeStructuredPayload(value: string): boolean {
  const trimmed = String(value || '').trim()
  if (!trimmed) return false
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return true
  }
  return /(?:^|\n)\s*dados internos\s*:/i.test(trimmed)
}

function extractPatientMessageFromStructuredText(value: string): string | null {
  const text = String(value || '').trim()
  if (!text) return null

  const internalMatch = text.match(/(?:^|\n)\s*dados internos\s*:/i)
  const beforeInternal = internalMatch?.index != null && internalMatch.index >= 0
    ? text.slice(0, internalMatch.index).trim()
    : text

  const messageMatch = beforeInternal.match(/(?:^|\n)\s*mensagem ao paciente\s*:/i)
  const response = messageMatch?.index != null && messageMatch.index >= 0
    ? beforeInternal.slice(messageMatch.index + messageMatch[0].length).trim()
    : beforeInternal.trim()

  return response || null
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
      return extractPatientMessageFromStructuredText(trimmed) || (looksLikeStructuredPayload(trimmed) ? null : trimmed)
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
  executionMode,
  scheduledStartAt,
  integrationsId,
  recipientId,
  agentId,
  requestStartedAt
}: ExecuteFlowForChannelParams): Promise<FlowChannelExecutionResult> {
  const shouldDeliverToWhatsApp = deliveryChannel === 'whatsapp'
  const resolvedExecutionMode =
    executionMode || (shouldDeliverToWhatsApp || String(scheduledStartAt || '').trim() ? 'live' : 'test')
  const flowInitialData = {
    ...initialData,
    disable_channel_delivery: shouldDeliverToWhatsApp || !!initialData.disable_channel_delivery,
    __flow_execution_mode: resolvedExecutionMode
  }

  if (resolvedExecutionMode === 'live' && String(scheduledStartAt || '').trim()) {
    const scheduled = await scheduleFlowStart({
      flowId,
      userEmail,
      initialData: flowInitialData,
      scheduledStartAt: String(scheduledStartAt || '').trim(),
      executionMode: resolvedExecutionMode
    })
    const pausedContext = buildPausedExecutionContext({
      flowId,
      userEmail,
      userId: scheduled.userId,
      companiesId: scheduled.companiesId,
      executionId: scheduled.executionId,
      initialData: flowInitialData,
      scheduledAtIso: scheduled.scheduledAtIso,
      timezone: scheduled.timezone
    })
    return {
      context: pausedContext,
      outboundMessage: null,
      delivery: {
        attempted: false,
        success: true
      }
    }
  }

  const context = await FlowService.executeFlow(flowId, userEmail, flowInitialData, {
    executionMode: resolvedExecutionMode
  })
  const outboundMessage = extractFlowOutboundMessage(context)

  if ((context.data as Record<string, unknown> | undefined)?.__flow_paused_for_schedule) {
    return {
      context,
      outboundMessage: null,
      delivery: {
        attempted: false,
        success: true
      }
    }
  }

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

  const outboundAlreadySent = Boolean(
    (context.data as Record<string, unknown> | undefined)?.__flow_meta_outbound_already_sent ||
      (context.data as Record<string, unknown> | undefined)?.__flow_whatsapp_outbound_already_sent
  )
  if (outboundAlreadySent) {
    logger.log('[executeFlowForChannel] Entrega por texto livre ignorada: mensagem WhatsApp ja enviada no executor do fluxo', {
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
