import { MailProvider } from './mail.provider'
import { loadMailIntegrationConfig } from './mail-integration.repository'
import { MicrosoftGraphMailProvider } from './providers/microsoft-graph.provider'
import { ImapSmtpMailProvider } from './providers/imap-smtp.provider'
import { MailIntegrationConfig } from './mail.types'

export class MailProviderFactory {
  static async fromIntegrationId(integrationId: string): Promise<MailProvider> {
    const config = await loadMailIntegrationConfig(integrationId)
    return MailProviderFactory.fromConfig(config)
  }

  static fromConfig(config: MailIntegrationConfig): MailProvider {
    if (config.providerFamily === 'microsoft365' || config.readMethod === 'graph' || config.sendMethod === 'graph') {
      return new MicrosoftGraphMailProvider(config)
    }

    if (config.readMethod === 'imap' || config.sendMethod === 'smtp' || config.providerFamily === 'generic_imap_smtp') {
      return new ImapSmtpMailProvider(config)
    }

    throw new Error('Provider de email não suportado para esta integração')
  }
}
