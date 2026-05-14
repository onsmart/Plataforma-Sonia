import logger from '../../lib/logger'
import { getRedisClient } from '../../lib/redis'
import { NodeExecutionResult } from './flow.types'

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
