import { describe, expect, it } from 'vitest'
import {
  applyPatientHintsFromUserMessage,
  extractPatientProfileFromMessage,
  extractSpecialtyFromMessage,
  getMissingRegistrationFields,
  hasMinimalPatientProfile,
  isAffirmativeConfirmation,
  resolveIntakeCollectDeterministicMessage,
  resolveIntakeResumeNodeId,
  resolveIntakeTriageDeterministicMessage,
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
    expect(isAffirmativeConfirmation('Está correto sim')).toBe(true)
    expect(isAffirmativeConfirmation('Tudo certo')).toBe(true)
    expect(isAffirmativeConfirmation('cardiologia')).toBe(false)
    expect(isAffirmativeConfirmation('Não está correto')).toBe(false)
  })

  it('resolveIntakeCollectDeterministicMessage deve pedir email apos confirmacao', () => {
    const data: Record<string, unknown> = {
      userMessage: 'Está correto sim',
      patient_name: 'Marcelo Mauro Soares',
      patient_phone: '5511999431007',
    }
    const message = resolveIntakeCollectDeterministicMessage(data)
    expect(message).toMatch(/e-mail/i)
  })

  it('resolveIntakeCollectDeterministicMessage sempre retorna texto', () => {
    const message = resolveIntakeCollectDeterministicMessage({ userMessage: '1' })
    expect(message.length).toBeGreaterThan(10)
  })

  it('resolveIntakeTriageDeterministicMessage deve mostrar menu de especialidades', () => {
    const data: Record<string, unknown> = {
      patient_name: 'Marcelo',
      patient_email: 'm@test.com',
      patient_phone: '5511999999999',
      userMessage: 'ok',
    }
    const message = resolveIntakeTriageDeterministicMessage(data)
    expect(message).toMatch(/Cardiologia/)
  })

  it('resolveIntakeTriageDeterministicMessage deve combinar confirmacao de cadastro com menu quando o perfil completa na mesma volta', () => {
    const data: Record<string, unknown> = {
      userMessage: 'Marcelo Mauro Soares\nmarcelo@onsmart.com.br',
      patient_phone: '5511999999999',
    }

    const collectMessage = resolveIntakeCollectDeterministicMessage(data)
    const triageMessage = resolveIntakeTriageDeterministicMessage(data)

    expect(collectMessage).toMatch(/Cadastro recebido/i)
    expect(triageMessage).toContain(collectMessage)
    expect(triageMessage).toMatch(/Qual especialidade/i)
  })

  it('resolveIntakeTriageDeterministicMessage nao deve repetir confirmacao antiga em chamadas seguintes', () => {
    const data: Record<string, unknown> = {
      userMessage: 'Marcelo Mauro Soares\nmarcelo@onsmart.com.br',
      patient_phone: '5511999999999',
    }

    resolveIntakeCollectDeterministicMessage(data)
    const firstTriageMessage = resolveIntakeTriageDeterministicMessage(data)
    const secondTriageMessage = resolveIntakeTriageDeterministicMessage(data)

    expect(firstTriageMessage).toMatch(/Cadastro recebido/i)
    expect(secondTriageMessage).not.toMatch(/Cadastro recebido/i)
    expect(secondTriageMessage).toMatch(/Qual especialidade/i)
  })
})
