import {
  assertAllowedKnowledgeUploadFile,
  KNOWLEDGE_FORMAT_ERROR,
} from './knowledge-file-formats'

const { PDFParse } = require('pdf-parse')

export type FileTextSource = {
  buffer: Buffer
  originalName: string
  mimeType?: string | null
}

/**
 * Extrai texto de um buffer (upload ou storage) para validação e processamento.
 * Apenas .txt e .pdf são aceitos.
 */
export async function extractTextFromBuffer(source: FileTextSource): Promise<string> {
  const { buffer, originalName, mimeType } = source
  assertAllowedKnowledgeUploadFile(originalName, mimeType)

  const name = (originalName || '').toLowerCase()
  const mime = (mimeType || '').toLowerCase()

  const isPdf = mime === 'application/pdf' || name.endsWith('.pdf')
  if (isPdf) {
    const parser = new PDFParse({ data: buffer })
    try {
      const result = await parser.getText()
      return (result.text || '').trim()
    } finally {
      try {
        await parser.destroy()
      } catch {
        /* ignore */
      }
    }
  }

  if (name.endsWith('.txt')) {
    const text = buffer.toString('utf8').trim()
    if (text.length > 0) return text
    throw new Error('Arquivo TXT vazio ou sem conteúdo legível.')
  }

  throw new Error(KNOWLEDGE_FORMAT_ERROR)
}
