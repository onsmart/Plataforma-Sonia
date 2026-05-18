import { describe, expect, it } from 'vitest'
import {
  applyPatientHintsFromUserMessage,
  extractPatientProfileFromMessage,
  extractSpecialtyFromMessage,
  getMissingRegistrationFields,
  hasMinimalPatientProfile,
  isAffirmativeConfirmation,
  resolveIntakeResumeNodeId,
} from '../services/flows/flow-patient-intake'

describe('flow-patient-intake', () => {
  it('extractPatientProfileFromMessage deve separar nome e email', () => {
    const parsed = extractPatientProfileFromMessage('Marcelo Mauro Soares marcelo.mauro@onsmart.com.br')
    expect(parsed.patient_name).toBe('Marcelo Mauro Soares')
    expect(parsed.patient_email).toBe('marcelo.mauro@onsmart.com.br')
  })

  it('extractPatientProfileFromMessage deve interpretar bloco multilinha', () => {
    const parsed = extractPatientProfileFromMessage(
      'Marcelo Mauro Soares\n10/06/2003\nSao Paulo\n11999541487'
    )
    expect(parsed.patient_name).toBe('Marcelo Mauro Soares')
    expect(parsed.patient_phone).toBe('11999541487')
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
    expect(hasMinimalPatientProfile(data)).toBe(true)
  })

  it('resolveIntakeResumeNodeId deve voltar ao upsert quando cadastro estiver completo', () => {
    const data: Record<string, unknown> = {
      patient_name: 'Marcelo',
      patient_email: 'marcelo@onsmart.com.br',
      patient_phone: '5511999999999',
    }
    expect(resolveIntakeResumeNodeId('sf-intake-triage', data)).toBe('sf-intake-crm-upsert')
  })

  it('extractSpecialtyFromMessage deve mapear especialidade', () => {
    expect(extractSpecialtyFromMessage('cardiologia')).toBe('cardiologia')
    expect(extractSpecialtyFromMessage('2')).toBe('cardiologia')
  })

  it('isAffirmativeConfirmation deve reconhecer confirmacao do paciente', () => {
    expect(isAffirmativeConfirmation('Está certo sim')).toBe(true)
    expect(isAffirmativeConfirmation('Tudo certo')).toBe(true)
    expect(isAffirmativeConfirmation('cardiologia')).toBe(false)
  })

  it('confirmacao com nome e telefone deve marcar falta apenas de email', () => {
    const data: Record<string, unknown> = {
      userMessage: 'Está tudo certo',
      patient_name: 'Marcelo Mauro Soares',
      patient_phone: '5511999541448',
    }
    applyPatientHintsFromUserMessage(data)
    expect(data.registration_confirmed).toBe(true)
    expect(getMissingRegistrationFields(data)).toEqual(['patient_email'])
    expect(hasMinimalPatientProfile(data)).toBe(false)
  })
})
