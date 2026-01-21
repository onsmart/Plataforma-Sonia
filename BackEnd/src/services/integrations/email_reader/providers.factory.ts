import { OutlookEmailReader } from './outlook/outlook.reader'
import { EmailReader } from './email-reader.interface'

export function createEmailReader(provider: string, credentials: any): EmailReader {
  switch (provider) {
    case 'outlook':
      return new OutlookEmailReader(credentials.refresh_token)

    default:
      throw new Error('Provider de email não suportado')
  }
}
