export const KNOWLEDGE_ACCEPT_ATTR = '.txt,.pdf'

export const KNOWLEDGE_FORMAT_ERROR =
  'Formato não permitido. Envie apenas arquivos .txt ou .pdf.'

export function isAllowedKnowledgeUploadFile(file: File): boolean {
  const name = file.name.trim().toLowerCase()
  const mime = (file.type || 'application/octet-stream').toLowerCase()

  if (name.endsWith('.pdf')) {
    return mime === 'application/pdf' || mime === 'application/octet-stream'
  }

  if (name.endsWith('.txt')) {
    return mime === 'text/plain' || mime === 'application/octet-stream'
  }

  return false
}
