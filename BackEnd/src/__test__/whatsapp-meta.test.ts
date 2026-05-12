import { describe, expect, it } from 'vitest'
import {
  extractMetaWebhookCalls,
  extractMetaWebhookMessages,
  validateMetaWebhookVerification
} from '../services/integrations/whatsapp/whatsapp.meta'

const META_TEST_BUSINESS_NUMBER = '0000000000'

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

  it('deve rejeitar o handshake com token invalido', () => {
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
                  display_phone_number: '+00 0000-0000',
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
    expect(messages[0].instance).toBe(META_TEST_BUSINESS_NUMBER)
    expect(messages[0].remoteJid).toBe('5511999999999@s.whatsapp.net')
    expect(messages[0].messageText).toBe('Teste oficial Meta')
    expect(messages[0].phoneNumberId).toBe('1234567890')
    expect(messages[0].nativeMessageType).toBe('text')
  })

  it('deve extrair chamadas recebidas com SDP do payload oficial da Meta', () => {
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
                  display_phone_number: '+55 11 4002-8922',
                  phone_number_id: 'phone-number-id-1'
                },
                calls: [
                  {
                    id: 'wacid.call-1',
                    from: '5511999999999',
                    event: 'connect',
                    timestamp: '1710000000',
                    session: {
                      sdp_type: 'offer',
                      sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111'
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    }

    const calls = extractMetaWebhookCalls(payload)

    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual(
      expect.objectContaining({
        callId: 'wacid.call-1',
        from: '5511999999999',
        event: 'connect',
        instance: '551140028922',
        phoneNumberId: 'phone-number-id-1',
        sdpOffer: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111'
      })
    )
  })
})
