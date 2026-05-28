export const KNOWLEDGE_ALLOWED_EXTENSIONS = ['.txt', '.pdf'] as const

export const KNOWLEDGE_FORMAT_ERROR =
  'Formato não permitido. Envie apenas arquivos .txt ou .pdf.'

export const KNOWLEDGE_ACCEPT_ATTR = '.txt,.pdf'

const TXT_MIMES = new Set(['text/plain', 'application/octet-stream'])
const PDF_MIMES = new Set(['application/pdf', 'application/octet-stream'])

function normalizeName(originalName: string): string {
  return String(originalName || '').trim().toLowerCase()
}

function normalizeMime(mimeType?: string | null): string {
  const mime = String(mimeType || '').toLowerCase().trim()
  return mime || 'application/octet-stream'
}

/**
 * Aceita somente .txt e .pdf com MIME compatível (ou octet-stream genérico do cliente).
 */
export function isAllowedKnowledgeUploadFile(
  originalName: string,
  mimeType?: string | null
): boolean {
  const name = normalizeName(originalName)
  const mime = normalizeMime(mimeType)

  if (name.endsWith('.pdf')) {
    return PDF_MIMES.has(mime)
  }

  if (name.endsWith('.txt')) {
    return TXT_MIMES.has(mime)
  }

  return false
}

export function assertAllowedKnowledgeUploadFile(
  originalName: string,
  mimeType?: string | null
): void {
  if (!isAllowedKnowledgeUploadFile(originalName, mimeType)) {
    throw new Error(KNOWLEDGE_FORMAT_ERROR)
  }
}
