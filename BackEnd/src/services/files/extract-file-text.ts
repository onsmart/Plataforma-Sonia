import mammoth from 'mammoth'

const { PDFParse } = require('pdf-parse')

export type FileTextSource = {
  buffer: Buffer
  originalName: string
  mimeType?: string | null
}

/**
 * Extrai texto de um buffer (upload ou storage) para validação e processamento.
 */
export async function extractTextFromBuffer(source: FileTextSource): Promise<string> {
  const { buffer, originalName, mimeType } = source
  const name = (originalName || '').toLowerCase()
  const mime = (mimeType || '').toLowerCase()

  const isPdf = mime === 'application/pdf' || name.endsWith('.pdf')
  if (isPdf) {
    let parser: { getText: () => Promise<{ text: string }>; destroy: () => Promise<void> } | null = null
    try {
      parser = new PDFParse({ data: buffer })
      const result = await parser.getText()
      return (result.text || '').trim()
    } finally {
      if (parser) {
        try {
          await parser.destroy()
        } catch {
          /* ignore */
        }
      }
    }
  }

  const isDocx =
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  if (isDocx) {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) })
    return (result.value || '').trim()
  }

  const isTextLike =
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    name.endsWith('.csv') ||
    name.endsWith('.json')

  if (isTextLike || mime === '' || mime === 'application/octet-stream') {
    const text = buffer.toString('utf8').trim()
    if (text.length > 0) return text
  }

  throw new Error(
    'Formato não suportado para leitura de conteúdo. Use TXT, MD, CSV, JSON, PDF ou DOCX.'
  )
}
