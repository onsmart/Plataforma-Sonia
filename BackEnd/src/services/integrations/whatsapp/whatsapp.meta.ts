export interface MetaWhatsAppConfig {
  provider: 'meta'
  apiVersion: string
  accessToken: string
  phoneNumberId: string
  verifyToken?: string
  businessPhoneNumber?: string
}

export interface MetaWebhookVerificationResult {
  ok: boolean
  challenge?: string
  status: number
}

export interface MetaWebhookMessage {
  instance: string
  remoteJid: string
  messageId?: string
  messageText: string
  messageType: string
  timestamp?: string
  phoneNumberId?: string
  rawPayload: any
}

function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]
    if (value && value.trim()) {
      return value.trim()
    }
  }

  return undefined
}

export function normalizeDigits(value?: string | null): string {
  return String(value || '').replace(/\D/g, '')
}

export function buildMetaConfigFromEnv(): MetaWhatsAppConfig | null {
  const accessToken = readEnv('WHATSAPP_META_ACCESS_TOKEN', 'WHATSAPP_CLOUD_API_ACCESS_TOKEN')
  const phoneNumberId = readEnv('WHATSAPP_META_PHONE_NUMBER_ID', 'WHATSAPP_CLOUD_API_PHONE_NUMBER_ID')

  if (!accessToken || !phoneNumberId) {
    return null
  }

  return {
    provider: 'meta',
    apiVersion: readEnv('WHATSAPP_META_API_VERSION', 'WHATSAPP_CLOUD_API_VERSION') || 'v23.0',
    accessToken,
    phoneNumberId,
    verifyToken: readEnv('WHATSAPP_META_VERIFY_TOKEN', 'WHATSAPP_CLOUD_API_VERIFY_TOKEN'),
    businessPhoneNumber: normalizeDigits(
      readEnv('WHATSAPP_META_BUSINESS_NUMBER', 'WHATSAPP_CLOUD_API_BUSINESS_NUMBER')
    )
  }
}

export function isMetaWebhookPayload(payload: any): boolean {
  return payload?.object === 'whatsapp_business_account'
}

export function validateMetaWebhookVerification(
  query: Record<string, unknown>,
  expectedToken?: string
): MetaWebhookVerificationResult {
  if (!expectedToken) {
    return { ok: false, status: 500 }
  }

  const mode = String(query['hub.mode'] || '')
  const token = String(query['hub.verify_token'] || '')
  const challenge = String(query['hub.challenge'] || '')

  if (mode === 'subscribe' && token === expectedToken && challenge) {
    return {
      ok: true,
      challenge,
      status: 200
    }
  }

  return {
    ok: false,
    status: 403
  }
}

function extractMetaMessageText(message: any): { text: string; type: string } {
  if (message?.text?.body) {
    return { text: message.text.body, type: 'text' }
  }

  if (message?.image?.caption) {
    return { text: message.image.caption, type: 'image_with_caption' }
  }

  if (message?.image) {
    return { text: '[Imagem]', type: 'image' }
  }

  if (message?.video?.caption) {
    return { text: message.video.caption, type: 'video_with_caption' }
  }

  if (message?.video) {
    return { text: '[Video]', type: 'video' }
  }

  if (message?.audio) {
    return { text: '[Audio]', type: 'audio' }
  }

  if (message?.document?.filename) {
    return { text: `[Documento: ${message.document.filename}]`, type: 'document' }
  }

  if (message?.document) {
    return { text: '[Documento]', type: 'document' }
  }

  if (message?.button?.text) {
    return { text: message.button.text, type: 'button' }
  }

  if (message?.interactive?.button_reply?.title) {
    return { text: message.interactive.button_reply.title, type: 'interactive_button_reply' }
  }

  if (message?.interactive?.list_reply?.title) {
    return { text: message.interactive.list_reply.title, type: 'interactive_list_reply' }
  }

  if (message?.location) {
    return { text: '[Localizacao]', type: 'location' }
  }

  if (message?.contacts) {
    return { text: '[Contato]', type: 'contact' }
  }

  return {
    text: `[Mensagem: ${message?.type || 'desconhecido'}]`,
    type: message?.type || 'unknown'
  }
}

export function extractMetaWebhookMessages(payload: any): MetaWebhookMessage[] {
  if (!isMetaWebhookPayload(payload)) {
    return []
  }

  const messages: MetaWebhookMessage[] = []

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change?.value
      const displayPhoneNumber = normalizeDigits(value?.metadata?.display_phone_number)
      const phoneNumberId = String(value?.metadata?.phone_number_id || '').trim()
      const instance = displayPhoneNumber || phoneNumberId

      for (const message of value?.messages || []) {
        const sender = normalizeDigits(message?.from)

        if (!sender || !instance) {
          continue
        }

        const { text, type } = extractMetaMessageText(message)

        messages.push({
          instance,
          remoteJid: `${sender}@s.whatsapp.net`,
          messageId: message?.id,
          messageText: text,
          messageType: type,
          timestamp: message?.timestamp,
          phoneNumberId,
          rawPayload: payload
        })
      }
    }
  }

  return messages
}

export function formatMetaRecipient(to: string): string {
  return normalizeDigits(to)
}
