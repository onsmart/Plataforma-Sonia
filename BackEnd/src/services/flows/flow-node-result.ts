export interface FlowIntegrationResult {
  kind: string
  success: boolean
  status: string
  error_code?: string | null
  user_safe_message: string
  retryable: boolean
  integration_status: 'success' | 'failed' | 'mocked' | 'not_configured' | 'partial'
  [key: string]: unknown
}

type FlowIntegrationResultRequiredFields = Pick<
  FlowIntegrationResult,
  'success' | 'status' | 'user_safe_message' | 'retryable' | 'integration_status'
>

export function buildFlowIntegrationResult(
  kind: string,
  partial: Partial<Omit<FlowIntegrationResult, 'kind'>> & FlowIntegrationResultRequiredFields
): FlowIntegrationResult {
  return {
    kind,
    error_code: null,
    ...partial,
  }
}
