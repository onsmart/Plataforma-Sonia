import { MailProviderFactory } from './mail-provider.factory'
import { MailSendInput, MailSendResult } from './mail.types'

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

