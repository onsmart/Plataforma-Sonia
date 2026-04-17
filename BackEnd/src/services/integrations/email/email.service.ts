import { SendEmailInput } from './email.types'
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
    logger.warn('[sendEmail] Provider de email da integracao falhou', {
      integrationsId,
      error: providerError?.message || providerError,
    })

    throw new Error(
      `Falha ao enviar email com a integracao configurada. Revise as credenciais salvas para esta conta. Ultimo erro: ${providerError?.message || providerError}`
    )
  }
}
