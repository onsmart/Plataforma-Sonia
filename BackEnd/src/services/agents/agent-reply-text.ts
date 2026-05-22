/** Extrai texto legível quando o LLM devolve JSON de ação (reply / send_whatsapp). */
export function unwrapAgentReplyText(raw: unknown): string {
  let text = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim()
  if (!text) return ''

  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>
      const message = parsed.message
      if (typeof message === 'string' && message.trim()) {
        return unwrapAgentReplyText(message)
      }
      if (parsed.action === 'reply' && typeof message === 'string') {
        return message.trim()
      }
    } catch {
      // mantém texto original
    }
  }

  return text
}
