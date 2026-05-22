export interface IntegrationToolDescriptor {
  provider: 'calendly' | 'hubspot' | 'whatsapp' | 'email'
  toolName: string
  toolKey: string
  displayName: string
  description: string
  requiredFields: string[]
}

export interface IntegrationToolExecutionResult {
  success: boolean
  provider: string
  toolName: string
  status: 'success' | 'failed' | 'partial'
  userSafeMessage: string
  data?: Record<string, unknown>
  error?: string
}

