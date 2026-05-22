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

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: { companies_id: 'company-1' }, error: null })),
        })),
      })),
    })),
  },
}))

vi.mock('../services/integrations/calendly/calendly.repository', () => ({
  loadCalendlyIntegrationConfig: vi.fn(async () => ({ integrationId: 'cal-test' })),
  resolveCalendlyIntegrationIdForCompany: vi.fn(async () => null),
}))

const findActiveAppointmentForPatient = vi.fn()
const getAppointmentById = vi.fn()

vi.mock('../services/appointments', () => ({
  resolveAppointmentProvider: vi.fn(() => ({
    findActiveAppointmentForPatient,
    getAppointmentById,
  })),
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
    findActiveAppointmentForPatient.mockReset()
    getAppointmentById.mockReset()
  })

  it('detecta intencao de agendamento', () => {
    expect(looksLikeOnsmartSchedulingIntent('quero agendar um diagnostico')).toBe(true)
    expect(looksLikeOnsmartSchedulingIntent('qual o preco')).toBe(false)
    expect(looksLikeOnsmartSchedulingIntent('quando e o meu proximo agendamento')).toBe(false)
    expect(__test__.looksLikeQueryExistingAppointment('quando e a minha reuniao')).toBe(true)
  })

  it('consulta reuniao existente sem iniciar novo agendamento', async () => {
    findActiveAppointmentForPatient.mockResolvedValue('https://api.calendly.com/scheduled_events/evt-1')
    getAppointmentById.mockResolvedValue({
      appointmentId: 'evt-1',
      slot: { startsAt: '2026-05-26T18:00:00.000Z' },
    })

    const result = await processSchedulingTurn({
      agentId: 'agent-1',
      contactId: '5511999999999',
      message: 'pode me mostrar a data da minha reuniao?',
      schedulingConfig: config,
    })

    expect(result.handled).toBe(true)
    expect(result.reply).toMatch(/marcada para/i)
    expect(result.reply).not.toMatch(/dia e hor[aá]rio/i)
    expect(findActiveAppointmentForPatient).toHaveBeenCalled()
  })

  it('cancela reuniao encontrada no Calendly', async () => {
    redisStore.set(
      'agent:last_booking:agent-1:5511999999999',
      JSON.stringify({
        appointmentId: 'https://api.calendly.com/scheduled_events/evt-2',
        calendly_integration_id: 'cal-test',
        starts_at: '2026-05-26T18:00:00.000Z',
        booked_at: new Date().toISOString(),
      })
    )
    executeIntegrationTool.mockResolvedValue({ success: true })

    const result = await processSchedulingTurn({
      agentId: 'agent-1',
      contactId: '5511999999999',
      message: 'quero cancelar minha reuniao',
      schedulingConfig: config,
    })

    expect(result.handled).toBe(true)
    expect(result.reply).toMatch(/cancelada/i)
    expect(executeIntegrationTool).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'cancel_appointment' })
    )
  })

  it('inicia pedindo dia e horario', async () => {
    const result = await processSchedulingTurn({
      agentId: 'agent-1',
      contactId: 'contact-1',
      message: 'quero marcar uma reuniao',
      schedulingConfig: config,
    })
    expect(result.handled).toBe(true)
    expect(result.reply).toMatch(/dia e hor[aá]rio/i)
    expect(result.reply).not.toMatch(/Calendly|link/i)
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
      })
    )

    const result = await processSchedulingTurn({
      agentId: 'agent-1',
      contactId: 'contact-1',
      message: '25/05/2026 as 15:00',
      schedulingConfig: config,
    })

    expect(result.handled).toBe(true)
    expect(result.reply).toMatch(/dispon[ií]vel|nome completo|e-mail/i)
    expect(executeIntegrationTool).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'check_availability' })
    )

    const bookTurn = await processSchedulingTurn({
      agentId: 'agent-1',
      contactId: 'contact-1',
      message: 'Maria Silva, maria@test.com, 11999999999',
      schedulingConfig: config,
    })
    expect(bookTurn.reply).toContain('agendada')
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
