import { MailProviderFactory } from './mail-provider.factory'
import { MailSendInput, MailSendResult } from './mail.types'
import { resolveMailIntegrationForSend } from './mail-integration.resolver'

export async function sendMailFromIntegration(
  integrationId: string,
  input: MailSendInput
): Promise<MailSendResult> {
  const provider = await MailProviderFactory.fromIntegrationId(integrationId)

  if (!provider.sender) {
    throw new Error('Esta integração de email não suporta envio.')
  }

  return provider.sender.send(input)
}

export async function sendMailForUser(
  userEmail: string,
  input: MailSendInput,
  preferredIntegrationId?: string | null
): Promise<MailSendResult> {
  const config = await resolveMailIntegrationForSend({
    userEmail,
    preferredIntegrationId,
  })
  const provider = MailProviderFactory.fromConfig(config)

  if (!provider.sender) {
    throw new Error('Esta integracao de email nao suporta envio.')
  }

  return provider.sender.send(input)
}
