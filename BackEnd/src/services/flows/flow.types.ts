// Tipos para Flow Execution

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
    executionMode?: 'agent' | 'template' // Para nodes do tipo 'agent'
    agentId?: string // Para nodes do tipo 'agent'
    agentName?: string
    templateId?: string // Para nodes do tipo 'agent' em modo template
    templateName?: string
    additionalInstructions?: string
    label: string
    bio?: string | null
    /** Quando true, o fluxo ignora o bloqueio por confiança baixa no reply (ex.: classificador JSON). */
    skipReplyConfidence?: boolean
    // Dados específicos para cada tipo de node
    condition?: string // Para if-else: condição a ser avaliada
    duration?: string | number // Para delay: duração em segundos
    iterations?: string | number // Para loop: número de iterações
    infinite?: boolean // Para loop: se é infinito
    flowId?: string // Para loop: ID do fluxo a ser executado
    flowName?: string // Para loop: nome do fluxo a ser executado
    code?: string // Para code: código a ser executado (deprecated, usar comment)
    comment?: string // Para comment: comentário/documentação
    /** debug: chaves de context.data separadas por vírgula ou quebra de linha (vazio = todas) */
    debugKeys?: string
    /** debug: nota opcional no registo do histórico */
    debugMessage?: string
    /** Meta Cloud API — nome do template aprovado */
    waTemplateName?: string
    /** Meta — código de idioma (ex.: pt_BR) */
    waTemplateLanguage?: string
    /** Meta — componentes (header/body/buttons); opcional */
    waTemplateComponents?: unknown[]
    /** JSON em string no editor; convertido em runtime */
    waTemplateComponentsJson?: string
    /** Se vazio no runtime, usa integrations_id do contexto do fluxo */
    waIntegrationId?: string
    /** Campanha HubSpot -> WhatsApp */
    crmIntegrationId?: string
    crmFilterField?: string
    crmFilterOperator?: 'equals' | 'starts_with' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte'
    crmFilterValue?: string
    crmPhoneField?: string
    crmResultLimit?: string | number
    campaignName?: string
    waRateLimitPerMinute?: string | number
    /** Novo bloco simples de envio no WhatsApp */
    waWindowMode?: 'session_only' | 'auto_template'
    waMessageType?: 'text' | 'buttons' | 'link' | 'reminder'
    waMessageText?: string
    waButtons?: Array<{ id?: string; text: string }>
    waLinkUrl?: string
    waReminderAt?: string
    /** Mapeamento interno opcional para conversão automática em template */
    waFallbackTemplateName?: string
    waFallbackTemplateLanguage?: string
    emailIntegrationId?: string
    emailTo?: string
    emailSubject?: string
    emailText?: string
    emailReadLimit?: string | number
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
  sourceHandle?: string // Para if-else: 'true' ou 'false'
}

export interface FlowData {
  nodes: FlowNode[]
  edges: FlowEdge[]
  startNodeId: string
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
  qrCode?: string // QR code em base64 quando disponível
  /** Resumo da entrada (ex.: agente) ou metadados do nó */
  input?: unknown
  /** Texto curto derivado do output (ex.: agente) para leitura rápida */
  outputSummary?: string
  startedAt?: string
  finishedAt?: string
}

export interface FlowExecutionContext {
  flowId: string
  userId: string
  companiesId?: string // ✅ Adicionado para multi-tenant
  userEmail: string
  executionId?: string // ✅ ID único da execução para rastreamento
  data: Record<string, any> // Dados compartilhados entre nodes
  executionHistory: NodeExecutionResult[]
}
