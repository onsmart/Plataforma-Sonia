// Tipos para Flow Execution

export interface FlowNode {
  id: string
  type: string
  data: {
    agentId: string
    label: string
    bio?: string | null
    isStartNode: boolean
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
}

export interface FlowExecutionContext {
  flowId: string
  userId: string
  userEmail: string
  data: Record<string, any> // Dados compartilhados entre nodes
  executionHistory: NodeExecutionResult[]
}
