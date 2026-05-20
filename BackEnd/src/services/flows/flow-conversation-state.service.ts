import logger from '../../lib/logger'
import { getRedisClient } from '../../lib/redis'
import { NodeExecutionResult } from './flow.types'
import {
  extractPatientAppointmentBookmark,
  mergePatientAppointmentBookmark,
  type PatientAppointmentBookmark,
} from './flow-patient-profile.service'

const DEFAULT_TTL_SECONDS = parseInt(process.env.FLOW_CONVERSATION_STATE_TTL || '604800', 10)

export interface FlowConversationState {
  flowId: string
  userEmail: string
  executionId?: string
  resumeNodeId?: string
  data: Record<string, any>
  executionHistory: NodeExecutionResult[]
  updatedAt: string
}

function normalize(value: string): string {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '')
}

function getFlowConversationStateKey(integrationId: string, recipientId: string, flowId: string): string {
  return `flow:conversation:${normalize(integrationId)}:${normalize(recipientId)}:${normalize(flowId)}`
}

function getPatientAppointmentBookmarkKey(integrationId: string, recipientId: string): string {
  return `flow:patient:${normalize(integrationId)}:${normalize(recipientId)}`
}

export async function getPatientAppointmentBookmark(
  integrationId: string,
  recipientId: string
): Promise<PatientAppointmentBookmark | null> {
  try {
    const client = await getRedisClient()
    const raw = await client.get(getPatientAppointmentBookmarkKey(integrationId, recipientId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as PatientAppointmentBookmark
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch (error: any) {
    logger.warn('[flow-conversation-state] Falha ao carregar bookmark do paciente', {
      error: error?.message,
    })
    return null
  }
}

export async function savePatientAppointmentBookmark(
  integrationId: string,
  recipientId: string,
  data: Record<string, unknown>
): Promise<void> {
  const bookmark = extractPatientAppointmentBookmark(data)
  if (!bookmark.patient_email && !bookmark.patient_phone && !bookmark.appointment_id) {
    return
  }

  try {
    const client = await getRedisClient()
    const existing = await getPatientAppointmentBookmark(integrationId, recipientId)
    const merged: PatientAppointmentBookmark = { ...(existing || {}), ...bookmark }
    await client.setEx(
      getPatientAppointmentBookmarkKey(integrationId, recipientId),
      DEFAULT_TTL_SECONDS,
      JSON.stringify(merged)
    )
  } catch (error: any) {
    logger.warn('[flow-conversation-state] Falha ao salvar bookmark do paciente', {
      error: error?.message,
    })
  }
}

export function applyPatientAppointmentBookmarkToData(
  data: Record<string, unknown>,
  bookmark: PatientAppointmentBookmark | null | undefined
): void {
  mergePatientAppointmentBookmark(data, bookmark)
}

export async function getFlowConversationState(
  integrationId: string,
  recipientId: string,
  flowId: string
): Promise<FlowConversationState | null> {
  try {
    const client = await getRedisClient()
    const raw = await client.get(getFlowConversationStateKey(integrationId, recipientId, flowId))
    if (!raw) return null

    const parsed = JSON.parse(raw) as FlowConversationState
    if (!parsed || parsed.flowId !== flowId || !parsed.data || typeof parsed.data !== 'object') {
      return null
    }

    return {
      ...parsed,
      executionHistory: Array.isArray(parsed.executionHistory) ? parsed.executionHistory : []
    }
  } catch (error: any) {
    logger.warn('[flow-conversation-state] Falha ao carregar estado conversacional', {
      flowId,
      error: error?.message
    })
    return null
  }
}

export async function saveFlowConversationState(
  integrationId: string,
  recipientId: string,
  state: Omit<FlowConversationState, 'updatedAt'>
): Promise<void> {
  try {
    const client = await getRedisClient()
    const key = getFlowConversationStateKey(integrationId, recipientId, state.flowId)
    await client.setEx(
      key,
      DEFAULT_TTL_SECONDS,
      JSON.stringify({
        ...state,
        executionHistory: Array.isArray(state.executionHistory) ? state.executionHistory.slice(-80) : [],
        updatedAt: new Date().toISOString()
      })
    )
  } catch (error: any) {
    logger.warn('[flow-conversation-state] Falha ao salvar estado conversacional', {
      flowId: state.flowId,
      error: error?.message
    })
  }
}

export async function clearFlowConversationState(
  integrationId: string,
  recipientId: string,
  flowId: string
): Promise<void> {
  try {
    const client = await getRedisClient()
    await client.del(getFlowConversationStateKey(integrationId, recipientId, flowId))
  } catch (error: any) {
    logger.warn('[flow-conversation-state] Falha ao limpar estado conversacional', {
      flowId,
      error: error?.message
    })
  }
}
