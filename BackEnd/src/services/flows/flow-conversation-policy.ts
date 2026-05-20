import type { FlowNode } from './flow.types'
import {
  FlowNodeConversationPolicy,
  FlowRuntimeConfig,
  readNodeConversationPolicy,
} from './flow-runtime-config'
import {
  getMissingRegistrationFields,
  hasMinimalPatientProfile,
  hasSpecialtyDefined,
  isAffirmativeConfirmation,
} from './flow-patient-intake'

export type ConversationPauseDecision = {
  pause: boolean
  reason?: string
  resumeNodeId?: string
  waitingNodeId?: string
}

type PolicyContext = {
  isLive: boolean
  hasMinimalPatientProfile: () => boolean
  hasSpecialtyDefined: () => boolean
  getContextRecord: () => Record<string, unknown>
  normalizeFlowControlValue: (value: unknown) => string
  isMissingConversationalValue: (value: unknown) => boolean
  runtime: FlowRuntimeConfig
}

function policyForNode(node: FlowNode): FlowNodeConversationPolicy {
  return readNodeConversationPolicy(node.data as Record<string, unknown>)
}

export function resolveConversationPauseAfterCrmNode(
  node: FlowNode,
  ctx: PolicyContext
): ConversationPauseDecision {
  if (!ctx.isLive || node.type !== 'crm_contact') {
    return { pause: false }
  }

  const operation = ctx.normalizeFlowControlValue(node.data?.crmOperation)
  if (operation !== 'upsert' && operation !== 'update') {
    return { pause: false }
  }

  const policy = policyForNode(node)
  const upsertPolicy = policy.pauseOnCrmUpsertWithoutProfile
  if (upsertPolicy?.enabled === false) {
    return { pause: false }
  }

  if (ctx.hasMinimalPatientProfile()) {
    return { pause: false }
  }

  const resumeCollectNodeId =
    String(upsertPolicy?.resumeCollectNodeId || ctx.runtime.intakeResume?.collectNodeId || '').trim() ||
    node.id

  return {
    pause: true,
    reason: 'missing_required_fields',
    resumeNodeId: resumeCollectNodeId,
  }
}

export function resolveConversationPauseForUserReply(
  currentNode: FlowNode,
  nextNodes: FlowNode[],
  ctx: PolicyContext
): ConversationPauseDecision {
  if (!ctx.isLive) {
    return { pause: false }
  }

  const crmPause = resolveConversationPauseAfterCrmNode(currentNode, ctx)
  if (crmPause.pause) {
    return crmPause
  }

  const policy = policyForNode(currentNode)
  const data = ctx.getContextRecord()

  if (currentNode.type === 'agent') {
    if (policy.pauseOnMissingPatientProfile) {
      if (!ctx.hasMinimalPatientProfile()) {
        const userMessage = String(data.userMessage || data.message || data.originalMessage || '')
        if (isAffirmativeConfirmation(userMessage)) {
          data.registration_confirmed = true
          data.missing_fields = getMissingRegistrationFields(data)
        }
        return {
          pause: true,
          reason: 'missing_required_fields',
          resumeNodeId: currentNode.id,
        }
      }
    }

    if (policy.pauseOnMissingSpecialty) {
      if (!ctx.hasSpecialtyDefined()) {
        data.__triage_awaiting_specialty = true
        return {
          pause: true,
          reason: 'missing_specialty',
          resumeNodeId: currentNode.id,
        }
      }
    }
  }

  if (currentNode.type === 'whatsapp_message' && policy.pauseOnMissingAppointmentSlot?.enabled) {
    const slots = Array.isArray(data.appointment_slots) ? data.appointment_slots : []
    const selectedSlotId = String(data.appointment_selected_slot_id || '').trim()
    const slotPolicy = policy.pauseOnMissingAppointmentSlot
    const bookNodeId =
      String(slotPolicy?.bookNodeId || ctx.runtime.appointmentState?.bookNodeId || '').trim() ||
      'appointment-book'
    const slotPromptNodeId =
      String(slotPolicy?.slotPromptNodeId || ctx.runtime.appointmentState?.chooseSlotNodeId || '').trim() ||
      currentNode.id

    if (slots.length > 0 && !selectedSlotId) {
      data.__awaiting_appointment_slot = true
      return {
        pause: true,
        reason: 'missing_appointment_slot',
        resumeNodeId: bookNodeId,
        waitingNodeId: slotPromptNodeId,
      }
    }
  }

  const missingFields = data.missing_fields || data.required_missing_fields
  if (Array.isArray(missingFields) && missingFields.length > 0) {
    if (ctx.hasMinimalPatientProfile()) {
      delete data.missing_fields
      delete data.required_missing_fields
    } else if (policy.pauseOnMissingPatientProfile) {
      return {
        pause: true,
        reason: 'missing_required_fields',
        resumeNodeId: currentNode.id,
      }
    } else {
      return { pause: true, reason: 'missing_required_fields' }
    }
  }

  const incompleteStatusKeys = [
    'patient_lookup_status',
    'appointment_status',
    'document_status',
    'integration_status',
  ]

  for (const key of incompleteStatusKeys) {
    const value = ctx.normalizeFlowControlValue(data[key])
    if (key === 'integration_status' && value === 'not_configured') {
      continue
    }
    if (
      value === 'incomplete' ||
      value === 'pending' ||
      value === 'pending_upload' ||
      value === 'needs_input'
    ) {
      if (
        key === 'patient_lookup_status' &&
        ctx.normalizeFlowControlValue(data.integration_status) === 'not_configured' &&
        ctx.hasMinimalPatientProfile()
      ) {
        continue
      }

      if (
        key === 'patient_lookup_status' &&
        policy.pauseOnIncompleteCrmLookupAtCurrentNode
      ) {
        return {
          pause: true,
          reason: 'missing_crm_lookup_identifiers',
          resumeNodeId: currentNode.id,
          waitingNodeId: currentNode.id,
        }
      }

      if (key === 'appointment_status') {
        const routesIncomplete = nextNodes.some((nextNode) => {
          if (nextNode.type !== 'switch') return false
          const branchField = String(nextNode.data?.branchField || '').trim()
          if (branchField !== 'appointment_status') return false
          const cases = Array.isArray(nextNode.data?.switchCases) ? nextNode.data.switchCases : []
          return cases.some((item) => {
            const caseValue = String(item?.value || item?.id || '')
              .trim()
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
            return caseValue === 'incomplete' || caseValue === 'not_found'
          })
        })
        if (routesIncomplete) {
          continue
        }
      }

      return { pause: true, reason: `incomplete_status:${key}` }
    }
  }

  if (!nextNodes.length) {
    return { pause: false }
  }

  const nextDecisionNode = nextNodes.find((node) => node.type === 'switch' || node.type === 'if-else')
  if (!nextDecisionNode) {
    return { pause: false }
  }

  const branchField = String(nextDecisionNode.data?.branchField || '').trim()
  if (!branchField) {
    return { pause: false }
  }

  const branchValue = data[branchField] ?? data[branchField.replace(/_/g, '')]
  if (!ctx.isMissingConversationalValue(branchValue)) {
    return { pause: false }
  }

  return {
    pause: true,
    reason: `missing_branch_field:${branchField}`,
    resumeNodeId: nextDecisionNode.id,
    waitingNodeId: nextDecisionNode.id,
  }
}
