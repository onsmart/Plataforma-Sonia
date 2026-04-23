import { EmailReader } from './email-reader.interface'
import { OutlookEmailReader } from './outlook/outlook.reader'

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
      return new OutlookEmailReader(credentials.refresh_token, {
        clientId: credentials.oauth_client_id || credentials.oauthClientId,
        clientSecret: credentials.oauth_client_secret || credentials.oauthClientSecret,
        redirectUri: credentials.oauth_redirect_uri || credentials.oauthRedirectUri,
        tenantId: credentials.oauth_tenant_id || credentials.oauthTenantId,
      })

    default:
      throw new Error('Provider de email nao suportado')
  }
}
