const TITLE_MIN = 3
const TITLE_MAX = 120

export type KnowledgeTitleValidation = {
  valid: boolean
  title?: string
  error?: string
}

export function validateKnowledgeTitle(raw: unknown): KnowledgeTitleValidation {
  const title = String(raw ?? '').trim().replace(/\s+/g, ' ')
  if (title.length < TITLE_MIN) {
    return { valid: false, error: `O título deve ter pelo menos ${TITLE_MIN} caracteres.` }
  }
  if (title.length > TITLE_MAX) {
    return { valid: false, error: `O título deve ter no máximo ${TITLE_MAX} caracteres.` }
  }
  if (/[\x00-\x1f\x7f]/.test(title)) {
    return { valid: false, error: 'O título contém caracteres inválidos.' }
  }
  return { valid: true, title }
}

export function sanitizeKnowledgeStorageName(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80)
  return base || 'conhecimento'
}
