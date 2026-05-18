// Tipos para Flow Execution

export type FlowExecutionMode = 'test' | 'live'

export interface AudienceContact {
  external_id: string
  firstname?: string | null
  lastname?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
  crm_integration_id?: string | null
  source: 'hubspot' | string
  tags?: string[]
  properties?: Record<string, unknown>
}

export interface FlowNode {
  id: string
  type: string
  data: {
    branchField?: string
    branchCustomField?: string
    branchInputKey?: string
    ifValue?: string
    elseLabel?: string
    switchCases?: Array<{
      id: string
      label: string
      value: string
    }>
    switchDefaultLabel?: string
    executionMode?: 'agent' | 'template'
    agentId?: string
    agentName?: string
    templateId?: string
    templateName?: string
    additionalInstructions?: string
    label: string
    stopScope?: 'flow' | 'subflow'
    bio?: string | null
    skipReplyConfidence?: boolean
    condition?: string
    duration?: string | number
    scheduleAt?: string
    scheduleTimezone?: string
    iterations?: string | number
    infinite?: boolean
    flowId?: string
    flowName?: string
    subflowId?: string
    subflowName?: string
    subflowResultKey?: string
    subflowFailOnError?: boolean
    code?: string
    comment?: string
    debugKeys?: string
    debugMessage?: string
    waTemplateName?: string
    waTemplateLanguage?: string
    waTemplateComponents?: unknown[]
    waTemplateComponentsJson?: string
    waIntegrationId?: string
    crmIntegrationId?: string
    crmFilterField?: string
    crmFilterOperator?: 'equals' | 'starts_with' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte'
    crmFilterValue?: string
    crmPhoneField?: string
    crmResultLimit?: string | number
    campaignName?: string
    waRateLimitPerMinute?: string | number
    waWindowMode?: 'session_only' | 'auto_template'
    waMessageType?: 'text' | 'buttons' | 'link' | 'reminder'
    waMessageText?: string
    waButtons?: Array<{ id?: string; text: string }>
    waLinkUrl?: string
    waReminderAt?: string
    waFallbackTemplateName?: string
    waFallbackTemplateLanguage?: string
    emailIntegrationId?: string
    emailTo?: string
    emailSubject?: string
    emailText?: string
    emailReadLimit?: string | number
    crmOperation?: 'lookup' | 'create' | 'update' | 'upsert'
    lookupFields?: string[]
    requiredFields?: string[]
    originTag?: string
    allowMissingDob?: boolean
    appointmentOperation?: 'availability' | 'book' | 'reschedule' | 'cancel'
    appointmentProvider?: string
    appointmentIntegrationId?: string
    autoSelectFirstSlot?: boolean
    specialtyField?: string
    doctorField?: string
    consultationTypeField?: string
    unitField?: string
    periodField?: string
    preferredDateField?: string
    documentKinds?: string[]
    notifyTeam?: boolean
    acceptWithoutFile?: boolean
    handoffReasonField?: string
    handoffPriority?: 'low' | 'medium' | 'high' | 'urgent'
    notifyEmail?: string
    notifyWhatsApp?: string
    patientMessage?: string
  }
  position: {
    x: number
    y: number
  }
  draggable?: boolean
}

export interface FlowEdge {
  source: string
  target: string
  sourceHandle?: string
}

export interface FlowData {
  nodes: FlowNode[]
  edges: FlowEdge[]
  startNodeId: string
  meta?: {
    kind?: 'main' | 'subflow'
    parentFlowId?: string | null
    parentFlowName?: string | null
    subflowKey?: string | null
    subflowOrder?: number | null
  }
}

export interface NodeExecutionResult {
  nodeId: string
  executionMode?: 'agent' | 'template'
  agentId?: string
  templateId?: string
  nodeType?: string
  success: boolean
  output?: any
  error?: string
  qrCode?: string
  input?: unknown
  outputSummary?: string
  startedAt?: string
  finishedAt?: string
}

export interface FlowExecutionContext {
  flowId: string
  userId: string
  companiesId?: string
  userEmail: string
  executionId?: string
  data: Record<string, any>
  executionHistory: NodeExecutionResult[]
}
