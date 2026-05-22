import { describe, expect, it } from 'vitest'
import {
  buildRuntimeIntegrationToolsSection,
  useSchedulingCoordinatorEngine,
} from '../services/agents/agent-integration-tools-prompt'
import { buildToolKey, serializeAgentExtraFeatures } from '../services/agents/agent-extra-features'

describe('agent-integration-tools-prompt', () => {
  it('injeta ferramentas ativas no prompt', () => {
    const json = serializeAgentExtraFeatures({
      version: 2,
      tools: [
        {
          toolKey: buildToolKey('calendly', 'check_availability'),
          provider: 'calendly',
          toolName: 'check_availability',
          enabled: true,
          integrationId: 'cal-1',
          config: { specialty: 'reuniao' },
        },
      ],
    })
    const features = JSON.parse(json)
    const section = buildRuntimeIntegrationToolsSection(features)
    expect(section).toMatch(/FERRAMENTAS ATIVAS/)
    expect(section).toMatch(/calendly.check_availability/)
  })

  it('motor coordinator so quando scheduling_engine=coordinator', () => {
    const templateOnly = serializeAgentExtraFeatures({
      version: 2,
      scheduling_engine: 'template',
      tools: [
        {
          toolKey: buildToolKey('calendly', 'check_availability'),
          provider: 'calendly',
          toolName: 'check_availability',
          enabled: true,
          integrationId: 'cal-1',
          config: { specialty: 'consulta' },
        },
        {
          toolKey: buildToolKey('calendly', 'book_appointment'),
          provider: 'calendly',
          toolName: 'book_appointment',
          enabled: true,
          integrationId: 'cal-1',
          config: { specialty: 'consulta' },
        },
      ],
    })
    expect(useSchedulingCoordinatorEngine(JSON.parse(templateOnly))).toBe(false)

    const coordinator = serializeAgentExtraFeatures({
      version: 2,
      scheduling_engine: 'coordinator',
      tools: [
        {
          toolKey: buildToolKey('calendly', 'check_availability'),
          provider: 'calendly',
          toolName: 'check_availability',
          enabled: true,
          integrationId: 'cal-1',
          config: { specialty: 'consulta' },
        },
        {
          toolKey: buildToolKey('calendly', 'book_appointment'),
          provider: 'calendly',
          toolName: 'book_appointment',
          enabled: true,
          integrationId: 'cal-1',
          config: { specialty: 'consulta' },
        },
      ],
    })
    expect(useSchedulingCoordinatorEngine(JSON.parse(coordinator))).toBe(true)

    const demoFlagOnly = serializeAgentExtraFeatures({
      version: 2,
      demo: 'onsmart_sonia',
      tools: [
        {
          toolKey: buildToolKey('calendly', 'check_availability'),
          provider: 'calendly',
          toolName: 'check_availability',
          enabled: true,
          integrationId: 'cal-1',
          config: { specialty: 'reuniao' },
        },
        {
          toolKey: buildToolKey('calendly', 'book_appointment'),
          provider: 'calendly',
          toolName: 'book_appointment',
          enabled: true,
          integrationId: 'cal-1',
          config: { specialty: 'reuniao' },
        },
      ],
    })
    expect(useSchedulingCoordinatorEngine(JSON.parse(demoFlagOnly))).toBe(false)
  })
})
