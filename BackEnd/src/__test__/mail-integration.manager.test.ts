import { describe, expect, it } from 'vitest'
import {
  buildEmailIntegrationResponse,
  normalizeEmailIntegrationPayload,
} from '../services/integrations/mail/mail-integration.manager'
import { MailIntegrationConfig } from '../services/integrations/mail/mail.types'

describe('mail-integration.manager', () => {
  it('normaliza preset Gmail com defaults de IMAP/SMTP', () => {
    const payload = normalizeEmailIntegrationPayload({
      provider_preset: 'gmail',
      email_address: 'mateus@gmail.com',
      username: 'mateus@gmail.com',
      password: 'app-password',
    })

    expect(payload.providerPreset).toBe('gmail')
    expect(payload.providerFamily).toBe('generic_imap_smtp')
    expect(payload.authType).toBe('app_password')
    expect(payload.smtpHost).toBe('smtp.gmail.com')
    expect(payload.smtpPort).toBe(587)
    expect(payload.imapHost).toBe('imap.gmail.com')
    expect(payload.imapPort).toBe(993)
  })

  it('nao retorna secrets brutos para o frontend', () => {
    const config: MailIntegrationConfig = {
      integrationId: 'integration-1',
      companyId: 'company-1',
      provider: 'email',
      providerPreset: 'gmail',
      providerFamily: 'generic_imap_smtp',
      authType: 'app_password',
      readMethod: 'imap',
      sendMethod: 'smtp',
      emailAddress: 'mateus@gmail.com',
      username: 'mateus@gmail.com',
      password: 'secret-123',
      accessToken: 'token-123',
      refreshToken: 'refresh-123',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpSecure: false,
      imapHost: 'imap.gmail.com',
      imapPort: 993,
      imapSecure: true,
      status: 'connected',
      isDefault: true,
      isActive: true,
      canRead: true,
      canSend: true,
    }

    const response = buildEmailIntegrationResponse(config) as Record<string, unknown>

    expect(response.password).toBeUndefined()
    expect(response.access_token).toBeUndefined()
    expect(response.refresh_token).toBeUndefined()
    expect(response.has_password).toBe(true)
    expect(response.has_access_token).toBe(true)
    expect(response.has_refresh_token).toBe(true)
  })
})
