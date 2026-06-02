import { describe, expect, it } from 'vitest'
import { extractMetaWebhookPhoneNumberIds } from '../utils/meta-webhook-payload'

describe('extractMetaWebhookPhoneNumberIds', () => {
  it('extrai phone_number_id de payload Meta padrão', () => {
    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '123',
          changes: [
            {
              value: {
                metadata: {
                  phone_number_id: '1127315700467094',
                  display_phone_number: '15558991881',
                },
              },
            },
          ],
        },
      ],
    })

    expect(extractMetaWebhookPhoneNumberIds(Buffer.from(payload))).toEqual(['1127315700467094'])
  })

  it('retorna vazio para JSON inválido ou sem metadata', () => {
    expect(extractMetaWebhookPhoneNumberIds(Buffer.from('not-json'))).toEqual([])
    expect(extractMetaWebhookPhoneNumberIds(Buffer.from('{"object":"whatsapp_business_account"}'))).toEqual([])
  })

  it('encontra phone_number_id em estruturas aninhadas fora de metadata', () => {
    const payload = JSON.stringify({
      entry: [{ changes: [{ value: { phone_number_id: '555001' } }] }],
    })
    expect(extractMetaWebhookPhoneNumberIds(payload)).toEqual(['555001'])
  })

  it('deduplica múltiplos changes com o mesmo phone_number_id', () => {
    const payload = JSON.stringify({
      entry: [
        {
          changes: [
            { value: { metadata: { phone_number_id: '999' } } },
            { value: { metadata: { phone_number_id: '999' } } },
          ],
        },
      ],
    })

    expect(extractMetaWebhookPhoneNumberIds(payload)).toEqual(['999'])
  })
})
