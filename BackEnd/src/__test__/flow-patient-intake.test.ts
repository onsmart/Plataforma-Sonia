import { describe, expect, it } from 'vitest'
import {
  applyPatientHintsFromUserMessage,
  extractPatientProfileFromMessage,
} from '../services/flows/flow-patient-intake'

describe('flow-patient-intake', () => {
  it('extractPatientProfileFromMessage deve separar nome e email', () => {
    const parsed = extractPatientProfileFromMessage('Marcelo Mauro Soares marcelo.mauro@onsmart.com.br')
    expect(parsed.patient_name).toBe('Marcelo Mauro Soares')
    expect(parsed.patient_email).toBe('marcelo.mauro@onsmart.com.br')
  })

  it('applyPatientHintsFromUserMessage deve limpar missing_fields quando perfil estiver completo', () => {
    const data: Record<string, unknown> = {
      userMessage: 'Marcelo Mauro Soares marcelo.mauro@onsmart.com.br',
      phone_number: '5511999999999',
      missing_fields: ['patient_name', 'patient_email'],
    }
    applyPatientHintsFromUserMessage(data)
    expect(data.patient_name).toBe('Marcelo Mauro Soares')
    expect(data.patient_email).toBe('marcelo.mauro@onsmart.com.br')
    expect(data.missing_fields).toBeUndefined()
    expect(data.patient_lookup_status).toBe('new')
  })
})
