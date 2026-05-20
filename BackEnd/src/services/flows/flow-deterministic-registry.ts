import type { FlowNode } from './flow.types'
import { readNodeDeterministicConfig } from './flow-runtime-config'
import {
  applyIntakeStructuredFieldsToContext,
  resolveIntakeCollectDeterministicMessage,
  resolveIntakeTriageDeterministicMessage,
} from './flow-patient-intake'

export type DeterministicAgentResult = {
  action: 'reply'
  message: string
  contextPatch?: Record<string, unknown>
  historyTag: string
}

type DeterministicHandler = (
  node: FlowNode,
  context: Record<string, unknown>
) => DeterministicAgentResult | null

const handlers = new Map<string, DeterministicHandler>()

export function registerDeterministicProfile(profile: string, handler: DeterministicHandler): void {
  const key = String(profile || '').trim()
  if (!key) return
  handlers.set(key, handler)
}

function staticMessageHandler(node: FlowNode, context: Record<string, unknown>): DeterministicAgentResult | null {
  const config = readNodeDeterministicConfig(node.data as Record<string, unknown>)
  const message = String(config.message || node.data.waMessageText || '').trim()
  if (!message) return null
  return {
    action: 'reply',
    message,
    historyTag: 'static_message',
    contextPatch:
      String((node.data as Record<string, unknown>).channel_origin || '').trim() === 'whatsapp'
        ? { channel_origin: 'whatsapp' }
        : undefined,
  }
}

function intakeCollectHandler(node: FlowNode, context: Record<string, unknown>): DeterministicAgentResult | null {
  applyIntakeStructuredFieldsToContext(context)
  const message = resolveIntakeCollectDeterministicMessage(context)
  return {
    action: 'reply',
    message,
    historyTag: 'patient_intake.collect',
    contextPatch: {
      patient_name: context.patient_name,
      patient_email: context.patient_email,
      patient_phone: context.patient_phone,
      patient_lookup_status: context.patient_lookup_status,
      data_quality: context.data_quality,
      missing_fields: context.missing_fields,
    },
  }
}

function intakeTriageHandler(_node: FlowNode, context: Record<string, unknown>): DeterministicAgentResult | null {
  const message = resolveIntakeTriageDeterministicMessage(context)
  if (!message) return null
  applyIntakeStructuredFieldsToContext(context)
  return {
    action: 'reply',
    message,
    historyTag: 'patient_intake.triage',
    contextPatch: {
      specialty: context.specialty,
      specialty_confidence: context.specialty_confidence,
    },
  }
}

function intakeUrgencyHandler(_node: FlowNode, context: Record<string, unknown>): DeterministicAgentResult | null {
  const config = readNodeDeterministicConfig(_node.data as Record<string, unknown>)
  const status = String(config.setUrgencyStatus || 'non_urgent').trim() || 'non_urgent'
  context.urgency_status = status
  return {
    action: 'reply',
    message: '',
    historyTag: 'patient_intake.urgency',
    contextPatch: { urgency_status: status },
  }
}

registerDeterministicProfile('static_message', staticMessageHandler)
registerDeterministicProfile('patient_intake.collect', intakeCollectHandler)
registerDeterministicProfile('patient_intake.triage', intakeTriageHandler)
registerDeterministicProfile('patient_intake.urgency', intakeUrgencyHandler)

export function resolveDeterministicAgentOutput(
  node: FlowNode,
  context: Record<string, unknown>
): DeterministicAgentResult | null {
  const config = readNodeDeterministicConfig(node.data as Record<string, unknown>)
  const profile = String(config.profile || '').trim()
  if (!profile) return null

  const handler = handlers.get(profile)
  if (!handler) {
    return null
  }

  const result = handler(node, context)
  if (!result) return null

  if (config.applyIntakeFields) {
    applyIntakeStructuredFieldsToContext(context)
  }

  return result
}
