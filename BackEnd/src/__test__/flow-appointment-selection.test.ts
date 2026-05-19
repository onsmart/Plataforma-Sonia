import { describe, expect, it } from 'vitest'
import {
  applyAppointmentSlotSelectionFromUserMessage,
  buildAppointmentSlotSelectionMessage,
} from '../services/flows/flow-appointment-selection'

describe('flow-appointment-selection', () => {
  it('deve selecionar slot por indice numerico da resposta do paciente', () => {
    const data: Record<string, unknown> = {
      userMessage: '2',
      __awaiting_appointment_slot: true,
      appointment_slots: [
        { slotId: 'slot-1', startsAt: '2026-05-20T13:00:00.000Z' },
        { slotId: 'slot-2', startsAt: '2026-05-20T14:00:00.000Z' },
      ],
    }

    applyAppointmentSlotSelectionFromUserMessage(data)

    expect(data.appointment_selected_slot_id).toBe('slot-2')
    expect(data.appointment_selected_slot_index).toBe(2)
  })

  it('deve montar mensagem com opcoes numeradas de horario', () => {
    const message = buildAppointmentSlotSelectionMessage({
      specialty: 'cardiologia',
      appointment_slots: [
        {
          slotId: 'slot-1',
          startsAt: '2026-05-20T13:00:00.000Z',
          doctor: 'Dra. Ana',
          unit: 'Unidade Central',
          mode: 'online',
        },
        {
          slotId: 'slot-2',
          startsAt: '2026-05-20T14:00:00.000Z',
          doctor: 'Dr. Paulo',
          unit: 'Unidade Sul',
          mode: 'presencial',
        },
      ],
    })

    expect(message).toMatch(/1\./)
    expect(message).toMatch(/2\./)
    expect(message).toMatch(/cardiologia/i)
    expect(message).toMatch(/numero da opcao/i)
  })

  it('nao deve confundir opcao numerica da especialidade com escolha de horario', () => {
    const data: Record<string, unknown> = {
      userMessage: '2',
      specialty: 'cardiologia',
      appointment_slots: [
        { slotId: 'slot-1', startsAt: '2026-05-20T13:00:00.000Z' },
        { slotId: 'slot-2', startsAt: '2026-05-20T14:00:00.000Z' },
      ],
    }

    applyAppointmentSlotSelectionFromUserMessage(data)

    expect(data.appointment_selected_slot_id).toBeUndefined()
  })
})
