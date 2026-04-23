import { CanonicalMailMessage } from './mail.types'
import { MailProviderFactory } from './mail-provider.factory'
import { resolveMailIntegrationForRead } from './mail-integration.resolver'

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

export async function readInboxMessagesForUser(
  userEmail: string,
  limit = 5,
  preferredIntegrationId?: string | null
): Promise<CanonicalMailMessage[]> {
  const config = await resolveMailIntegrationForRead({
    userEmail,
    preferredIntegrationId,
  })
  const provider = MailProviderFactory.fromConfig(config)

  if (!provider.reader) {
    throw new Error('Esta integracao de email nao suporta leitura de inbox.')
  }

  return provider.reader.listMessages(limit)
}

export async function getInboxMessageForUser(
  userEmail: string,
  messageId: string,
  preferredIntegrationId?: string | null
): Promise<CanonicalMailMessage> {
  const config = await resolveMailIntegrationForRead({
    userEmail,
    preferredIntegrationId,
  })
  const provider = MailProviderFactory.fromConfig(config)

  if (!provider.reader) {
    throw new Error('Esta integracao de email nao suporta leitura de inbox.')
  }

  return provider.reader.getMessage(messageId)
}
