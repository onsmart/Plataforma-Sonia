import { OutlookEmailReader } from './outlook/outlook.reader'
import { EmailReader } from './email-reader.interface'

function normalizeEmailProvider(provider: string): string {
  const normalized = String(provider || '').trim().toLowerCase()
  if (normalized === 'outlook' || normalized === 'office365' || normalized === 'microsoft365') {
    return 'microsoft365'
  }
  return normalized
}

export function createEmailReader(provider: string, credentials: any): EmailReader {
  switch (normalizeEmailProvider(provider)) {
    case 'microsoft365':
      return new OutlookEmailReader(credentials.refresh_token)

    default:
      throw new Error('Provider de email não suportado')
  }
}
