import { MailProviderFactory } from './mail-provider.factory'
import { MailConnectionTestResult } from './mail.types'

export async function testMailIntegrationConnection(
  integrationId: string
): Promise<MailConnectionTestResult> {
  const provider = await MailProviderFactory.fromIntegrationId(integrationId)
  return provider.tester.testConnection()
}

