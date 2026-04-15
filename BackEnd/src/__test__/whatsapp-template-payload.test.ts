import { describe, expect, it } from 'vitest'
import { buildCloudApiTemplateMessageBody } from '../services/integrations/whatsapp/whatsapp-template-payload'

describe('buildCloudApiTemplateMessageBody', () => {
  it('monta corpo template sem componentes opcionais', () => {
    const body = buildCloudApiTemplateMessageBody({
      toDigits: '5511999999999',
      templateName: 'hello_world',
      languageCode: 'en_US'
    })

    expect(body.messaging_product).toBe('whatsapp')
    expect(body.type).toBe('template')
    expect((body as any).to).toBe('5511999999999')
    expect((body as any).template.name).toBe('hello_world')
    expect((body as any).template.language.code).toBe('en_US')
    expect((body as any).template.components).toBeUndefined()
  })

  it('inclui componentes quando informados', () => {
    const body = buildCloudApiTemplateMessageBody({
      toDigits: '5511888888888',
      templateName: 'order_update',
      languageCode: 'pt_BR',
      components: [{ type: 'body', parameters: [{ type: 'text', text: '123' }] }]
    })

    expect((body as any).template.components).toHaveLength(1)
  })
})
