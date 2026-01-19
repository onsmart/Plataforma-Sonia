import nodemailer from 'nodemailer'
import { buildEmailHtml } from './buildEmailHtml'

interface SMTPCreds {
  email: string
  smtp_host: string
  smtp_port: number
  app_key: string
}

export async function sendWithSMTP(
  creds: SMTPCreds,
  data: { to: string; subject: string; text?: string; html?: string; style?: string }
) {
  const transporter = nodemailer.createTransport({
    host: creds.smtp_host,
    port: creds.smtp_port,
    secure: creds.smtp_port === 465,
    auth: {
      user: creds.email,
      pass: creds.app_key,
    },
  })

  // Prioridade: html > style (com buildEmailHtml) > text
  let htmlContent: string | undefined

  if (data.html) {
    // Se já tem HTML, usa diretamente
    htmlContent = data.html
  } else if (data.style && data.text) {
    // Se tem style, gera HTML usando buildEmailHtml
    htmlContent = buildEmailHtml(data.text, data.style)
  }

  await transporter.sendMail({
    from: creds.email,
    to: data.to,
    subject: data.subject,
    text: htmlContent ? undefined : (data.text || ''), // Envia text apenas se não houver HTML
    html: htmlContent, // Envia HTML se gerado ou fornecido
  })
}
