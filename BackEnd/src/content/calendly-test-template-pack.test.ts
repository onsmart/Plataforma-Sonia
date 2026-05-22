import { describe, expect, it } from 'vitest'
import {
  CALENDLY_TEST_PERSONALITY_PROMPT,
  CALENDLY_TEST_TEMPLATE_DESCRIPTION,
  CALENDLY_TEST_TEMPLATE_ROLE,
  getCalendlyTestTemplatePack,
} from './calendly-test-template-pack'

describe('calendly-test-template-pack', () => {
  it('template.role nao contem bloco de personalidade/tom', () => {
    expect(CALENDLY_TEST_TEMPLATE_ROLE).toMatch(/ESCOPO DE CONHECIMENTO/i)
    expect(CALENDLY_TEST_TEMPLATE_ROLE).toMatch(/integration_tool/i)
    expect(CALENDLY_TEST_TEMPLATE_ROLE).not.toMatch(/IDENTIDADE E TOM/i)
    expect(CALENDLY_TEST_TEMPLATE_ROLE).not.toMatch(/acolhedora, consultiva/i)
  })

  it('personality e tom apenas, sem playbook Calendly', () => {
    expect(CALENDLY_TEST_PERSONALITY_PROMPT).toMatch(/Sonia/i)
    expect(CALENDLY_TEST_PERSONALITY_PROMPT).not.toMatch(/calendly\.check_availability/i)
    expect(CALENDLY_TEST_PERSONALITY_PROMPT).not.toMatch(/FLUXO AGENDAR/i)
  })

  it('pack expoe uiMapping e secoes template/agent separadas', () => {
    const pack = getCalendlyTestTemplatePack('e81f647d-d2b6-45b7-94bb-40701255c9b1')
    expect(pack.template.name).toBeTruthy()
    expect(pack.template.role).toBe(CALENDLY_TEST_TEMPLATE_ROLE)
    expect(pack.template.description).toBe(CALENDLY_TEST_TEMPLATE_DESCRIPTION)
    expect(pack.agent.personality_prompt).toBe(CALENDLY_TEST_PERSONALITY_PROMPT)
    expect(pack.agent.extra_features_json).toContain('scheduling_engine')
    expect(pack.uiMapping.createTemplateDialog).toBeDefined()
    expect(pack.uiMapping.createAgentDialog.personalityTextarea).toBeTruthy()
  })
})
