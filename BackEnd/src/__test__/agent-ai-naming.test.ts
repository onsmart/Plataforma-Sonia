import { describe, it, expect } from 'vitest'
import {
  buildAgentAiDisplayName,
  buildAgentAiTemplateName,
} from '../services/agents/agent-ai-generation.shared'

describe('agent AI naming', () => {
  it('usa só o nome informado pelo usuário no agente', () => {
    expect(buildAgentAiDisplayName('Molezinha', 'Assistente GPT')).toBe('Molezinha')
  })

  it('template segue Agente - {nome} - {tipo}', () => {
    expect(buildAgentAiTemplateName('Molezinha', 'receptive')).toBe('Agente - Molezinha - Receptivo')
    expect(buildAgentAiTemplateName('Loja X', 'faq')).toBe('Agente - Loja X - FAQ')
  })
})
