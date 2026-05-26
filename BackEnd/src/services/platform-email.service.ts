import { Resend } from 'resend'
import logger from '../lib/logger'

export type PlatformEmailPayload = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

let resendClient: Resend | null = null

function getResendClient(): Resend | null {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim()
  if (!apiKey) return null
  if (!resendClient) {
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

export function isPlatformEmailConfigured(): boolean {
  return Boolean(getResendClient() && getPlatformEmailFrom())
}

function getPlatformEmailFrom(): string | null {
  const from = String(process.env.RESEND_FROM_EMAIL || process.env.PLATFORM_EMAIL_FROM || '').trim()
  return from || null
}

/**
 * E-mail transacional da plataforma (Resend). Não usa integração de e-mail do tenant.
 */
export async function sendPlatformEmail(payload: PlatformEmailPayload): Promise<{ id?: string }> {
  const client = getResendClient()
  const from = getPlatformEmailFrom()

  if (!client || !from) {
    throw new Error(
      'E-mail da plataforma não configurado. Defina RESEND_API_KEY e RESEND_FROM_EMAIL no ambiente do backend.'
    )
  }

  const recipients = (Array.isArray(payload.to) ? payload.to : [payload.to])
    .map((email) => String(email || '').trim().toLowerCase())
    .filter(Boolean)

  if (recipients.length === 0) {
    throw new Error('Nenhum destinatário válido para e-mail da plataforma.')
  }

  const { data, error } = await client.emails.send({
    from,
    to: recipients,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    replyTo: payload.replyTo,
  })

  if (error) {
    throw new Error(error.message || 'Falha ao enviar e-mail via Resend')
  }

  logger.log('[platform-email] Enviado', {
    to: recipients,
    subject: payload.subject,
    id: data?.id,
  })

  return { id: data?.id }
}
