import { describe, expect, it, vi, beforeEach } from 'vitest'
import { buildToolKey, serializeAgentExtraFeatures } from './agent-extra-features'
import {
  runAgentIntegrationToolFromLlm,
  sanitizeSchedulingOutboundReply,
  stripSchedulingMetaPreamble,
} from './agent-integration-tool-runner'

vi.mock('../integrations/toolkit/toolkit.service', () => ({
  executeIntegrationTool: vi.fn(),
}))

import { executeIntegrationTool } from '../integrations/toolkit/toolkit.service'

const calendlyId = 'e81f647d-d2b6-45b7-94bb-40701255c9b1'

function extraWithCalendlyTools() {
  return serializeAgentExtraFeatures({
    version: 2,
    scheduling_engine: 'template',
    tools: [
      {
        toolKey: buildToolKey('calendly', 'check_availability'),
        provider: 'calendly',
        toolName: 'check_availability',
        enabled: true,
        integrationId: calendlyId,
        config: { specialty: 'reuniao_diagnostico' },
      },
    ],
  })
}

describe('runAgentIntegrationToolFromLlm', () => {
  beforeEach(() => {
    vi.mocked(executeIntegrationTool).mockReset()
  })

  it('rejeita ferramenta nao habilitada no agente', async () => {
    const result = await runAgentIntegrationToolFromLlm({
      agentExtraFeatures: extraWithCalendlyTools(),
      toolKey: 'calendly.book_appointment',
      toolPayload: '{}',
    })
    expect(result.ok).toBe(false)
    expect(result.reply).toMatch(/não está ativa/i)
  })

  it('executa check_availability e formata slots', async () => {
    vi.mocked(executeIntegrationTool).mockResolvedValue({
      success: true,
      provider: 'calendly',
      toolName: 'check_availability',
      status: 'success',
      userSafeMessage: 'ok',
      data: {
        slots: [{ slotId: 's1', startsAt: '2026-05-26T14:00:00.000Z' }],
      },
    })

    const result = await runAgentIntegrationToolFromLlm({
      agentExtraFeatures: extraWithCalendlyTools(),
      toolKey: 'calendly.check_availability',
      toolPayload: JSON.stringify({ preferredDate: '2026-05-26' }),
      userMessage: 'Verificando horarios...',
    })

    expect(result.ok).toBe(true)
    expect(executeIntegrationTool).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'calendly',
        toolName: 'check_availability',
        payload: expect.objectContaining({
          integrationId: calendlyId,
          specialty: 'reuniao_diagnostico',
        }),
      })
    )
    expect(result.reply).toMatch(/disponível|Horários disponíveis/i)
    expect(result.reply).not.toMatch(/Verificando/i)
  })

  it('nao repassa preamble do LLM em ferramentas Calendly', async () => {
    vi.mocked(executeIntegrationTool).mockResolvedValue({
      success: true,
      provider: 'calendly',
      toolName: 'check_availability',
      status: 'success',
      userSafeMessage: 'ok',
      data: { slots: [] },
    })

    const result = await runAgentIntegrationToolFromLlm({
      agentExtraFeatures: extraWithCalendlyTools(),
      toolKey: 'calendly.check_availability',
      toolPayload: JSON.stringify({ preferredDate: '2026-05-26' }),
      userMessage:
        'Por favor, aguarde pois vou verificar quais são os horários livres para você.',
    })

    expect(result.reply).not.toMatch(/aguarde/i)
    expect(result.reply).not.toMatch(/verificar/i)
  })
})

describe('stripSchedulingMetaPreamble', () => {
  it('remove frase de espera ao consultar horarios', () => {
    const out = stripSchedulingMetaPreamble(
      'Por favor, aguarde pois vou verificar quais são os horários livres.'
    )
    expect(out).toBe('')
  })
})

describe('sanitizeSchedulingOutboundReply', () => {
  it('remove verificar disponibilidade e horario comercial e pede dia/horario', () => {
    const out = sanitizeSchedulingOutboundReply(
      'Obrigado, Mateus! Vou verificar a disponibilidade para agendar a sua consulta. Nossos horários são de segunda a sexta, das 9h às 18h. Um momento, por favor.'
    )
    expect(out).not.toMatch(/verificar/i)
    expect(out).not.toMatch(/9h/i)
    expect(out).toMatch(/dia e horário|nome completo/i)
  })

  it('substitui "estou verificando" na saudacao por resposta neutra', () => {
    const out = sanitizeSchedulingOutboundReply(
      'Oi, Mateus! Estou verificando a disponibilidade para a sua consulta. Um momento, por favor.'
    )
    expect(out).not.toMatch(/verificando/i)
    expect(out).not.toMatch(/um momento/i)
    expect(out).toMatch(/Como posso ajudar/i)
  })

  it('check_availability com horario exato pede nome e e-mail em vez de lista generica', async () => {
    vi.mocked(executeIntegrationTool).mockResolvedValue({
      success: true,
      provider: 'calendly',
      toolName: 'check_availability',
      status: 'success',
      userSafeMessage: 'ok',
      data: {
        slots: [
          {
            slotId: 'slot-26-14',
            startsAt: '2026-05-26T17:00:00.000Z',
          },
        ],
      },
    })

    const result = await runAgentIntegrationToolFromLlm({
      agentExtraFeatures: extraWithCalendlyTools(),
      toolKey: 'calendly.check_availability',
      toolPayload: JSON.stringify({
        preferredDate: '2026-05-26',
        preferredTime: '14:00',
      }),
      agentId: 'agent-1',
      contactId: 'contact-1',
    })

    expect(result.ok).toBe(true)
    expect(result.reply).toMatch(/disponível/i)
    expect(result.reply).toMatch(/nome completo/i)
    expect(result.reply).not.toMatch(/Peça ao contato para escolher o \*número\*/i)
  })

  it('substitui "confirmando agendamento" sem ferramenta por pedido de nome e e-mail', () => {
    const out = sanitizeSchedulingOutboundReply(
      'Confirmando o agendamento da sua consulta para o dia **26/05/2026** às **14:00**. Um momento, por favor, enquanto finalizo a reserva.'
    )
    expect(out).not.toMatch(/confirmando/i)
    expect(out).not.toMatch(/um momento/i)
    expect(out).toMatch(/nome completo/i)
    expect(out).toMatch(/e-mail/i)
  })
})
