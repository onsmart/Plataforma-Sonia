import logger from '../../lib/logger'
import {
  applyHubSpotPatientToFlowContext,
  createHubSpotPatientContact,
  findHubSpotContactByIdentifiers,
  findHubSpotScheduledPatient,
  recordHubSpotClinicalEvent,
  updateHubSpotPatientContact,
} from '../integrations/crm/hubspot-patient.service'
import { readWhatsAppPhoneFromContext } from './flow-patient-profile.service'
import { resolveCRMIntegrationIdForFlow } from '../integrations/crm/crm-integration.repository'
import { FlowNode } from './flow.types'
import { buildFlowIntegrationResult, FlowIntegrationResult } from './flow-node-result'

function pickString(data: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = String(data[key] || '').trim()
    if (value) return value
  }
  return ''
}

function normalizeRequiredFields(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  return fallback
}

function hasValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function hasValidPhone(value: string): boolean {
  return value.replace(/\D/g, '').length >= 10
}

function validateRequiredFields(
  requiredFields: string[],
  values: Record<string, string>,
  allowMissingDob: boolean
): string[] {
  return requiredFields.filter((field) => {
    if (field === 'patient_dob' && allowMissingDob) return false
    const current = String(values[field] || '').trim()
    if (!current) return true
    if (field === 'patient_email') return !hasValidEmail(current)
    if (field === 'patient_phone') return !hasValidPhone(current)
    return false
  })
}

export async function executeCrmContactNode(params: {
  node: FlowNode
  contextData: Record<string, any>
  companiesId?: string | null
}): Promise<FlowIntegrationResult> {
  const nodeData = params.node.data || {}
  const crmIntegrationId = await resolveCRMIntegrationIdForFlow(
    String(nodeData.crmIntegrationId || params.contextData.crm_integration_id || params.contextData.crmIntegrationId || ''),
    String(params.companiesId || params.contextData.companies_id || params.contextData.companiesId || '').trim() || null
  )
  const operation = nodeData.crmOperation || 'lookup'
  const lookupFields = Array.isArray(nodeData.lookupFields) && nodeData.lookupFields.length > 0
    ? nodeData.lookupFields
    : ['patient_phone', 'patient_email', 'patient_cpf']
  const requiredFields = normalizeRequiredFields(nodeData.requiredFields, [
    'patient_name',
    'patient_email',
    'patient_phone',
  ])
  const allowMissingDob = nodeData.allowMissingDob === true
  const originTag = String(nodeData.originTag || 'Atendimento IA Clínica').trim()

  const patientValues = {
    patient_name: pickString(params.contextData, ['patient_name', 'lead_name', 'name']),
    patient_email: pickString(params.contextData, ['patient_email', 'lead_email', 'email']),
    patient_phone: pickString(params.contextData, ['patient_phone', 'lead_phone', 'phone_number', 'phone']),
    patient_cpf: pickString(params.contextData, ['patient_cpf', 'cpf', 'documento']),
    patient_dob: pickString(params.contextData, ['patient_dob', 'birthdate', 'date_of_birth']),
  }

  if (!crmIntegrationId) {
    const missingFields = validateRequiredFields(requiredFields, patientValues, allowMissingDob)
    const whatsappPhone = pickString(params.contextData, ['phone_number', 'from', 'patient_phone'])
    const hasChannelPhone = hasValidPhone(whatsappPhone)

    if (operation === 'lookup') {
      return buildFlowIntegrationResult('crm_contact', {
        success: true,
        status: 'mocked',
        error_code: 'crm_not_configured',
        user_safe_message: '',
        retryable: false,
        integration_status: 'not_configured',
        patient_lookup_status: hasChannelPhone ? 'new' : 'incomplete',
        patient_phone: patientValues.patient_phone || whatsappPhone,
        crm_bypass: true,
      })
    }

    if (missingFields.length > 0) {
      return buildFlowIntegrationResult('crm_contact', {
        success: false,
        status: 'incomplete',
        error_code: 'missing_required_fields',
        user_safe_message: 'Alguns dados obrigatórios do paciente ainda precisam ser confirmados.',
        retryable: false,
        integration_status: 'not_configured',
        patient_lookup_status: 'incomplete',
        missing_fields: missingFields,
        crm_bypass: true,
      })
    }

    return buildFlowIntegrationResult('crm_contact', {
      success: true,
      status: 'mocked',
      error_code: 'crm_not_configured',
      user_safe_message: '',
      retryable: false,
      integration_status: 'not_configured',
      patient_lookup_status: 'new',
      patient_name: patientValues.patient_name,
      patient_email: patientValues.patient_email,
      patient_phone: patientValues.patient_phone || whatsappPhone,
      patient_cpf: patientValues.patient_cpf,
      patient_dob: patientValues.patient_dob,
      patient_origin: originTag,
      crm_bypass: true,
    })
  }

  try {
    const identifiers = {
      phone: lookupFields.includes('patient_phone') ? patientValues.patient_phone : '',
      email: lookupFields.includes('patient_email') ? patientValues.patient_email : '',
      cpf: lookupFields.includes('patient_cpf') ? patientValues.patient_cpf : '',
    }

    if (operation === 'lookup_scheduled') {
      const whatsappPhone = readWhatsAppPhoneFromContext(params.contextData)
      const lookupIdentifiers = {
        phone: identifiers.phone || whatsappPhone || '',
        email: identifiers.email || '',
        cpf: identifiers.cpf || '',
      }

      if (!lookupIdentifiers.phone && !lookupIdentifiers.email && !lookupIdentifiers.cpf) {
        return buildFlowIntegrationResult('crm_contact', {
          success: false,
          status: 'incomplete',
          error_code: 'missing_lookup_identifiers',
          user_safe_message:
            'Para localizar sua consulta, envie o e-mail ou o telefone que você usou no agendamento.',
          retryable: false,
          integration_status: 'partial',
          patient_lookup_status: 'incomplete',
          crm_scheduled_lookup_status: 'incomplete',
        })
      }

      const scheduledLookup = await findHubSpotScheduledPatient(crmIntegrationId, lookupIdentifiers)

      if (scheduledLookup.status === 'incomplete') {
        return buildFlowIntegrationResult('crm_contact', {
          success: false,
          status: 'incomplete',
          error_code: 'missing_lookup_identifiers',
          user_safe_message:
            'Para localizar sua consulta, envie o e-mail ou o telefone que você usou no agendamento.',
          retryable: false,
          integration_status: 'partial',
          patient_lookup_status: 'incomplete',
          crm_scheduled_lookup_status: 'incomplete',
        })
      }

      if (scheduledLookup.status === 'not_found') {
        return buildFlowIntegrationResult('crm_contact', {
          success: false,
          status: 'not_found',
          error_code: 'patient_not_found',
          user_safe_message:
            'Não encontrei seu cadastro com esses dados. Confira o e-mail ou telefone usados no agendamento.',
          retryable: false,
          integration_status: 'failed',
          patient_lookup_status: 'not_found',
          crm_scheduled_lookup_status: 'not_found',
        })
      }

      if (scheduledLookup.status === 'not_scheduled') {
        applyHubSpotPatientToFlowContext(params.contextData, scheduledLookup.contact)
        return buildFlowIntegrationResult('crm_contact', {
          success: false,
          status: 'not_scheduled',
          error_code: 'no_scheduled_appointment_in_crm',
          user_safe_message:
            'Encontrei seu cadastro, mas não há consulta marcada como agendada. Envie o e-mail exato usado na marcação ou fale com nossa equipe.',
          retryable: false,
          integration_status: 'partial',
          patient_lookup_status: 'existing',
          crm_scheduled_lookup_status: 'not_scheduled',
          patient_id: scheduledLookup.contact.id,
        })
      }

      applyHubSpotPatientToFlowContext(params.contextData, scheduledLookup.contact)
      return buildFlowIntegrationResult('crm_contact', {
        success: true,
        status: 'scheduled_found',
        user_safe_message: 'Consulta localizada no cadastro. Vou seguir com o cancelamento.',
        retryable: false,
        integration_status: 'success',
        patient_lookup_status: 'existing',
        crm_scheduled_lookup_status: 'scheduled_found',
        patient_id: scheduledLookup.contact.id,
        patient_name: scheduledLookup.contact.name || patientValues.patient_name,
        patient_email: scheduledLookup.contact.email || patientValues.patient_email,
        patient_phone: scheduledLookup.contact.phone || patientValues.patient_phone,
        appointment_id: scheduledLookup.contact.calendlyEventId || params.contextData.appointment_id,
        specialty: scheduledLookup.contact.appointmentSpecialty || params.contextData.specialty,
        patient_record: scheduledLookup.contact,
      })
    }

    if (operation === 'lookup') {
      if (!identifiers.phone && !identifiers.email && !identifiers.cpf) {
        return buildFlowIntegrationResult('crm_contact', {
          success: false,
          status: 'incomplete',
          error_code: 'missing_lookup_identifiers',
          user_safe_message: 'Ainda faltam dados para consultar o paciente no CRM.',
          retryable: false,
          integration_status: 'partial',
          patient_lookup_status: 'incomplete',
        })
      }

      const existing = await findHubSpotContactByIdentifiers(crmIntegrationId, identifiers)
      if (!existing) {
        return buildFlowIntegrationResult('crm_contact', {
          success: true,
          status: 'new',
          user_safe_message: 'Paciente não encontrado no CRM.',
          retryable: false,
          integration_status: 'success',
          patient_lookup_status: 'new',
          patient_origin: originTag,
        })
      }

      return buildFlowIntegrationResult('crm_contact', {
        success: true,
        status: 'existing',
        user_safe_message: 'Paciente encontrado no CRM.',
        retryable: false,
        integration_status: 'success',
        patient_lookup_status: 'existing',
        patient_id: existing.id,
        patient_name: existing.name || patientValues.patient_name || '',
        patient_email: existing.email || patientValues.patient_email || '',
        patient_phone: existing.phone || patientValues.patient_phone || '',
        patient_cpf: existing.cpf || patientValues.patient_cpf || '',
        patient_dob: existing.birthdate || patientValues.patient_dob || '',
        patient_origin: originTag,
        patient_record: existing,
      })
    }

    const missingFields = validateRequiredFields(requiredFields, patientValues, allowMissingDob)
    if (missingFields.length > 0) {
      return buildFlowIntegrationResult('crm_contact', {
        success: false,
        status: 'incomplete',
        error_code: 'missing_required_fields',
        user_safe_message: 'Alguns dados obrigatórios do paciente ainda precisam ser confirmados.',
        retryable: false,
        integration_status: 'partial',
        patient_lookup_status: 'incomplete',
        missing_fields: missingFields,
      })
    }

    if (operation === 'create') {
      const created = await createHubSpotPatientContact(crmIntegrationId, {
        fullName: patientValues.patient_name,
        email: patientValues.patient_email,
        phone: patientValues.patient_phone,
        cpf: patientValues.patient_cpf,
        birthdate: patientValues.patient_dob,
        originTag,
      })

      await recordHubSpotClinicalEvent({
        crmIntegrationId,
        patientId: created.id,
        eventType: 'patient_created',
        payload: {
          originTag,
        },
      })

      return buildFlowIntegrationResult('crm_contact', {
        success: true,
        status: 'created',
        user_safe_message: 'Paciente cadastrado com sucesso no CRM.',
        retryable: false,
        integration_status: 'success',
        patient_lookup_status: 'new',
        patient_id: created.id,
        patient_name: created.name || patientValues.patient_name,
        patient_email: created.email || patientValues.patient_email,
        patient_phone: created.phone || patientValues.patient_phone,
        patient_cpf: created.cpf || patientValues.patient_cpf,
        patient_dob: created.birthdate || patientValues.patient_dob,
        patient_origin: originTag,
        patient_record: created,
      })
    }

    const current =
      pickString(params.contextData, ['patient_id']) ||
      (await findHubSpotContactByIdentifiers(crmIntegrationId, identifiers))?.id ||
      ''

    if (!current) {
      if (operation === 'upsert') {
        return executeCrmContactNode({
          node: {
            ...params.node,
            data: {
              ...params.node.data,
              crmOperation: 'create',
            },
          },
          contextData: params.contextData,
        })
      }

      return buildFlowIntegrationResult('crm_contact', {
        success: false,
        status: 'not_found',
        error_code: 'patient_not_found',
        user_safe_message: 'Não foi possível localizar o paciente para atualização no CRM.',
        retryable: false,
        integration_status: 'failed',
        patient_lookup_status: 'failed',
      })
    }

    const updated = await updateHubSpotPatientContact(crmIntegrationId, current, {
      fullName: patientValues.patient_name,
      email: patientValues.patient_email,
      phone: patientValues.patient_phone,
      cpf: patientValues.patient_cpf,
      birthdate: patientValues.patient_dob,
      originTag,
    })

    await recordHubSpotClinicalEvent({
      crmIntegrationId,
      patientId: updated.id,
      eventType: 'patient_updated',
      payload: {
        originTag,
      },
    })

    return buildFlowIntegrationResult('crm_contact', {
      success: true,
      status: 'updated',
      user_safe_message: 'Cadastro do paciente atualizado no CRM.',
      retryable: false,
      integration_status: 'success',
      patient_lookup_status: 'existing',
      patient_id: updated.id,
      patient_name: updated.name || patientValues.patient_name,
      patient_email: updated.email || patientValues.patient_email,
      patient_phone: updated.phone || patientValues.patient_phone,
      patient_cpf: updated.cpf || patientValues.patient_cpf,
      patient_dob: updated.birthdate || patientValues.patient_dob,
      patient_origin: originTag,
      patient_record: updated,
    })
  } catch (error: any) {
    const errorMessage = String(error?.message || error || '')
    const isAuthOrConfigError =
      /401|403|invalid_authentication|authentication credentials|not configured|crm_not_configured/i.test(
        errorMessage
      )

    logger.error('[flow-node-crm-contact] Falha na operação CRM', {
      operation,
      error: errorMessage,
      isAuthOrConfigError,
    })

    if (isAuthOrConfigError) {
      const whatsappPhone = pickString(params.contextData, ['phone_number', 'from', 'patient_phone'])
      return buildFlowIntegrationResult('crm_contact', {
        success: operation === 'lookup',
        status: 'mocked',
        error_code: 'crm_auth_or_config_error',
        user_safe_message: '',
        retryable: false,
        integration_status: 'not_configured',
        patient_lookup_status:
          operation === 'lookup' ? (hasValidPhone(whatsappPhone) ? 'new' : 'incomplete') : 'new',
        patient_phone: patientValues.patient_phone || whatsappPhone,
        crm_bypass: true,
        error_message: errorMessage,
      })
    }

    return buildFlowIntegrationResult('crm_contact', {
      success: false,
      status: 'failed',
      error_code: 'crm_operation_failed',
      user_safe_message: 'Não foi possível concluir a operação no CRM agora.',
      retryable: true,
      integration_status: 'failed',
      patient_lookup_status: 'failed',
      error_message: errorMessage || 'Erro desconhecido',
    })
  }
}

