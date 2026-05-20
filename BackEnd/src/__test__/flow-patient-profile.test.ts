import { describe, expect, it } from 'vitest'
import { phonesMatch } from '../services/integrations/crm/hubspot-patient.service'
import {
  extractPatientAppointmentBookmark,
  mergePatientAppointmentBookmark,
  readWhatsAppPhoneFromContext,
} from '../services/flows/flow-patient-profile.service'

describe('flow-patient-profile', () => {
  it('mergePatientAppointmentBookmark preenche campos vazios sem sobrescrever', () => {
    const target: Record<string, unknown> = {
      patient_email: 'novo@email.com',
    }
    mergePatientAppointmentBookmark(target, {
      patient_email: 'antigo@email.com',
      patient_phone: '5511999999999',
      appointment_id: 'https://api.calendly.com/scheduled_events/abc',
    })
    expect(target.patient_email).toBe('novo@email.com')
    expect(target.patient_phone).toBe('5511999999999')
    expect(target.appointment_id).toContain('scheduled_events')
  })

  it('phonesMatch aceita telefone com e sem DDI', () => {
    expect(phonesMatch('5511999999999', '11999999999')).toBe(true)
    expect(phonesMatch('5511999999999', '5511888888888')).toBe(false)
  })

  it('readWhatsAppPhoneFromContext extrai numero do jid', () => {
    expect(
      readWhatsAppPhoneFromContext({
        from: '5511987654321@s.whatsapp.net',
      })
    ).toBe('5511987654321')
  })

  it('extractPatientAppointmentBookmark retorna somente campos preenchidos', () => {
    const bookmark = extractPatientAppointmentBookmark({
      patient_name: 'Maria',
      patient_email: 'maria@test.com',
      noise: 'x',
    })
    expect(bookmark).toEqual({
      patient_name: 'Maria',
      patient_email: 'maria@test.com',
    })
  })
})
