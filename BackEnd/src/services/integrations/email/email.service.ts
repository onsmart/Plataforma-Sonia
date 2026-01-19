import { SendEmailInput } from './email.types'
import { sendWithSMTP } from './smtp.provider'
import { sendWithResend } from './resend.provider'
import { supabase } from '../../../lib/supabase'
import logger from '../../../lib/logger'

export async function sendEmail(
  integrationsId: string,
  data: SendEmailInput
) {
  const { data: creds, error } = await supabase
    .from('tb_integrations')
    .select('email, smtp_host, smtp_port, app_key')
    .eq('id', integrationsId)
    .single()

  if (!creds || error) {
    throw new Error('Credenciais de email não encontradas')
  }

  // 1️⃣ Tenta SMTP do agente
  try {
    await sendWithSMTP(
      {
        email: creds.email,
        smtp_host: creds.smtp_host,
        smtp_port: creds.smtp_port,
        app_key: creds.app_key,
      },
      {
        to: data.to,
        subject: data.subject,
        text: data.text,
        html: data.html,
        style: data.style || data.visual_style, // Suporta style ou visual_style
      }
    )

    return { provider: 'smtp' }
  } catch (err) {
    logger.warn('SMTP falhou, usando Resend', err)
  }

  // 2️⃣ Fallback Resend
  await sendWithResend({
    to: data.to,
    subject: data.subject,
    text: data.text,
    html: data.html,
    style: data.style || data.visual_style, // Suporta style ou visual_style
    from: creds.email || 'Sonia AI <no-reply@sonia.ai>',
  })

  return { provider: 'resend' }
}
