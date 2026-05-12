import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FlowExecutionContext } from '../services/flows/flow.types'

const { executeFlowMock, sendWhatsAppMock } = vi.hoisted(() => ({
  executeFlowMock: vi.fn(),
  sendWhatsAppMock: vi.fn()
}))

const { scheduleFlowStartMock, buildPausedExecutionContextMock } = vi.hoisted(() => ({
  scheduleFlowStartMock: vi.fn(),
  buildPausedExecutionContextMock: vi.fn()
}))

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock('../services/flows/flow.service', () => ({
  FlowService: {
    executeFlow: executeFlowMock
  }
}))

vi.mock('../services/flows/flow-scheduler.service', () => ({
  scheduleFlowStart: scheduleFlowStartMock,
  buildPausedExecutionContext: buildPausedExecutionContextMock
}))

vi.mock('../services/integrations/whatsapp/whatsapp.dispatcher', () => ({
  sendWhatsApp: sendWhatsAppMock
}))

import { executeFlowForChannel, extractFlowOutboundMessage } from '../services/flows/flow-channel-runtime'

function buildContext(overrides?: Partial<FlowExecutionContext>): FlowExecutionContext {
  return {
    flowId: 'flow-1',
    userId: 'user-1',
    userEmail: 'user@example.com',
    data: {},
    executionHistory: [],
    ...overrides
  }
}

describe('Flow channel runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve extrair a ultima mensagem util do historico do flow', () => {
    const context = buildContext({
      executionHistory: [
        { nodeId: 'node-1', success: true, output: { started: true } },
        { nodeId: 'node-2', success: true, output: '{"intent":"agendamento"}' },
        { nodeId: 'node-3', success: true, output: { action: 'reply', message: 'Posso ajudar com seu agendamento.' } },
        { nodeId: 'node-4', success: true, output: { stopped: true } }
      ]
    })

    expect(extractFlowOutboundMessage(context)).toBe('Posso ajudar com seu agendamento.')
  })

  it('deve extrair a resposta quando o node final devolver JSON com campo response', () => {
    const context = buildContext({
      executionHistory: [
        {
          nodeId: 'node-9',
          success: true,
          output: '{"response":"Oi! Claro, posso ajudar com o agendamento."}'
        }
      ]
    })

    expect(extractFlowOutboundMessage(context)).toBe('Oi! Claro, posso ajudar com o agendamento.')
  })

  it('deve executar o flow sem entrega quando o canal for none', async () => {
    const context = buildContext({
      executionHistory: [
        { nodeId: 'node-1', success: true, output: { action: 'reply', message: 'Resposta de teste' } }
      ]
    })
    executeFlowMock.mockResolvedValue(context)

    const result = await executeFlowForChannel({
      flowId: 'flow-1',
      userEmail: 'user@example.com',
      initialData: { message: 'Oi' },
      deliveryChannel: 'none'
    })

    expect(executeFlowMock).toHaveBeenCalledWith(
      'flow-1',
      'user@example.com',
      expect.objectContaining({
        message: 'Oi',
        disable_channel_delivery: false,
        __flow_execution_mode: 'test'
      }),
      {
        executionMode: 'test'
      }
    )
    expect(result.outboundMessage).toBe('Resposta de teste')
    expect(result.delivery).toEqual({
      attempted: false,
      success: true
    })
    expect(sendWhatsAppMock).not.toHaveBeenCalled()
  })

  it('deve entregar a resposta final no WhatsApp quando houver mensagem enviavel', async () => {
    const context = buildContext({
      executionHistory: [
        { nodeId: 'node-1', success: true, output: { action: 'reply', message: 'Resposta final do flow' } }
      ]
    })
    executeFlowMock.mockResolvedValue(context)
    sendWhatsAppMock.mockResolvedValue({ success: true, queued: false })

    const result = await executeFlowForChannel({
      flowId: 'flow-1',
      userEmail: 'user@example.com',
      deliveryChannel: 'whatsapp',
      integrationsId: 'integration-1',
      recipientId: 'contact-1',
      agentId: 'agent-1',
      requestStartedAt: '2026-04-06T10:00:00.000Z'
    })

    expect(sendWhatsAppMock).toHaveBeenCalledWith(
      'integration-1',
      expect.objectContaining({
        to: 'contact-1',
        message: 'Resposta final do flow',
        agentId: 'agent-1'
      })
    )
    expect(result.delivery.success).toBe(true)
    expect(result.outboundMessage).toBe('Resposta final do flow')
  })

  it('nao deve enviar texto livre quando o fluxo ja marcou template Meta enviado', async () => {
    const context = buildContext({
      data: { __flow_meta_outbound_already_sent: true },
      executionHistory: [
        { nodeId: 'node-1', success: true, output: { kind: 'wa_template', waMetaTemplateSent: true } },
        { nodeId: 'node-2', success: true, output: { action: 'reply', message: 'Nao deve ir pro WhatsApp texto' } }
      ]
    })
    executeFlowMock.mockResolvedValue(context)

    const result = await executeFlowForChannel({
      flowId: 'flow-1',
      userEmail: 'user@example.com',
      deliveryChannel: 'whatsapp',
      integrationsId: 'integration-1',
      recipientId: 'contact-1',
      agentId: 'agent-1'
    })

    expect(sendWhatsAppMock).not.toHaveBeenCalled()
    expect(result.delivery.success).toBe(true)
    expect(result.delivery.attempted).toBe(true)
  })

  it('nao deve duplicar entrega quando o novo bloco ja enviou mensagem dentro do executor', async () => {
    const context = buildContext({
      data: { __flow_whatsapp_outbound_already_sent: true },
      executionHistory: [
        {
          nodeId: 'node-1',
          success: true,
          output: { kind: 'whatsapp_message', sendMode: 'normal', messageText: 'Oi' }
        }
      ]
    })
    executeFlowMock.mockResolvedValue(context)

    const result = await executeFlowForChannel({
      flowId: 'flow-1',
      userEmail: 'user@example.com',
      deliveryChannel: 'whatsapp',
      integrationsId: 'integration-1',
      recipientId: 'contact-1'
    })

    expect(sendWhatsAppMock).not.toHaveBeenCalled()
    expect(result.delivery.success).toBe(true)
    expect(result.delivery.attempted).toBe(true)
  })

  it('deve agendar o inicio do fluxo em modo live sem executar imediatamente', async () => {
    const pausedContext = buildContext({
      executionId: 'exec-scheduled',
      data: {
        __flow_execution_mode: 'live',
        __flow_paused_for_schedule: true,
        __flow_paused_until: '2026-05-13T12:00:00.000Z',
        __flow_pause_timezone: 'America/Sao_Paulo'
      }
    })

    scheduleFlowStartMock.mockResolvedValue({
      jobId: 'job-1',
      executionId: 'exec-scheduled',
      scheduledAtIso: '2026-05-13T12:00:00.000Z',
      timezone: 'America/Sao_Paulo',
      userId: 'user-1',
      companiesId: 'company-1'
    })
    buildPausedExecutionContextMock.mockReturnValue(pausedContext)

    const result = await executeFlowForChannel({
      flowId: 'flow-1',
      userEmail: 'user@example.com',
      initialData: { message: 'Oi' },
      executionMode: 'live',
      scheduledStartAt: '2026-05-13T09:00',
      deliveryChannel: 'whatsapp',
      integrationsId: 'integration-1',
      recipientId: 'contact-1'
    })

    expect(scheduleFlowStartMock).toHaveBeenCalledWith({
      flowId: 'flow-1',
      userEmail: 'user@example.com',
      initialData: expect.objectContaining({
        message: 'Oi',
        disable_channel_delivery: true,
        __flow_execution_mode: 'live'
      }),
      scheduledStartAt: '2026-05-13T09:00',
      executionMode: 'live'
    })
    expect(executeFlowMock).not.toHaveBeenCalled()
    expect(sendWhatsAppMock).not.toHaveBeenCalled()
    expect(result.context).toBe(pausedContext)
    expect(result.delivery).toEqual({
      attempted: false,
      success: true
    })
  })
})
