import axios from 'axios'
import { OutlookClient } from '../../email_reader/outlook/outlook.client'
import { refreshOutlookAccessToken } from '../../email_reader/outlook/outlook.oauth'
import { persistMicrosoft365Tokens } from '../mail-integration.repository'
import { MailConnectionTester, MailProvider, MailReader, MailSender } from '../mail.provider'
import {
  CanonicalMailMessage,
  MailAddress,
  MailConnectionTestResult,
  MailIntegrationConfig,
  MailSendInput,
  MailSendResult,
} from '../mail.types'

function mapAddress(address?: { name?: string; address?: string } | null): MailAddress | null {
  if (!address?.address) return null
  return {
    name: address.name || null,
    address: address.address,
  }
}

function mapAddresses(addresses?: Array<{ name?: string; address?: string }> | null): MailAddress[] {
  return Array.isArray(addresses) ? addresses.map((item) => mapAddress(item)).filter(Boolean) as MailAddress[] : []
}

export class MicrosoftGraphMailProvider implements MailProvider, MailReader, MailSender, MailConnectionTester {
  readonly reader: MailReader = this
  readonly sender: MailSender = this
  readonly tester: MailConnectionTester = this

  constructor(readonly config: MailIntegrationConfig) {}

  private isAccessTokenExpired(): boolean {
    const expiresAt = String(this.config.expiresAt || '').trim()
    if (!expiresAt) {
      return false
    }

    const expiresAtMs = Date.parse(expiresAt)
    if (Number.isNaN(expiresAtMs)) {
      return false
    }

    return expiresAtMs <= Date.now() + 60_000
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.config.refreshToken) {
      throw new Error('Refresh token do Microsoft 365 nao encontrado')
    }

    const tokenData = await refreshOutlookAccessToken(this.config.refreshToken, {
      clientId: this.config.oauthClientId,
      clientSecret: this.config.oauthClientSecret,
      redirectUri: this.config.oauthRedirectUri,
      tenantId: this.config.oauthTenantId,
    })
    const accessToken = String(tokenData?.access_token || '').trim()
    if (!accessToken) {
      throw new Error('Nao foi possivel renovar o access token do Microsoft 365.')
    }

    const refreshToken = String(tokenData?.refresh_token || '').trim() || this.config.refreshToken || null
    const expiresIn = Number(tokenData?.expires_in || 3600)
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    this.config.accessToken = accessToken
    this.config.refreshToken = refreshToken
    this.config.expiresAt = expiresAt

    await persistMicrosoft365Tokens(this.config.integrationId, {
      accessToken,
      refreshToken,
      expiresAt,
      emailAddress: this.config.emailAddress || null,
    })
  }

  private async getClient(): Promise<OutlookClient> {
    if (!this.config.accessToken || this.isAccessTokenExpired()) {
      await this.refreshAccessToken()
    }

    if (!this.config.accessToken) {
      throw new Error('Token do Microsoft 365 nao encontrado')
    }

    return new OutlookClient(this.config.accessToken)
  }

  private shouldRefreshFromError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false
    }

    if (error.response?.status !== 401) {
      return false
    }

    const message = String(error.response?.data?.error?.message || '').toLowerCase()
    return message.includes('token is expired') || message.includes('lifetime validation failed')
  }

  private async withGraphClient<T>(operation: (client: OutlookClient) => Promise<T>): Promise<T> {
    const client = await this.getClient()

    try {
      return await operation(client)
    } catch (error) {
      if (!this.config.refreshToken || !this.shouldRefreshFromError(error)) {
        throw error
      }

      await this.refreshAccessToken()
      const refreshedClient = await this.getClient()
      return operation(refreshedClient)
    }
  }

  async listMessages(limit = 5): Promise<CanonicalMailMessage[]> {
    const response = await this.withGraphClient((client) => client.getInboxMessages(limit))
    const rows = Array.isArray(response?.value) ? response.value : []

    return rows.map((message: any) => ({
      external_message_id: String(message.id || ''),
      external_thread_id: String(message.conversationId || '').trim() || null,
      subject: String(message.subject || '').trim(),
      from: mapAddresses(message.from?.emailAddress ? [message.from.emailAddress] : []),
      to: mapAddresses(
        Array.isArray(message.toRecipients)
          ? message.toRecipients.map((recipient: any) => recipient?.emailAddress).filter(Boolean)
          : []
      ),
      cc: mapAddresses(
        Array.isArray(message.ccRecipients)
          ? message.ccRecipients.map((recipient: any) => recipient?.emailAddress).filter(Boolean)
          : []
      ),
      bcc: mapAddresses(
        Array.isArray(message.bccRecipients)
          ? message.bccRecipients.map((recipient: any) => recipient?.emailAddress).filter(Boolean)
          : []
      ),
      body_text: String(message.bodyPreview || '').trim() || null,
      body_html:
        typeof message.body?.content === 'string' && String(message.body?.contentType || '').toLowerCase() === 'html'
          ? message.body.content
          : null,
      preview: String(message.bodyPreview || '').trim() || null,
      received_at: message.receivedDateTime || null,
      sent_at: message.sentDateTime || null,
      is_read: !!message.isRead,
      flags: [],
      folder: 'INBOX',
      attachments: [],
      headers: {},
    }))
  }

  async getMessage(messageId: string): Promise<CanonicalMailMessage> {
    const message = await this.withGraphClient((client) => client.getMessage(messageId))

    return {
      external_message_id: String(message.id || ''),
      external_thread_id: String(message.conversationId || '').trim() || null,
      subject: String(message.subject || '').trim(),
      from: mapAddresses(message.from?.emailAddress ? [message.from.emailAddress] : []),
      to: mapAddresses(
        Array.isArray(message.toRecipients)
          ? message.toRecipients.map((recipient: any) => recipient?.emailAddress).filter(Boolean)
          : []
      ),
      cc: mapAddresses(
        Array.isArray(message.ccRecipients)
          ? message.ccRecipients.map((recipient: any) => recipient?.emailAddress).filter(Boolean)
          : []
      ),
      bcc: mapAddresses(
        Array.isArray(message.bccRecipients)
          ? message.bccRecipients.map((recipient: any) => recipient?.emailAddress).filter(Boolean)
          : []
      ),
      body_text:
        typeof message.body?.content === 'string' && String(message.body?.contentType || '').toLowerCase() !== 'html'
          ? message.body.content
          : String(message.bodyPreview || '').trim() || null,
      body_html:
        typeof message.body?.content === 'string' && String(message.body?.contentType || '').toLowerCase() === 'html'
          ? message.body.content
          : null,
      preview: String(message.bodyPreview || '').trim() || null,
      received_at: message.receivedDateTime || null,
      sent_at: message.sentDateTime || null,
      is_read: !!message.isRead,
      flags: [],
      folder: 'INBOX',
      attachments: [],
      headers: {},
    }
  }

  async send(input: MailSendInput): Promise<MailSendResult> {
    await this.withGraphClient((client) => client.sendMail(input))
    return { provider: 'microsoft365_graph', externalMessageId: null }
  }

  async testConnection(): Promise<MailConnectionTestResult> {
    const mailbox = await this.withGraphClient((client) => client.getCurrentMailbox())
    const mailboxEmail = String(mailbox?.mail || mailbox?.userPrincipalName || this.config.emailAddress || '').trim() || null

    return {
      success: true,
      provider: 'microsoft365_graph',
      capabilities: {
        canRead: true,
        canSend: true,
      },
      mailbox: mailboxEmail,
      details: 'Conexao com Microsoft Graph validada com sucesso.',
    }
  }
}
