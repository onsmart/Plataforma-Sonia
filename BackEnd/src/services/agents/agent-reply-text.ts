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

  const embeddedJson = text.match(/\{\s*"action"\s*:\s*"(?:reply|send_whatsapp)"/i)
  if (embeddedJson && embeddedJson.index != null && embeddedJson.index > 0) {
    text = text.slice(0, embeddedJson.index).trim()
  }

  const messageField = text.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/)
  if (messageField?.[1]) {
    try {
      text = JSON.parse(`"${messageField[1]}"`) as string
    } catch {
      text = messageField[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
    }
  }

  text = text.replace(/^["']+|["']+$/g, '').replace(/\s*"\s*\}\s*$/g, '').replace(/\s*\}\s*$/g, '').trim()

  return text
}
