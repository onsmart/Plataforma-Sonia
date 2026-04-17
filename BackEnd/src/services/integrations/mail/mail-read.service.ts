import { CanonicalMailMessage } from './mail.types'
import { MailProviderFactory } from './mail-provider.factory'

export async function readInboxMessages(
  integrationId: string,
  limit = 5
): Promise<CanonicalMailMessage[]> {
  const provider = await MailProviderFactory.fromIntegrationId(integrationId)

  if (!provider.reader) {
    throw new Error('Esta integração de email não suporta leitura de inbox.')
  }

  return provider.reader.listMessages(limit)
}

export async function getInboxMessage(
  integrationId: string,
  messageId: string
): Promise<CanonicalMailMessage> {
  const provider = await MailProviderFactory.fromIntegrationId(integrationId)

  if (!provider.reader) {
    throw new Error('Esta integração de email não suporta leitura de inbox.')
  }

  return provider.reader.getMessage(messageId)
}

