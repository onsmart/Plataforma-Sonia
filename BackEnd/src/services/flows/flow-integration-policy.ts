import type { FlowNode } from './flow.types'

export function nodeRequiresLiveIntegration(nodeData: Record<string, unknown> | undefined): boolean {
  if (!nodeData) return false
  return nodeData.requireLiveIntegration === true || nodeData.failWhenIntegrationMissing === true
}

export function shouldFailOnMissingIntegration(
  contextData: Record<string, unknown>,
  nodeData: Record<string, unknown> | undefined
): boolean {
  if (!nodeRequiresLiveIntegration(nodeData)) return false
  const mode = String(contextData.__flow_execution_mode || 'live').trim()
  return mode === 'live'
}

export function buildMissingIntegrationFailure(
  kind: string,
  params: {
    errorCode: string
    userMessage: string
    contextFields?: Record<string, unknown>
  }
) {
  return {
    kind,
    success: false,
    status: 'failed',
    error_code: params.errorCode,
    user_safe_message: params.userMessage,
    retryable: false,
    integration_status: 'not_configured' as const,
    integration_required: true,
    ...(params.contextFields || {}),
  }
}

export function readNodeIntegrationPolicy(node: FlowNode): Record<string, unknown> {
  return (node.data || {}) as Record<string, unknown>
}
