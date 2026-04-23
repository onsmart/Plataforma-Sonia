export type MailProviderFamily = 'microsoft365' | 'generic_imap_smtp' | 'unknown'

export type MailAuthType = 'oauth2' | 'basic' | 'app_password' | 'unknown'

export type MailReadMethod = 'graph' | 'imap' | 'none'

export type MailSendMethod = 'graph' | 'smtp' | 'none'

export interface MailAddress {
  name?: string | null
  address: string
}

export interface CanonicalMailAttachment {
  filename?: string | null
  contentType?: string | null
  size?: number | null
  partId?: string | null
}

export interface CanonicalMailMessage {
  external_message_id: string
  external_thread_id?: string | null
  subject: string
  from: MailAddress[]
  to: MailAddress[]
  cc: MailAddress[]
  bcc: MailAddress[]
  body_text?: string | null
  body_html?: string | null
  preview?: string | null
  received_at?: string | null
  sent_at?: string | null
  is_read: boolean
  flags: string[]
  folder?: string | null
  attachments: CanonicalMailAttachment[]
  headers?: Record<string, string>
}

export interface MailSendInput {
  to: string
  subject: string
  text?: string
  html?: string
  style?: string
  visual_style?: string
  from?: string
}

export interface MailSendResult {
  provider: string
  externalMessageId?: string | null
}

export interface MailConnectionTestResult {
  success: boolean
  provider: string
  capabilities: {
    canRead: boolean
    canSend: boolean
  }
  mailbox?: string | null
  details?: string | null
}

export interface MailIntegrationConfig {
  integrationId: string
  companyId?: string | null
  provider: string
  providerPreset?: string | null
  providerFamily: MailProviderFamily
  authType: MailAuthType
  readMethod: MailReadMethod
  sendMethod: MailSendMethod
  emailAddress: string
  username: string
  password?: string | null
  oauthClientId?: string | null
  oauthClientSecret?: string | null
  oauthRedirectUri?: string | null
  oauthTenantId?: string | null
  accessToken?: string | null
  refreshToken?: string | null
  expiresAt?: string | null
  smtpHost?: string | null
  smtpPort?: number | null
  smtpSecure?: boolean | null
  imapHost?: string | null
  imapPort?: number | null
  imapSecure?: boolean | null
  scopes?: string[]
  status?: string | null
  isDefault?: boolean
  isActive?: boolean
  lastTestAt?: string | null
  lastSyncAt?: string | null
  syncCursor?: string | null
  syncCheckpoint?: Record<string, unknown> | null
  canRead: boolean
  canSend: boolean
  rawIntegration?: Record<string, unknown> | null
  rawSettings?: Record<string, unknown> | null
}
