import { describe, expect, it } from 'vitest'
import { validateKnowledgeFileContent } from '../services/files/validate-knowledge-file.service'
import { readFileSync } from 'fs'
import { join } from 'path'

const fixturesDir = join(__dirname, '../../test-fixtures/knowledge')

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf8')
}

describe('validateKnowledgeFileContent', () => {
  it('aceita RAG válido (Plano Aurora)', () => {
    const text = readFixture('rag-teste-plano-aurora.md')
    const result = validateKnowledgeFileContent(text, 'rag')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejeita RAG genérico', () => {
    const text = readFixture('rag-teste-invalido-generico.md')
    const result = validateKnowledgeFileContent(text, 'rag')
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('aceita Skill válida', () => {
    const text = readFixture('skill-teste-validacao-comportamento.md')
    const result = validateKnowledgeFileContent(text, 'skills')
    expect(result.valid).toBe(true)
  })

  it('rejeita Skill sem regras', () => {
    const text = readFixture('skill-teste-invalida-sem-regras.md')
    const result = validateKnowledgeFileContent(text, 'skills')
    expect(result.valid).toBe(false)
    expect(result.criteria.some((c) => c.id === 'has_rules' && !c.passed)).toBe(true)
  })

  it('rejeita texto vazio', () => {
    const result = validateKnowledgeFileContent('   ', 'rag')
    expect(result.valid).toBe(false)
    expect(result.criteria.find((c) => c.id === 'not_empty')?.passed).toBe(false)
  })

  it('rejeita RAG com prompt injection', () => {
    const text = readFixture('rag-teste-seguranca-injection.md')
    const result = validateKnowledgeFileContent(text, 'rag')
    expect(result.valid).toBe(false)
    expect(result.securityFindings?.length).toBeGreaterThan(0)
  })

  it('rejeita RAG com dados sensíveis', () => {
    const text = readFixture('rag-teste-seguranca-dados-sensiveis.md')
    const result = validateKnowledgeFileContent(text, 'rag')
    expect(result.valid).toBe(false)
    expect(result.securityFindings?.some((f) => f.category === 'sensitive_data')).toBe(true)
  })

  it('rejeita Skill maliciosa', () => {
    const text = readFixture('skill-teste-seguranca-maliciosa.md')
    const result = validateKnowledgeFileContent(text, 'skills')
    expect(result.valid).toBe(false)
    expect(result.securityFindings?.some((f) => f.category === 'malicious_instruction')).toBe(true)
  })
})
