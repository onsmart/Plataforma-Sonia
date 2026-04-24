import nodemailer from 'nodemailer'
import { ImapFlow } from 'imapflow'
import { Readable } from 'stream'
import { buildEmailHtml } from '../../email/buildEmailHtml'
import { loadOptionalMailTlsCaBundle } from '../../../../lib/tls-ca'
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

function decodeQuotedPrintable(value: string): string {
  return value
    .replace(/=\r?\n/g, '')
    .replace(/=([A-Fa-f0-9]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
}

function decodeTransferEncoding(value: string, encoding?: string | null): string {
  const normalized = String(encoding || '').trim().toLowerCase()

  if (normalized === 'base64') {
    const compact = value.replace(/\s+/g, '')
    if (!compact) return ''
    try {
      return Buffer.from(compact, 'base64').toString('utf8')
    } catch {
      return value
    }
  }

  if (normalized === 'quoted-printable') {
    return decodeQuotedPrintable(value)
  }

  return value
}

function parseHeaders(rawHeaders: string): Record<string, string> {
  const lines = rawHeaders.split(/\r?\n/)
  const unfolded: string[] = []

  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += ` ${line.trim()}`
    } else {
      unfolded.push(line)
    }
  }

  const headers: Record<string, string> = {}
  for (const line of unfolded) {
    const separatorIndex = line.indexOf(':')
    if (separatorIndex <= 0) continue
    const key = line.slice(0, separatorIndex).trim().toLowerCase()
    const value = line.slice(separatorIndex + 1).trim()
    if (key) {
      headers[key] = value
    }
  }

  return headers
}

function parseContentType(value?: string | null): { mimeType: string; boundary: string | null } {
  const raw = String(value || '').trim()
  if (!raw) {
    return { mimeType: 'text/plain', boundary: null }
  }

  const [typePart, ...params] = raw.split(';')
  let boundary: string | null = null

  for (const param of params) {
    const [key, ...rest] = param.split('=')
    if (String(key || '').trim().toLowerCase() === 'boundary') {
      boundary = rest.join('=').trim().replace(/^"(.*)"$/, '$1') || null
    }
  }

  return {
    mimeType: typePart.trim().toLowerCase() || 'text/plain',
    boundary,
  }
}

type ParsedMimeBody = {
  text: string | null
  html: string | null
  preview: string | null
}

function parseMimeEntity(rawEntity: string): ParsedMimeBody {
  const sections = rawEntity.split(/\r?\n\r?\n/)
  const rawHeaders = sections.length > 1 ? sections.shift() || '' : ''
  const rawBody = sections.length > 0 ? sections.join('\n\n') : rawEntity
  const headers = parseHeaders(rawHeaders)
  const { mimeType, boundary } = parseContentType(headers['content-type'])

  if (mimeType.startsWith('multipart/') && boundary) {
    const boundaryMarker = `--${boundary}`
    const parts = rawBody
      .split(boundaryMarker)
      .map((part) => part.trim())
      .filter((part) => part && part !== '--')

    let text: string | null = null
    let html: string | null = null

    for (const part of parts) {
      const normalizedPart = part.endsWith('--') ? part.slice(0, -2).trim() : part
      const parsedPart = parseMimeEntity(normalizedPart)
      if (!html && parsedPart.html) html = parsedPart.html
      if (!text && parsedPart.text) text = parsedPart.text
      if (html && text) break
    }

    const previewSource = text || (html ? stripHtml(html) : null)
    return {
      text,
      html,
      preview: previewSource ? previewSource.slice(0, 220) : null,
    }
  }

  const decodedBody = decodeTransferEncoding(rawBody, headers['content-transfer-encoding']).trim()
  if (!decodedBody) {
    return { text: null, html: null, preview: null }
  }

  if (mimeType === 'text/html') {
    const text = stripHtml(decodedBody)
    return {
      text: text || null,
      html: decodedBody,
      preview: text ? text.slice(0, 220) : null,
    }
  }

  const maybeHtml = /<html[\s>]|<body[\s>]|<\/[a-z]+>/i.test(decodedBody)
  const html = maybeHtml ? decodedBody : null
  const text = maybeHtml ? stripHtml(decodedBody) : decodedBody.replace(/\s+/g, ' ').trim()

  return {
    text: text || null,
    html,
    preview: text ? text.slice(0, 220) : null,
  }
}

export function extractMessageBody(source?: Buffer | null): { text: string | null; html: string | null; preview: string | null } {
  if (!source || source.length === 0) {
    return { text: null, html: null, preview: null }
  }

  const raw = source.toString('utf8')
  return parseMimeEntity(raw.trim())
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
  private readonly tlsCaBundle = loadOptionalMailTlsCaBundle()

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
      tls: this.tlsCaBundle ? { ca: [this.tlsCaBundle], servername: this.config.imapHost } : undefined,
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
      tls: this.tlsCaBundle ? { ca: [this.tlsCaBundle], servername: this.config.smtpHost } : undefined,
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
