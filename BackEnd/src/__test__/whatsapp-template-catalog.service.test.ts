import { describe, expect, it } from 'vitest'

import { extractWabaIdFromPhoneNumberNode } from '../services/integrations/whatsapp/whatsapp-template-catalog.service'

describe('whatsapp-template-catalog.service', () => {
  it('extrai o WABA id a partir do campo legado whatsapp_business_account', () => {
    expect(
      extractWabaIdFromPhoneNumberNode({
        whatsapp_business_account: { id: '1234567890' }
      })
    ).toBe('1234567890')
  })

  it('extrai o WABA id a partir de health_status.entities quando o campo legado nao existe', () => {
    expect(
      extractWabaIdFromPhoneNumberNode({
        health_status: {
          entities: [
            { entity_type: 'PHONE_NUMBER', id: '101' },
            { entity_type: 'WABA', id: '2134490977300786' }
          ]
        }
      })
    ).toBe('2134490977300786')
  })
})
