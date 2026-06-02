import { describe, it, expect } from 'vitest'
import {
  buildExtraFeaturesFromSelection,
  getDefaultToolKeysForAgentArchetype,
  parseAgentExtraFeatures,
} from '../services/agents/agent-extra-features'

describe('buildExtraFeaturesFromSelection', () => {
  it('serializa tools habilitadas com specialty Calendly', () => {
    const json = buildExtraFeaturesFromSelection({
      selectedTools: [
        {
          toolKey: 'calendly.check_availability',
          provider: 'calendly',
          toolName: 'check_availability',
          enabled: true,
          integrationId: 'int-cal',
        },
        {
          toolKey: 'calendly.book_appointment',
          provider: 'calendly',
          toolName: 'book_appointment',
          enabled: true,
          integrationId: 'int-cal',
        },
      ],
      welcomeMessage: 'Olá!',
    })

    const parsed = parseAgentExtraFeatures(json)
    expect(parsed?.tools.length).toBe(2)
    expect(parsed?.welcome_message).toBe('Olá!')
    expect(parsed?.scheduling_engine).toBe('template')
    expect(parsed?.tools[0]?.config?.specialty).toBe('reuniao_atendimento')
  })

  it('preset receptivo inclui Calendly e WhatsApp quando conectados', () => {
    const keys = getDefaultToolKeysForAgentArchetype('receptive', [
      'calendly',
      'whatsapp',
    ])
    expect(keys).toContain('calendly.check_availability')
    expect(keys).toContain('whatsapp.send_session_message')
  })
})
