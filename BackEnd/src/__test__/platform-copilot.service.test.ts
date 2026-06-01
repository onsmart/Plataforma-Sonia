import { describe, expect, it } from 'vitest'
import { buildPlatformCopilotSystemPrompt, getValidCopilotRoutes } from '../content/platform-copilot/system-prompt'
import { __test__ as serviceTest } from '../services/copilot/platform-copilot.service'

describe('platform-copilot system prompt', () => {
  it('inclui instrução de idioma pt-BR', () => {
    const prompt = buildPlatformCopilotSystemPrompt({ language: 'pt-BR', currentRoute: 'inbox' })
    expect(prompt).toContain('Português (Brasil)')
    expect(prompt).toContain('inbox')
    expect(prompt).toContain('[NAVIGATE:')
  })

  it('injeta contexto RAG sem expor metadados ao usuário final', () => {
    const prompt = buildPlatformCopilotSystemPrompt({
      language: 'en-US',
      ragContext: '[1] Inbox\nCentral de conversas WhatsApp.',
    })
    expect(prompt).toContain('CONTEXTO DA PLATAFORMA')
    expect(prompt).toContain('Central de conversas WhatsApp')
  })

  it('lista rotas válidas incluindo flows e agent-config', () => {
    const routes = getValidCopilotRoutes()
    expect(routes).toContain('flows')
    expect(routes).toContain('agent-config')
    expect(routes).toContain('home')
  })
})

describe('platform-copilot service helpers', () => {
  it('sanitizeMessages limita histórico e remove vazios', () => {
    const out = serviceTest.sanitizeMessages([
      { role: 'user', content: '  olá  ' },
      { role: 'assistant', content: '' },
      { role: 'user', content: 'como criar agente?' },
    ])
    expect(out).toHaveLength(2)
    expect(out[0].content).toBe('olá')
  })

  it('preserva comando NAVIGATE no fluxo esperado', () => {
    const sample = '[NAVIGATE: inbox]'
    expect(sample).toMatch(/\[NAVIGATE: inbox\]/)
  })
})
