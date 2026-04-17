import { OutlookClient } from '../../email_reader/outlook/outlook.client'
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

  private getClient() {
    if (!this.config.accessToken) {
      throw new Error('Token do Microsoft 365 não encontrado')
    }
    return new OutlookClient(this.config.accessToken)
  }

  async listMessages(limit = 5): Promise<CanonicalMailMessage[]> {
    const response = await this.getClient().getInboxMessages(limit)
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
      body_html: typeof message.body?.content === 'string' && String(message.body?.contentType || '').toLowerCase() === 'html'
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
    const message = await this.getClient().getMessage(messageId)

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
    await this.getClient().sendMail(input)
    return { provider: 'microsoft365_graph', externalMessageId: null }
  }

  async testConnection(): Promise<MailConnectionTestResult> {
    const mailbox = await this.getClient().getCurrentMailbox()
    const mailboxEmail = String(mailbox?.mail || mailbox?.userPrincipalName || this.config.emailAddress || '').trim() || null

    return {
      success: true,
      provider: 'microsoft365_graph',
      capabilities: {
        canRead: true,
        canSend: true,
      },
      mailbox: mailboxEmail,
      details: 'Conexão com Microsoft Graph validada com sucesso.',
    }
  }
}

