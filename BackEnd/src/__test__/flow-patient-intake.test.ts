import { describe, expect, it } from 'vitest'
import {
  applyPatientHintsFromUserMessage,
  extractPatientProfileFromMessage,
  extractSpecialtyFromMessage,
  getMissingRegistrationFields,
  hasMinimalPatientProfile,
  isAffirmativeConfirmation,
  mentionedUnsupportedSpecialty,
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

  it('resolveIntakeResumeNodeId deve voltar ao upsert quando pausado no collect-data com perfil completo', () => {
    const data: Record<string, unknown> = {
      patient_name: 'Marcelo',
      patient_email: 'marcelo@onsmart.com.br',
      patient_phone: '5511999999999',
    }
    // Pausou em collect-data (perfil incompleto) e o paciente enviou os dados completos:
    // deve redirecionar para crm-upsert para salvar antes de continuar.
    expect(resolveIntakeResumeNodeId('sf-intake-collect-data', data)).toBe('sf-intake-crm-upsert')
  })

  it('resolveIntakeResumeNodeId nao deve redirecionar ao upsert quando pausado na triagem aguardando especialidade', () => {
    const data: Record<string, unknown> = {
      patient_name: 'Marcelo',
      patient_email: 'marcelo@onsmart.com.br',
      patient_phone: '5511999999999',
    }
    // Pausou em sf-intake-triage aguardando seleção de especialidade:
    // deve permanecer em sf-intake-triage (CRM já foi atualizado antes da triagem).
    expect(resolveIntakeResumeNodeId('sf-intake-triage', data)).toBe('sf-intake-triage')
  })

  it('extractSpecialtyFromMessage deve mapear as duas especialidades suportadas', () => {
    // Números do menu só são reconhecidos quando allowNumberedMenu=true (contexto de triagem)
    expect(extractSpecialtyFromMessage('1', true)).toBe('clinica_geral')
    expect(extractSpecialtyFromMessage('clinica geral')).toBe('clinica_geral')
    expect(extractSpecialtyFromMessage('geral')).toBe('clinica_geral')
    expect(extractSpecialtyFromMessage('2', true)).toBe('cardiologia')
    expect(extractSpecialtyFromMessage('cardiologia')).toBe('cardiologia')
    expect(extractSpecialtyFromMessage('cardio')).toBe('cardiologia')
  })

  it('extractSpecialtyFromMessage deve retornar vazio para numeros fora do menu', () => {
    expect(extractSpecialtyFromMessage('3')).toBe('')
    expect(extractSpecialtyFromMessage('4')).toBe('')
    expect(extractSpecialtyFromMessage('10')).toBe('')
  })

  it('extractSpecialtyFromMessage deve retornar vazio para especialidades nao suportadas', () => {
    expect(extractSpecialtyFromMessage('dermatologia')).toBe('')
    expect(extractSpecialtyFromMessage('ginecologia')).toBe('')
    expect(extractSpecialtyFromMessage('pediatria')).toBe('')
    expect(extractSpecialtyFromMessage('ortopedia')).toBe('')
    expect(extractSpecialtyFromMessage('nutricao')).toBe('')
  })

  it('extractSpecialtyFromMessage nao deve inferir especialidade por substring acidental', () => {
    expect(extractSpecialtyFromMessage('Geraldo Silva')).toBe('')
  })

  it('mentionedUnsupportedSpecialty deve detectar especialidades nao suportadas', () => {
    expect(mentionedUnsupportedSpecialty('dermatologia')).toBe(true)
    expect(mentionedUnsupportedSpecialty('quero ginecologia')).toBe(true)
    expect(mentionedUnsupportedSpecialty('pediatria por favor')).toBe(true)
    expect(mentionedUnsupportedSpecialty('ortopedia')).toBe(true)
    expect(mentionedUnsupportedSpecialty('endocrinologia')).toBe(true)
    expect(mentionedUnsupportedSpecialty('psiquiatria')).toBe(true)
    expect(mentionedUnsupportedSpecialty('psicologia')).toBe(true)
    expect(mentionedUnsupportedSpecialty('nutricao')).toBe(true)
  })

  it('mentionedUnsupportedSpecialty nao deve detectar especialidades suportadas', () => {
    expect(mentionedUnsupportedSpecialty('cardiologia')).toBe(false)
    expect(mentionedUnsupportedSpecialty('clinica geral')).toBe(false)
    expect(mentionedUnsupportedSpecialty('quero agendar')).toBe(false)
    expect(mentionedUnsupportedSpecialty('')).toBe(false)
  })

  it('resolveIntakeTriageDeterministicMessage deve exibir mensagem clara para especialidade nao suportada', () => {
    const data: Record<string, unknown> = {
      patient_name: 'Marcelo',
      patient_email: 'm@test.com',
      patient_phone: '5511999999999',
      userMessage: 'quero dermatologia',
    }
    const message = resolveIntakeTriageDeterministicMessage(data)
    expect(message).toMatch(/apenas para/i)
    expect(message).toMatch(/Cl[íi]nica geral/i)
    expect(message).toMatch(/Cardiologia/i)
    // Nao deve definir specialty no contexto
    expect(data.specialty).toBeUndefined()
  })

  it('resolveIntakeTriageDeterministicMessage deve pausar aguardando nova escolha quando especialidade nao suportada', () => {
    const data: Record<string, unknown> = {
      patient_name: 'Ana',
      patient_email: 'ana@test.com',
      patient_phone: '5511888888888',
      userMessage: 'pediatria',
    }
    const message = resolveIntakeTriageDeterministicMessage(data)
    // Deve retornar mensagem (nao null) - fluxo permanece no no de triagem
    expect(message).not.toBeNull()
    expect(message).toMatch(/Cardiologia/i)
    expect(data.specialty).toBeUndefined()
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
