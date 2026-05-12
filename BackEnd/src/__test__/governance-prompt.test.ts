import { describe, expect, it } from 'vitest'

import { injectGovernanceRules } from '../services/governance/governance-prompt'
import { FALLBACK_GOVERNANCE_FOR_PREPROCESS } from '../services/governance/governance.service'

describe('governance prompt', () => {
  it('injeta regra explícita para não fornecer código e redirecionar pedidos fora de escopo', () => {
    const prompt = injectGovernanceRules(
      'Você é um agente de atendimento.',
      FALLBACK_GOVERNANCE_FOR_PREPROCESS
    )

    expect(prompt).toContain('Não forneça código, comandos, scripts, payloads')
    expect(prompt).toContain('não pode ajudar com isso neste canal')
    expect(prompt).toContain('credenciais, tokens, webhooks secretos')
  })
})
