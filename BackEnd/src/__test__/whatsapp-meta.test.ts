import { describe, expect, it } from 'vitest'
import {
  buildPseudoEvolutionWebhookFromMeta,
  extractMetaWebhookMessages,
  validateMetaWebhookVerification
} from '../services/integrations/whatsapp/whatsapp.meta'

describe('WhatsApp Meta helpers', () => {
  it('deve validar o handshake do webhook da Meta', () => {
    const result = validateMetaWebhookVerification(
      {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'token-ok',
        'hub.challenge': '12345'
      },
      'token-ok'
    )

    expect(result.ok).toBe(true)
    expect(result.challenge).toBe('12345')
    expect(result.status).toBe(200)
  })

  it('deve rejeitar o handshake com token invÃ¡lido', () => {
    const result = validateMetaWebhookVerification(
      {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'token-ruim',
        'hub.challenge': '12345'
      },
      'token-ok'
    )

    expect(result.ok).toBe(false)
    expect(result.status).toBe(403)
  })

  it('deve extrair mensagens do payload oficial da Meta', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '+1 555-899-1881',
                  phone_number_id: '1234567890'
                },
                messages: [
                  {
                    from: '5511999999999',
                    id: 'wamid.abc',
                    timestamp: '1710000000',
                    type: 'text',
                    text: {
                      body: 'Teste oficial Meta'
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    }

    const messages = extractMetaWebhookMessages(payload)

    expect(messages).toHaveLength(1)
    expect(messages[0].instance).toBe('15558991881')
    expect(messages[0].remoteJid).toBe('5511999999999@s.whatsapp.net')
    expect(messages[0].messageText).toBe('Teste oficial Meta')
    expect(messages[0].phoneNumberId).toBe('1234567890')
  })

  it('deve transformar o payload da Meta em um formato compatÃ­vel com o fluxo atual', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: {
                  display_phone_number: '+1 555-899-1881',
                  phone_number_id: '1234567890'
                },
                messages: [
                  {
                    from: '5511999999999',
                    id: 'wamid.xyz',
                    type: 'text',
                    text: {
                      body: 'Oi Sonia'
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    }

    const transformed = buildPseudoEvolutionWebhookFromMeta(payload)

    expect(transformed?.event).toBe('messages.upsert')
    expect(transformed?.instance).toBe('15558991881')
    expect(transformed?.meta?.provider).toBe('meta')
    expect(transformed?.data?.key?.remoteJid).toBe('5511999999999@s.whatsapp.net')
    expect(transformed?.data?.message?.conversation).toBe('Oi Sonia')
  })
})
