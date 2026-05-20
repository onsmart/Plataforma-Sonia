import { describe, expect, it } from 'vitest'
import {
  isScheduledAppointmentStatus,
  SONIA_APPOINTMENT_STATUS_SCHEDULED,
} from '../services/integrations/crm/hubspot-clinic.constants'

describe('hubspot-clinic.constants', () => {
  it('isScheduledAppointmentStatus reconhece agendado e variantes', () => {
    expect(isScheduledAppointmentStatus(SONIA_APPOINTMENT_STATUS_SCHEDULED)).toBe(true)
    expect(isScheduledAppointmentStatus('Agendado')).toBe(true)
    expect(isScheduledAppointmentStatus('confirmado')).toBe(true)
    expect(isScheduledAppointmentStatus('cancelado')).toBe(false)
    expect(isScheduledAppointmentStatus('')).toBe(false)
  })
})
