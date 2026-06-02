import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}))

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

import { resolveMetaWebhookVerificationSecrets } from '../services/integrations/whatsapp/meta-webhook-secret.service'

describe('resolveMetaWebhookVerificationSecrets', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    fromMock.mockReset()
  })

  it('inclui secret do env e da integração correspondente', async () => {
    process.env.WHATSAPP_META_APP_SECRET = 'env-secret'

    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ app_key: 'phone-1', meta_app_secret: 'integration-secret' }],
            error: null,
          }),
        }),
      }),
    })

    const payload = JSON.stringify({
      entry: [{ changes: [{ value: { metadata: { phone_number_id: 'phone-1' } } }] }],
    })

    const secrets = await resolveMetaWebhookVerificationSecrets(Buffer.from(payload))

    expect(secrets).toEqual(['env-secret', 'integration-secret'])
  })

  it('funciona só com secret da integração quando env está vazio', async () => {
    delete process.env.WHATSAPP_META_APP_SECRET

    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ app_key: 'phone-2', meta_app_secret: 'only-integration' }],
            error: null,
          }),
        }),
      }),
    })

    const payload = JSON.stringify({
      entry: [{ changes: [{ value: { metadata: { phone_number_id: 'phone-2' } } }] }],
    })

    const secrets = await resolveMetaWebhookVerificationSecrets(payload)

    expect(secrets).toEqual(['only-integration'])
  })

  it('sem phone_number_id no payload usa secrets de todas integrações WhatsApp', async () => {
    delete process.env.WHATSAPP_META_APP_SECRET

    const inMock = vi.fn()
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [{ meta_app_secret: 'tenant-secret' }],
                error: null,
              }),
            }),
          }),
        }),
      }),
    })

    const secrets = await resolveMetaWebhookVerificationSecrets(
      Buffer.from('{"object":"whatsapp_business_account"}')
    )

    expect(secrets).toEqual(['tenant-secret'])
    expect(inMock).not.toHaveBeenCalled()
  })
})
