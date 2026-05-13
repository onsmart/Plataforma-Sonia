// Tipos para o editor de flows

export enum NodeType {
  START = 'start',
  STOP = 'stop',
  AGENT = 'agent',
  IF_ELSE = 'if-else',
  SWITCH = 'switch',
  COMMENT = 'comment',
  DELAY = 'delay',
  DEBUG = 'debug',
  SCHEDULE = 'schedule',
  WA_TEMPLATE = 'wa_template',
  HUBSPOT_WHATSAPP_CAMPAIGN = 'hubspot_whatsapp_campaign',
  CRM_CONTACT = 'crm_contact',
  APPOINTMENT = 'appointment',
  DOCUMENT_INTAKE = 'document_intake',
  HUMAN_HANDOFF = 'human_handoff',
  WA_SESSION_WINDOW = 'wa_session_window',
  WHATSAPP_MESSAGE = 'whatsapp_message',
  EMAIL_SEND = 'email_send',
  EMAIL_READ = 'email_read',
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
