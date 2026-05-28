import { describe, expect, it } from 'vitest'
import {
  assertAllowedKnowledgeUploadFile,
  isAllowedKnowledgeUploadFile,
  KNOWLEDGE_FORMAT_ERROR,
} from '../services/files/knowledge-file-formats'

describe('knowledge-file-formats', () => {
  it('aceita .txt e .pdf com MIME compatível', () => {
    expect(isAllowedKnowledgeUploadFile('doc.txt', 'text/plain')).toBe(true)
    expect(isAllowedKnowledgeUploadFile('doc.txt', 'application/octet-stream')).toBe(true)
    expect(isAllowedKnowledgeUploadFile('doc.pdf', 'application/pdf')).toBe(true)
    expect(isAllowedKnowledgeUploadFile('doc.pdf', 'application/octet-stream')).toBe(true)
  })

  it('rejeita outros formatos e MIME incompatível', () => {
    expect(isAllowedKnowledgeUploadFile('doc.md', 'text/markdown')).toBe(false)
    expect(isAllowedKnowledgeUploadFile('doc.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(false)
    expect(isAllowedKnowledgeUploadFile('doc.pdf', 'text/plain')).toBe(false)
    expect(isAllowedKnowledgeUploadFile('doc.txt', 'application/pdf')).toBe(false)
    expect(isAllowedKnowledgeUploadFile('script.js', 'application/javascript')).toBe(false)
  })

  it('assertAllowedKnowledgeUploadFile lança erro padronizado', () => {
    expect(() => assertAllowedKnowledgeUploadFile('evil.exe', 'application/octet-stream')).toThrow(
      KNOWLEDGE_FORMAT_ERROR
    )
  })
})
