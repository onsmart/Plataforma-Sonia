import { describe, expect, it } from 'vitest'

import { normalizeAgentLanguageCode, buildAgentLanguageInstruction } from '../utils/agent-language'
import { buildAgentSystemPrompt } from '../services/agents/prompt-builder'

describe('agent language integration', () => {
  it('normaliza codigos legados para locales atuais', () => {
    expect(normalizeAgentLanguageCode('EN')).toBe('en-US')
    expect(normalizeAgentLanguageCode('PT')).toBe('pt-BR')
    expect(normalizeAgentLanguageCode('ru')).toBe('ru-RU')
    expect(normalizeAgentLanguageCode('spanish')).toBe('es-ES')
  })

  it('gera instrucao de idioma obrigatorio com fallback para portugues', () => {
    const instruction = buildAgentLanguageInstruction(null)

    expect(instruction).toContain('Idioma principal do agente: Português (Brasil) (pt-BR).')
    expect(instruction).toContain('Responda exclusivamente em Português (Brasil).')
    expect(instruction).toContain('Nunca diga que voce fala varios idiomas')
  })

  it('injeta politica de idioma restrita no prompt do agente', () => {
    const prompt = buildAgentSystemPrompt('Seja cordial.', 'Atue como suporte.', 'ru-RU')

    expect(prompt).toContain('Seja cordial.')
    expect(prompt).toContain('Atue como suporte.')
    expect(prompt).toContain('Русский (ru-RU)')
    expect(prompt).toContain('configurado apenas para Русский')
    expect(prompt).toContain('Nao misture idiomas')
  })
})
