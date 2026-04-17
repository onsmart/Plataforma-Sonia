import { SendEmailInput } from './email.types'
import { sendWithResend } from './resend.provider'
import { loadMailIntegrationConfig } from '../mail/mail-integration.repository'
import { sendMailFromIntegration } from '../mail/mail-send.service'
import logger from '../../../lib/logger'

export async function sendEmail(
  integrationsId: string,
  data: SendEmailInput
) {
  try {
    const result = await sendMailFromIntegration(integrationsId, data)
    return { provider: result.provider }
  } catch (providerError: any) {
    logger.warn('[sendEmail] Provider principal falhou, tentando Resend como fallback', {
      integrationsId,
      error: providerError?.message || providerError,
    })
  }

  const config = await loadMailIntegrationConfig(integrationsId)

  try {
    await sendWithResend({
      to: data.to,
      subject: data.subject,
      text: data.text,
      html: data.html,
      style: data.style || data.visual_style,
      from: config.emailAddress || 'Sonia AI <no-reply@sonia.ai>',
    })
    return { provider: 'resend' }
  } catch (resendError: any) {
    if (resendError.message?.includes('RESEND_API_KEY')) {
      throw new Error(
        'Falha ao enviar email: o provider configurado falhou e o Resend não está configurado. Configure RESEND_API_KEY ou revise as credenciais da integração.'
      )
    }
    throw new Error(
      `Falha ao enviar email: provider configurado e Resend falharam. Último erro: ${resendError.message || resendError}`
    )
  }
}
