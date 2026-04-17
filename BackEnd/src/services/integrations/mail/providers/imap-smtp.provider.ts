import nodemailer from 'nodemailer'
import { ImapFlow } from 'imapflow'
import { Readable } from 'stream'
import { buildEmailHtml } from '../../email/buildEmailHtml'
import { MailConnectionTester, MailProvider, MailReader, MailSender } from '../mail.provider'
import {
  CanonicalMailMessage,
  MailAddress,
  MailConnectionTestResult,
  MailIntegrationConfig,
  MailSendInput,
  MailSendResult,
} from '../mail.types'

function mapMailboxAddress(address?: { name?: string; address?: string } | null): MailAddress | null {
  if (!address?.address) return null
  return {
    name: address.name || null,
    address: address.address,
  }
}

function mapMailboxAddresses(addresses?: Array<{ name?: string; address?: string }> | null): MailAddress[] {
  return Array.isArray(addresses) ? addresses.map((item) => mapMailboxAddress(item)).filter(Boolean) as MailAddress[] : []
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractMessageBody(source?: Buffer | null): { text: string | null; html: string | null; preview: string | null } {
  if (!source || source.length === 0) {
    return { text: null, html: null, preview: null }
  }

  const raw = source.toString('utf8')
  const sections = raw.split(/\r?\n\r?\n/)
  const body = sections.length > 1 ? sections.slice(1).join('\n\n').trim() : raw.trim()

  if (!body) {
    return { text: null, html: null, preview: null }
  }

  const maybeHtml = /<html[\s>]|<body[\s>]|<\/[a-z]+>/i.test(body)
  const html = maybeHtml ? body : null
  const text = maybeHtml ? stripHtml(body) : body.replace(/\s+/g, ' ').trim()
  const preview = text ? text.slice(0, 220) : null

  return {
    text: text || null,
    html,
    preview,
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export class ImapSmtpMailProvider implements MailProvider, MailReader, MailSender, MailConnectionTester {
  readonly tester: MailConnectionTester = this

  constructor(readonly config: MailIntegrationConfig) {}

  get reader(): MailReader | undefined {
    return this.config.readMethod === 'imap' ? this : undefined
  }

  get sender(): MailSender | undefined {
    return this.config.sendMethod === 'smtp' ? this : undefined
  }

  private createImapClient(verifyOnly = false) {
    if (!this.config.imapHost || !this.config.imapPort || !this.config.username || !this.config.password) {
      throw new Error('Configuração IMAP incompleta para esta integração de email.')
    }

    return new ImapFlow({
      host: this.config.imapHost,
      port: this.config.imapPort,
      secure: this.config.imapSecure ?? this.config.imapPort === 993,
      auth: {
        user: this.config.username,
        pass: this.config.password || undefined,
      },
      disableAutoIdle: true,
      verifyOnly,
      logger: false,
    })
  }

  private createSmtpTransport() {
    if (!this.config.smtpHost || !this.config.smtpPort || !this.config.username || !this.config.password) {
      throw new Error('Configuração SMTP incompleta para esta integração de email.')
    }

    return nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpSecure ?? this.config.smtpPort === 465,
      auth: {
        user: this.config.username,
        pass: this.config.password || undefined,
      },
    })
  }

  async listMessages(limit = 5): Promise<CanonicalMailMessage[]> {
    const client = this.createImapClient(false)
    await client.connect()

    try {
      await client.mailboxOpen('INBOX', { readOnly: true })
      const total = client.mailbox ? client.mailbox.exists : 0
      if (!total) {
        return []
      }

      const start = Math.max(1, total - limit + 1)
      const rows = await client.fetchAll(`${start}:*`, {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
        source: { maxLength: 65536 },
      })

      return rows
        .reverse()
        .map((message) => {
          const body = extractMessageBody(message.source)
          return {
            external_message_id: String(message.uid || message.seq),
            external_thread_id: message.envelope?.inReplyTo || message.envelope?.messageId || null,
            subject: String(message.envelope?.subject || '').trim(),
            from: mapMailboxAddresses(message.envelope?.from || []),
            to: mapMailboxAddresses(message.envelope?.to || []),
            cc: mapMailboxAddresses(message.envelope?.cc || []),
            bcc: mapMailboxAddresses(message.envelope?.bcc || []),
            body_text: body.text,
            body_html: body.html,
            preview: body.preview,
            received_at:
              message.internalDate instanceof Date
                ? message.internalDate.toISOString()
                : String(message.internalDate || '').trim() || null,
            sent_at:
              message.envelope?.date instanceof Date ? message.envelope.date.toISOString() : null,
            is_read: !(message.flags?.has('\\Seen') === false),
            flags: Array.from(message.flags || []),
            folder: 'INBOX',
            attachments: [],
            headers: {},
          } as CanonicalMailMessage
        })
    } finally {
      await client.logout().catch(() => undefined)
    }
  }

  async getMessage(messageId: string): Promise<CanonicalMailMessage> {
    const client = this.createImapClient(false)
    await client.connect()

    try {
      await client.mailboxOpen('INBOX', { readOnly: true })
      const message = await client.fetchOne(String(messageId), {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
      }, { uid: true })

      if (!message) {
        throw new Error('Mensagem IMAP não encontrada.')
      }

      const download = await client.download(String(message.uid), undefined, { uid: true })
      const raw = await streamToBuffer(download.content)
      const body = extractMessageBody(raw)

      return {
        external_message_id: String(message.uid || message.seq),
        external_thread_id: message.envelope?.inReplyTo || message.envelope?.messageId || null,
        subject: String(message.envelope?.subject || '').trim(),
        from: mapMailboxAddresses(message.envelope?.from || []),
        to: mapMailboxAddresses(message.envelope?.to || []),
        cc: mapMailboxAddresses(message.envelope?.cc || []),
        bcc: mapMailboxAddresses(message.envelope?.bcc || []),
        body_text: body.text,
        body_html: body.html,
        preview: body.preview,
        received_at:
          message.internalDate instanceof Date
            ? message.internalDate.toISOString()
            : String(message.internalDate || '').trim() || null,
        sent_at:
          message.envelope?.date instanceof Date ? message.envelope.date.toISOString() : null,
        is_read: !(message.flags?.has('\\Seen') === false),
        flags: Array.from(message.flags || []),
        folder: 'INBOX',
        attachments: [],
        headers: {},
      }
    } finally {
      await client.logout().catch(() => undefined)
    }
  }

  async send(input: MailSendInput): Promise<MailSendResult> {
    const transporter = this.createSmtpTransport()

    let htmlContent: string | undefined
    if (input.html) {
      htmlContent = input.html
    } else if ((input.style || input.visual_style) && input.text) {
      htmlContent = buildEmailHtml(input.text, input.style || input.visual_style)
    }

    const info = await transporter.sendMail({
      from: input.from || this.config.emailAddress || this.config.username,
      to: input.to,
      subject: input.subject,
      text: htmlContent ? undefined : input.text || '',
      html: htmlContent,
    })

    return {
      provider: 'smtp',
      externalMessageId: String(info?.messageId || '').trim() || null,
    }
  }

  async testConnection(): Promise<MailConnectionTestResult> {
    let canRead = false
    let canSend = false
    let details: string[] = []

    if (this.config.readMethod === 'imap') {
      const client = this.createImapClient(true)
      try {
        await client.connect()
        canRead = true
        details.push('IMAP OK')
      } finally {
        await client.logout().catch(() => undefined)
      }
    }

    if (this.config.sendMethod === 'smtp') {
      const transport = this.createSmtpTransport()
      await transport.verify()
      canSend = true
      details.push('SMTP OK')
    }

    return {
      success: canRead || canSend,
      provider: 'imap_smtp',
      capabilities: {
        canRead,
        canSend,
      },
      mailbox: this.config.emailAddress || this.config.username || null,
      details: details.join(' · ') || null,
    }
  }
}
