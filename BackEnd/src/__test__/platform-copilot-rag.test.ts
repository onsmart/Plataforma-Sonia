import { describe, expect, it } from 'vitest'
import {
  PLATFORM_COPILOT_KNOWLEDGE,
  PLATFORM_KNOWLEDGE_FORBIDDEN_PATTERNS,
} from '../content/platform-copilot/knowledge'
import { __test__ as ragTest } from '../services/copilot/platform-copilot-rag.service'

describe('platform-copilot-rag', () => {
  it('corpus não contém padrões sensíveis', () => {
    for (const chunk of PLATFORM_COPILOT_KNOWLEDGE) {
      const blob = `${chunk.title} ${chunk.text}`
      for (const pattern of PLATFORM_KNOWLEDGE_FORBIDDEN_PATTERNS) {
        expect(blob).not.toMatch(pattern)
      }
    }
  })

  it('keyword search retorna chunk sobre criar agente', () => {
    const hits = ragTest.keywordSearchPlatformKnowledge('como criar um agente', 3)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.some((h) => h.id === 'create-agent-steps' || h.id === 'agents-hub')).toBe(true)
  })

  it('keyword search retorna chunk sobre inbox', () => {
    const hits = ragTest.keywordSearchPlatformKnowledge('caixa de entrada whatsapp', 3)
    expect(hits.some((h) => h.id === 'inbox')).toBe(true)
  })

  it('cosineSimilarity retorna 1 para vetores iguais', () => {
    const v = [1, 0, 0]
    expect(ragTest.cosineSimilarity(v, v)).toBeCloseTo(1)
  })
})
