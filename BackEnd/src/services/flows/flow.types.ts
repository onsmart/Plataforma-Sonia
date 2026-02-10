// Tipos para Flow Execution

export interface FlowNode {
  id: string
  type: string
  data: {
    agentId?: string // Para nodes do tipo 'agent'
    label: string
    bio?: string | null
    // Dados específicos para cada tipo de node
    condition?: string // Para if-else: condição a ser avaliada
    duration?: string | number // Para delay: duração em segundos
    iterations?: string | number // Para loop: número de iterações
    infinite?: boolean // Para loop: se é infinito
    flowId?: string // Para loop: ID do fluxo a ser executado
    flowName?: string // Para loop: nome do fluxo a ser executado
    code?: string // Para code: código a ser executado
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
  agentId: string
  success: boolean
  output?: any
  error?: string
  qrCode?: string // QR code em base64 quando disponível
}

export interface FlowExecutionContext {
  flowId: string
  userId: string
  companiesId?: string // ✅ Adicionado para multi-tenant
  userEmail: string
  data: Record<string, any> // Dados compartilhados entre nodes
  executionHistory: NodeExecutionResult[]
}
