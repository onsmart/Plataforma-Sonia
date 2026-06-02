import { describe, expect, it, vi, beforeEach } from 'vitest'
import { buildToolKey, serializeAgentExtraFeatures } from './agent-extra-features'
import {
  runAgentIntegrationToolFromLlm,
  sanitizeSchedulingOutboundReply,
  stripSchedulingMetaPreamble,
  finalizeIntegrationToolReplyForChannel,
  filterWhatsAppOutboundForEndUser,
  containsWhatsAppTechnicalLeak,
} from './agent-integration-tool-runner'

vi.mock('../integrations/toolkit/toolkit.service', () => ({
  executeIntegrationTool: vi.fn(),
}))

vi.mock('../../lib/redis', () => ({
  getRedisClient: vi.fn(),
}))

vi.mock('../system-logs', () => ({
  saveSystemLog: vi.fn().mockResolvedValue({ success: true, id: 'log-1' }),
}))

import { getRedisClient } from '../../lib/redis'
import { executeIntegrationTool } from '../integrations/toolkit/toolkit.service'
import { saveSystemLog } from '../system-logs'

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

function extraWithCalendlyCheckAndBook() {
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
      {
        toolKey: buildToolKey('calendly', 'book_appointment'),
        provider: 'calendly',
        toolName: 'book_appointment',
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
        slots: [{ slotId: 's1', startsAt: '2026-06-03T14:00:00.000Z' }],
      },
    })

    const result = await runAgentIntegrationToolFromLlm({
      agentExtraFeatures: extraWithCalendlyTools(),
      toolKey: 'calendly.check_availability',
      toolPayload: JSON.stringify({ preferredDate: '2026-06-03' }),
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
      toolPayload: JSON.stringify({ preferredDate: '2026-06-03' }),
      userMessage:
        'Por favor, aguarde pois vou verificar quais são os horários livres para você.',
    })

    expect(result.reply).not.toMatch(/aguarde/i)
    expect(result.reply).not.toMatch(/verificar/i)
  })

  it('promove check_availability para book quando ha slot pendente e cliente envia nome/e-mail', async () => {
    vi.mocked(getRedisClient).mockResolvedValue({
      get: vi.fn().mockResolvedValue(
        JSON.stringify({
          slotId: 'slot-pending',
          integrationId: calendlyId,
          startsAt: '2026-06-03T16:00:00.000Z',
        })
      ),
      setEx: vi.fn(),
      del: vi.fn(),
    } as any)

    vi.mocked(executeIntegrationTool).mockResolvedValue({
      success: true,
      provider: 'calendly',
      toolName: 'book_appointment',
      status: 'success',
      userSafeMessage: 'ok',
      data: {
        appointment: {
          appointmentId: 'appt-1',
          slot: { startsAt: '2026-06-03T16:00:00.000Z' },
        },
      },
    })

    const result = await runAgentIntegrationToolFromLlm({
      agentExtraFeatures: extraWithCalendlyCheckAndBook(),
      toolKey: 'calendly.check_availability',
      toolPayload: JSON.stringify({ preferredDate: '2026-06-03', preferredTime: '13:00' }),
      channelUserMessage: 'Mateus Mantovani\nmateus.mantovani@onsmart.com.br',
      agentId: 'agent-1',
      contactId: 'contact-1',
    })

    expect(executeIntegrationTool).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'calendly',
        toolName: 'book_appointment',
        payload: expect.objectContaining({
          slotId: 'slot-pending',
          patientName: 'Mateus Mantovani',
          patientEmail: 'mateus.mantovani@onsmart.com.br',
        }),
      })
    )
    expect(result.ok).toBe(true)
    expect(result.reply).toMatch(/confirmada/i)
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
            startsAt: '2026-06-03T17:00:00.000Z',
          },
        ],
      },
    })

    const result = await runAgentIntegrationToolFromLlm({
      agentExtraFeatures: extraWithCalendlyTools(),
      toolKey: 'calendly.check_availability',
      toolPayload: JSON.stringify({
        preferredDate: '2026-06-03',
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

describe('whatsapp outbound error filtering', () => {
  beforeEach(() => {
    vi.mocked(saveSystemLog).mockClear()
  })

  it('detecta vazamento tecnico do Calendly', () => {
    expect(containsWhatsAppTechnicalLeak('start_time must be in the future')).toBe(true)
    expect(containsWhatsAppTechnicalLeak('Qual *dia e horário* você prefere?')).toBe(false)
  })

  it('substitui erro tecnico por mensagem neutra no WhatsApp', () => {
    const out = finalizeIntegrationToolReplyForChannel({
      channel: 'whatsapp',
      ok: false,
      reply: 'start_time must be in the future',
      toolKey: 'calendly.check_availability',
      userEmail: 'ops@test.com',
      agentId: 'agent-1',
      contactId: '5511999999999',
    })
    expect(out).toMatch(/dia e horário/i)
    expect(out).not.toMatch(/start_time/i)
  })

  it('mantem prompts conversacionais no WhatsApp', () => {
    const prompt =
      'Para confirmar no Calendly, preciso do seu *nome completo* e do *e-mail* usados na reserva.'
    const out = finalizeIntegrationToolReplyForChannel({
      channel: 'whatsapp',
      ok: false,
      reply: prompt,
      toolKey: 'calendly.book_appointment',
      conversational: true,
    })
    expect(out).toBe(prompt)
  })

  it('filtra respostas com emoji de erro antes do envio', () => {
    const out = filterWhatsAppOutboundForEndUser('❌ Erro ao enviar WhatsApp: timeout', {
      userEmail: 'ops@test.com',
      agentId: 'agent-1',
      contactId: '5511999999999',
      toolKey: 'calendly.book_appointment',
    })
    expect(out).toMatch(/dia e horário/i)
    expect(out).not.toMatch(/❌/)
  })

  it('registra falha de integracao na plataforma para WhatsApp', async () => {
    finalizeIntegrationToolReplyForChannel({
      channel: 'whatsapp',
      ok: false,
      reply: 'Erro ao executar calendly.check_availability: API down',
      toolKey: 'calendly.check_availability',
      userEmail: 'ops@test.com',
      agentId: 'agent-1',
      contactId: '5511999999999',
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(saveSystemLog).toHaveBeenCalledWith(
      expect.objectContaining({
        log_type: 'integration_tool_failed',
        user_email: 'ops@test.com',
        agent_id: 'agent-1',
      })
    )
  })
})
