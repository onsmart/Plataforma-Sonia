import { describe, expect, it } from 'vitest'
import {
  mapMailIntegrationConfig,
  normalizeMailProviderFamily,
} from '../services/integrations/mail/mail-integration.repository'

describe('mail-integration.repository', () => {
  it('normaliza Outlook/Office365/Microsoft365 para microsoft365', () => {
    expect(normalizeMailProviderFamily('outlook')).toBe('microsoft365')
    expect(normalizeMailProviderFamily('office365')).toBe('microsoft365')
    expect(normalizeMailProviderFamily('microsoft365')).toBe('microsoft365')
  })

  it('mantem microsoft365 com graph para leitura e envio quando ha access token', () => {
    const config = mapMailIntegrationConfig({
      id: 'integration-1',
      provider: 'microsoft365',
      email: 'mailbox@empresa.com',
      access_token: 'token-123',
      refresh_token: 'refresh-123',
      smtp_host: 'smtp.office365.com',
      smtp_port: 587,
      app_key: 'not-used',
      expires_at: '2026-01-01T00:00:00.000Z',
    })

    expect(config.providerFamily).toBe('microsoft365')
    expect(config.readMethod).toBe('graph')
    expect(config.sendMethod).toBe('graph')
    expect(config.canRead).toBe(true)
    expect(config.canSend).toBe(true)
  })

  it('mantem microsoft365 pendente antes do token OAuth', () => {
    const config = mapMailIntegrationConfig({
      id: 'integration-1b',
      provider: 'microsoft365',
      email: 'mailbox@empresa.com',
      smtp_host: 'smtp.office365.com',
      smtp_port: 587,
    })

    expect(config.providerFamily).toBe('microsoft365')
    expect(config.readMethod).toBe('none')
    expect(config.sendMethod).toBe('none')
    expect(config.canRead).toBe(false)
    expect(config.canSend).toBe(false)
  })

  it('habilita graph para microsoft365 quando ha refresh token mesmo sem access token ativo', () => {
    const config = mapMailIntegrationConfig({
      id: 'integration-1c',
      provider: 'microsoft365',
      email: 'mailbox@empresa.com',
      refresh_token: 'refresh-123',
      smtp_host: 'smtp.office365.com',
      smtp_port: 587,
    })

    expect(config.providerFamily).toBe('microsoft365')
    expect(config.readMethod).toBe('graph')
    expect(config.sendMethod).toBe('graph')
    expect(config.canRead).toBe(true)
    expect(config.canSend).toBe(true)
  })

  it('resolve IMAP+SMTP generico quando ha configuracao complementar', () => {
    const config = mapMailIntegrationConfig(
      {
        id: 'integration-2',
        provider: 'email',
        email: 'contato@empresa.com',
        smtp_host: 'smtp.empresa.com',
        smtp_port: 465,
        app_key: 'secret',
      },
      {
        integration_id: 'integration-2',
        provider_family: 'generic_imap_smtp',
        auth_type: 'basic',
        read_method: 'imap',
        send_method: 'smtp',
        email_address: 'contato@empresa.com',
        username: 'contato@empresa.com',
        smtp_host: 'smtp.empresa.com',
        smtp_port: 465,
        smtp_secure: true,
        imap_host: 'imap.empresa.com',
        imap_port: 993,
        imap_secure: true,
      }
    )

    expect(config.providerFamily).toBe('generic_imap_smtp')
    expect(config.readMethod).toBe('imap')
    expect(config.sendMethod).toBe('smtp')
    expect(config.imapHost).toBe('imap.empresa.com')
    expect(config.smtpHost).toBe('smtp.empresa.com')
    expect(config.canRead).toBe(true)
    expect(config.canSend).toBe(true)
  })
})
