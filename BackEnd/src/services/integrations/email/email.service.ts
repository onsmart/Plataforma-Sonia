import { SendEmailInput } from './email.types'
import { sendMailForUser, sendMailFromIntegration } from '../mail/mail-send.service'
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

export async function sendEmailForUser(
  userEmail: string,
  preferredIntegrationId: string | null | undefined,
  data: SendEmailInput
) {
  try {
    const result = await sendMailForUser(userEmail, data, preferredIntegrationId)
    return { provider: result.provider }
  } catch (providerError: any) {
    logger.warn('[sendEmailForUser] Resolver/provider de email falhou', {
      userEmail,
      preferredIntegrationId,
      error: providerError?.message || providerError,
    })

    throw new Error(
      `Falha ao enviar email com a integracao configurada. Revise a integracao padrao de email. Ultimo erro: ${providerError?.message || providerError}`
    )
  }
}
