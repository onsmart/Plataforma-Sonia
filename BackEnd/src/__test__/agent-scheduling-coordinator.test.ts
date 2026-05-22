import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  looksLikeOnsmartSchedulingIntent,
  processSchedulingTurn,
  __test__,
} from '../services/agents/agent-scheduling-coordinator'

const redisStore = new Map<string, string>()

vi.mock('../lib/redis', () => ({
  getRedisClient: vi.fn(async () => ({
    get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
    setEx: vi.fn(async (key: string, _ttl: number, value: string) => {
      redisStore.set(key, value)
    }),
    del: vi.fn(async (key: string) => {
      redisStore.delete(key)
    }),
  })),
}))

vi.mock('../lib/logger', () => ({
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const executeIntegrationTool = vi.fn()
vi.mock('../services/integrations/toolkit/toolkit.service', () => ({
  executeIntegrationTool: (...args: unknown[]) => executeIntegrationTool(...args),
}))

vi.mock('../services/agents/agent-scheduling-datetime', () => ({
  extractDateTimeFromMessage: vi.fn(async () => ({
    date: '2026-05-25',
    time: '15:00',
    confidence: 'high' as const,
  })),
  slotMatchesRequestedTime: vi.fn(
    (startsAt: string, date: string | null, time: string | null) =>
      startsAt.includes('2026-05-25') && date === '2026-05-25' && time === '15:00'
  ),
}))

const config = {
  enabled: true,
  calendly_integration_id: 'cal-test',
  specialty: 'reuniao_diagnostico',
}

describe('agent-scheduling-coordinator', () => {
  beforeEach(() => {
    redisStore.clear()
    vi.clearAllMocks()
  })

  it('detecta intencao de agendamento', () => {
    expect(looksLikeOnsmartSchedulingIntent('quero agendar um diagnostico')).toBe(true)
    expect(looksLikeOnsmartSchedulingIntent('qual o preco')).toBe(false)
  })

  it('inicia coleta de identidade', async () => {
    const result = await processSchedulingTurn({
      agentId: 'agent-1',
      contactId: 'contact-1',
      message: 'quero marcar uma reuniao',
      schedulingConfig: config,
    })
    expect(result.handled).toBe(true)
    expect(result.reply).toMatch(/nome completo|e-mail|telefone/i)
  })

  it('agenda quando slot disponivel', async () => {
    executeIntegrationTool.mockImplementation(async (input: any) => {
      if (input.toolName === 'check_availability') {
        return {
          success: true,
          data: {
            slots: [
              {
                slotId: 'slot-1',
                startsAt: '2026-05-25T18:00:00.000Z',
              },
            ],
          },
        }
      }
      if (input.toolName === 'book_appointment') {
        return {
          success: true,
          data: {
            appointment: {
              slot: { startsAt: '2026-05-25T18:00:00.000Z' },
            },
          },
        }
      }
      return { success: false }
    })

    redisStore.set(
      'agent:scheduling:agent-1:contact-1',
      JSON.stringify({
        status: 'awaiting_datetime',
        patient_name: 'Maria Silva',
        patient_email: 'maria@test.com',
        patient_phone: '11999999999',
      })
    )

    const result = await processSchedulingTurn({
      agentId: 'agent-1',
      contactId: 'contact-1',
      message: '25/05/2026 as 15:00',
      schedulingConfig: config,
    })

    expect(result.handled).toBe(true)
    expect(result.reply).toContain('agendada')
    expect(executeIntegrationTool).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'book_appointment' })
    )
  })

  it('pickSlotFromNumericChoice', () => {
    const slots = [
      { slotId: 'a', startsAt: '2026-05-25T10:00:00Z' },
      { slotId: 'b', startsAt: '2026-05-25T11:00:00Z' },
    ] as any[]
    expect(__test__.pickSlotFromNumericChoice('2', slots)?.slotId).toBe('b')
  })
})
