import { resolveAppointmentProvider } from '../../appointments'
import {
  createHubSpotPatientContact,
  findHubSpotContactByIdentifiers,
  updateHubSpotPatientContact,
} from '../crm/hubspot-patient.service'
import { listCalendlyEventTypesForIntegration } from '../calendly'
import { sendEmail } from '../email/email.service'
import { sendWhatsApp, sendWhatsAppTemplate } from '../whatsapp'
import { buildToolKey } from '../../agents/agent-extra-features'
import { IntegrationToolDescriptor, IntegrationToolExecutionResult } from './toolkit.types'

const TOOL_CATALOG: IntegrationToolDescriptor[] = [
  {
    provider: 'calendly',
    toolName: 'list_event_types',
    toolKey: buildToolKey('calendly', 'list_event_types'),
    displayName: 'Listar tipos de evento',
    description: 'Lista os event types configurados na conta Calendly conectada.',
    requiredFields: ['integrationId'],
  },
  {
    provider: 'calendly',
    toolName: 'check_availability',
    toolKey: buildToolKey('calendly', 'check_availability'),
    displayName: 'Consultar disponibilidade',
    description: 'Verifica horários livres no Calendly para a data ou specialty escolhida.',
    requiredFields: ['integrationId', 'specialty'],
  },
  {
    provider: 'calendly',
    toolName: 'book_appointment',
    toolKey: buildToolKey('calendly', 'book_appointment'),
    displayName: 'Confirmar agendamento',
    description: 'Cria a reunião no Calendly após o cliente escolher horário e informar contato.',
    requiredFields: ['integrationId', 'specialty', 'slotId', 'patientName', 'patientEmail'],
  },
  {
    provider: 'calendly',
    toolName: 'cancel_appointment',
    toolKey: buildToolKey('calendly', 'cancel_appointment'),
    displayName: 'Cancelar agendamento',
    description: 'Cancela um evento já criado no Calendly.',
    requiredFields: ['integrationId', 'appointmentId'],
  },
  {
    provider: 'calendly',
    toolName: 'list_upcoming_appointments',
    toolKey: buildToolKey('calendly', 'list_upcoming_appointments'),
    displayName: 'Listar próximos agendamentos',
    description: 'Lista reuniões ativas futuras no Calendly para um contato (e-mail ou telefone).',
    requiredFields: ['integrationId'],
  },
  {
    provider: 'hubspot',
    toolName: 'lookup_contact',
    toolKey: buildToolKey('hubspot', 'lookup_contact'),
    displayName: 'Buscar contato no CRM',
    description: 'Localiza lead ou contato no HubSpot por e-mail, telefone ou CPF.',
    requiredFields: ['crmIntegrationId'],
  },
  {
    provider: 'hubspot',
    toolName: 'create_contact',
    toolKey: buildToolKey('hubspot', 'create_contact'),
    displayName: 'Criar contato no CRM',
    description: 'Cadastra um novo contato no HubSpot.',
    requiredFields: ['crmIntegrationId', 'fullName'],
  },
  {
    provider: 'hubspot',
    toolName: 'update_contact',
    toolKey: buildToolKey('hubspot', 'update_contact'),
    displayName: 'Atualizar contato no CRM',
    description: 'Atualiza dados de um contato existente no HubSpot.',
    requiredFields: ['crmIntegrationId', 'contactId'],
  },
  {
    provider: 'whatsapp',
    toolName: 'send_session_message',
    toolKey: buildToolKey('whatsapp', 'send_session_message'),
    displayName: 'Enviar mensagem WhatsApp',
    description: 'Envia mensagem de texto na conversa aberta do WhatsApp.',
    requiredFields: ['integrationId', 'to', 'message'],
  },
  {
    provider: 'whatsapp',
    toolName: 'send_template',
    toolKey: buildToolKey('whatsapp', 'send_template'),
    displayName: 'Enviar template WhatsApp',
    description: 'Dispara um template aprovado pela Meta.',
    requiredFields: ['integrationId', 'to', 'templateName', 'languageCode'],
  },
  {
    provider: 'email',
    toolName: 'send_email',
    toolKey: buildToolKey('email', 'send_email'),
    displayName: 'Enviar e-mail',
    description: 'Envia e-mail pela integração de correio configurada.',
    requiredFields: ['integrationId', 'to', 'subject'],
  },
]

function ensureField(value: unknown): string {
  return String(value || '').trim()
}

export function listIntegrationToolkitCatalog(): IntegrationToolDescriptor[] {
  return TOOL_CATALOG
}

export async function executeIntegrationTool(input: {
  provider: string
  toolName: string
  payload: Record<string, unknown>
}): Promise<IntegrationToolExecutionResult> {
  const provider = ensureField(input.provider).toLowerCase()
  const toolName = ensureField(input.toolName).toLowerCase()
  const payload = input.payload || {}

  if (provider === 'calendly' && toolName === 'list_event_types') {
    const integrationId = ensureField(payload.integrationId)
    const eventTypes = await listCalendlyEventTypesForIntegration(integrationId)
    return {
      success: true,
      provider,
      toolName,
      status: 'success',
      userSafeMessage: 'Event types do Calendly carregados com sucesso.',
      data: { eventTypes },
    }
  }

  if (provider === 'calendly' && toolName === 'check_availability') {
    const integrationId = ensureField(payload.integrationId)
    const appointmentProvider = resolveAppointmentProvider('calendly', { integrationId })
    const slots = await appointmentProvider.getAvailability({
      specialty: ensureField(payload.specialty),
      doctor: ensureField(payload.doctor) || null,
      consultationType: ensureField(payload.consultationType) || null,
      unit: ensureField(payload.unit) || null,
      period: ensureField(payload.period) || null,
      preferredDate: ensureField(payload.preferredDate) || null,
      timezone: ensureField(payload.timezone) || null,
      patientName: ensureField(payload.patientName) || null,
    })
    return {
      success: true,
      provider,
      toolName,
      status: 'success',
      userSafeMessage: slots.length > 0 ? 'Horários encontrados no Calendly.' : 'Nenhum horário encontrado no Calendly.',
      data: { slots },
    }
  }

  if (provider === 'calendly' && toolName === 'book_appointment') {
    const integrationId = ensureField(payload.integrationId)
    const appointmentProvider = resolveAppointmentProvider('calendly', { integrationId })
    const appointment = await appointmentProvider.book({
      specialty: ensureField(payload.specialty),
      slotId: ensureField(payload.slotId),
      patientName: ensureField(payload.patientName),
      patientEmail: ensureField(payload.patientEmail),
      patientPhone: ensureField(payload.patientPhone) || null,
      consultationType: ensureField(payload.consultationType) || null,
      unit: ensureField(payload.unit) || null,
      notes: ensureField(payload.notes) || null,
    })
    return {
      success: true,
      provider,
      toolName,
      status: 'success',
      userSafeMessage: 'Consulta agendada com sucesso no Calendly.',
      data: { appointment },
    }
  }

  if (provider === 'calendly' && toolName === 'cancel_appointment') {
    const integrationId = ensureField(payload.integrationId)
    const appointmentProvider = resolveAppointmentProvider('calendly', { integrationId })
    const appointment = await appointmentProvider.cancel({
      appointmentId: ensureField(payload.appointmentId),
      reason: ensureField(payload.reason) || null,
    })
    return {
      success: !!appointment,
      provider,
      toolName,
      status: appointment ? 'success' : 'failed',
      userSafeMessage: appointment ? 'Consulta cancelada com sucesso no Calendly.' : 'Consulta não encontrada no Calendly.',
      data: appointment ? { appointment } : undefined,
      error: appointment ? undefined : 'appointment_not_found',
    }
  }

  if (provider === 'calendly' && toolName === 'list_upcoming_appointments') {
    const integrationId = ensureField(payload.integrationId)
    const appointmentProvider = resolveAppointmentProvider('calendly', { integrationId }) as {
      findActiveAppointmentForPatient?: (input: {
        email?: string | null
        phone?: string | null
        specialty?: string | null
      }) => Promise<string | null>
      getAppointmentById?: (id: string) => Promise<{ appointmentId: string; slot: { startsAt: string } } | null>
    }
    const appointmentId = appointmentProvider.findActiveAppointmentForPatient
      ? await appointmentProvider.findActiveAppointmentForPatient({
          email: ensureField(payload.patientEmail) || ensureField(payload.email) || null,
          phone: ensureField(payload.patientPhone) || ensureField(payload.phone) || null,
          name: ensureField(payload.patientName) || ensureField(payload.name) || null,
          specialty: ensureField(payload.specialty) || null,
        })
      : null
    const appointment =
      appointmentId && appointmentProvider.getAppointmentById
        ? await appointmentProvider.getAppointmentById(appointmentId)
        : null
    return {
      success: true,
      provider,
      toolName,
      status: 'success',
      userSafeMessage: appointment
        ? 'Próximo agendamento encontrado no Calendly.'
        : 'Nenhum agendamento ativo encontrado no Calendly.',
      data: { appointments: appointment ? [appointment] : [] },
    }
  }

  if (provider === 'hubspot' && toolName === 'lookup_contact') {
    const crmIntegrationId = ensureField(payload.crmIntegrationId)
    const contact = await findHubSpotContactByIdentifiers(crmIntegrationId, {
      email: ensureField(payload.email) || null,
      phone: ensureField(payload.phone) || null,
      cpf: ensureField(payload.cpf) || null,
    })
    return {
      success: true,
      provider,
      toolName,
      status: contact ? 'success' : 'partial',
      userSafeMessage: contact ? 'Contato localizado no HubSpot.' : 'Nenhum contato encontrado no HubSpot.',
      data: { contact },
    }
  }

  if (provider === 'hubspot' && toolName === 'create_contact') {
    const crmIntegrationId = ensureField(payload.crmIntegrationId)
    const contact = await createHubSpotPatientContact(crmIntegrationId, {
      fullName: ensureField(payload.fullName),
      email: ensureField(payload.email) || null,
      phone: ensureField(payload.phone) || null,
      cpf: ensureField(payload.cpf) || null,
      birthdate: ensureField(payload.birthdate) || null,
      originTag: ensureField(payload.originTag) || null,
    })
    return {
      success: true,
      provider,
      toolName,
      status: 'success',
      userSafeMessage: 'Contato criado no HubSpot.',
      data: { contact },
    }
  }

  if (provider === 'hubspot' && toolName === 'update_contact') {
    const crmIntegrationId = ensureField(payload.crmIntegrationId)
    const contact = await updateHubSpotPatientContact(crmIntegrationId, ensureField(payload.contactId), {
      fullName: ensureField(payload.fullName) || null,
      email: ensureField(payload.email) || null,
      phone: ensureField(payload.phone) || null,
      cpf: ensureField(payload.cpf) || null,
      birthdate: ensureField(payload.birthdate) || null,
      originTag: ensureField(payload.originTag) || null,
      extraProperties:
        payload.extraProperties && typeof payload.extraProperties === 'object' && !Array.isArray(payload.extraProperties)
          ? (payload.extraProperties as Record<string, unknown>)
          : undefined,
    })
    return {
      success: true,
      provider,
      toolName,
      status: 'success',
      userSafeMessage: 'Contato atualizado no HubSpot.',
      data: { contact },
    }
  }

  if (provider === 'whatsapp' && toolName === 'send_session_message') {
    const sent = await sendWhatsApp(ensureField(payload.integrationId), {
      to: ensureField(payload.to),
      message: ensureField(payload.message),
    })
    return {
      success: !!sent?.success,
      provider,
      toolName,
      status: sent?.success ? 'success' : 'failed',
      userSafeMessage: sent?.success ? 'Mensagem enviada pelo WhatsApp.' : 'Falha ao enviar mensagem pelo WhatsApp.',
      data: sent ? { result: sent } : undefined,
      error: sent?.success ? undefined : String(sent?.error || 'whatsapp_send_failed'),
    }
  }

  if (provider === 'whatsapp' && toolName === 'send_template') {
    const sent = await sendWhatsAppTemplate(ensureField(payload.integrationId), {
      to: ensureField(payload.to),
      templateName: ensureField(payload.templateName),
      languageCode: ensureField(payload.languageCode) || 'pt_BR',
      components: Array.isArray(payload.components) ? payload.components : undefined,
    })
    return {
      success: !!sent?.success,
      provider,
      toolName,
      status: sent?.success ? 'success' : 'failed',
      userSafeMessage: sent?.success ? 'Template enviado pelo WhatsApp.' : 'Falha ao enviar template pelo WhatsApp.',
      data: sent ? { result: sent } : undefined,
      error: sent?.success ? undefined : String(sent?.error || 'whatsapp_template_failed'),
    }
  }

  if (provider === 'email' && toolName === 'send_email') {
    const result = await sendEmail(ensureField(payload.integrationId), {
      to: ensureField(payload.to),
      subject: ensureField(payload.subject),
      text: ensureField(payload.text) || undefined,
      html: ensureField(payload.html) || undefined,
    })
    return {
      success: true,
      provider,
      toolName,
      status: 'success',
      userSafeMessage: 'Email enviado com sucesso.',
      data: { result },
    }
  }

  return {
    success: false,
    provider,
    toolName,
    status: 'failed',
    userSafeMessage: 'Ferramenta de integração não suportada.',
    error: 'unsupported_integration_tool',
  }
}
