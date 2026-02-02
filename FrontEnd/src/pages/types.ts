// Tipos para o editor de flows

export enum NodeType {
  START = 'start',
  STOP = 'stop',
  AGENT = 'agent',
  IF_ELSE = 'if-else',
  LOOP = 'loop',
  CODE = 'code',
  DELAY = 'delay',
}

export interface AvailableAgent {
  id: string
  name: string
  bio: string | null
}

export interface FlowRecord {
  id: string
  name: string
  nodes: {
    startNodeId: string
    nodes: any[]
    edges: any[]
  }
  user_email: string
  created_at: string
}
