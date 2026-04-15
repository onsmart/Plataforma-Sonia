/**
 * Montagem do corpo JSON para POST /{phone-number-id}/messages com type "template".
 * Referência: documentação oficial da Meta (WhatsApp Cloud API — template messages).
 */

export type TemplateComponent = Record<string, unknown>

export function buildCloudApiTemplateMessageBody(params: {
  /** E164 / dígitos — já normalizado pelo caller */
  toDigits: string
  templateName: string
  languageCode: string
  components?: TemplateComponent[]
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: params.toDigits,
    type: 'template',
    template: {
      name: params.templateName,
      language: { code: params.languageCode }
    }
  }

  if (params.components && params.components.length > 0) {
    ;(body.template as Record<string, unknown>).components = params.components
  }

  return body
}
