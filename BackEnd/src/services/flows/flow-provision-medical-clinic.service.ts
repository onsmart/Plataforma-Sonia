import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { normalizeAgentLanguageCode } from '../../utils/agent-language'
import { getUserIdAndCompanyIdByEmail } from '../../utils/company-helper'
import { listCalendlyIntegrationConfigsForUser } from '../integrations/calendly'
import type { FlowData } from './flow.types'

type ProvisionedAgentKey =
  | 'initial'
  | 'crm'
  | 'triage'
  | 'urgency'
  | 'communication'
  | 'human'

type RoleTemplateDefinition = {
  name: string
  description: string
  role: string
}

type AgentDefinition = {
  key: ProvisionedAgentKey
  name: string
  template: string
  prompt: string
}

type ProvisionOptions = {
  crmIntegrationId?: string | null
  emailIntegrationId?: string | null
  teamNotifyEmail?: string | null
  calendlyIntegrationId?: string | null
}

export interface ProvisionMedicalClinicDemoResult {
  flowId: string
  flowName: string
  templateIds: Record<string, string>
  agentIds: Record<ProvisionedAgentKey, string>
  templatesCreated: Array<{ name: string; id: string }>
  agentsCreated: Array<{ key: ProvisionedAgentKey; name: string; id: string }>
  flow: FlowData
  appointmentProvider: 'mock_calendly' | 'calendly'
  appointmentIntegrationId: string
}

const FLOW_NAME = 'Clinica Medica - Atendimento Completo'
const DEFAULT_TEAM_NOTIFY_EMAIL = 'recepcao@clinica.com.br'
const DEFAULT_LANGUAGE = 'pt-BR'

const ROLE_TEMPLATES: RoleTemplateDefinition[] = [
  {
    name: 'Clinica - Base Atendimento Inicial',
    description: 'Recepcionista digital inicial.',
    role: `Voce e a recepcionista digital de uma clinica medica.
Seu objetivo e acolher, entender a intencao e devolver SEMPRE JSON valido em uma unica linha.

Campos esperados:
{
  "intent":"agendar|remarcar|cancelar|especialidades|humano|documentos|retorno|outro",
  "channel_origin":"whatsapp",
  "handoff_reason":"texto curto ou vazio"
}

Regras:
- Linguagem acolhedora e profissional.
- Se o paciente pedir humano, marque intent=humano.
- Nao diagnostique doencas.`,
  },
  {
    name: 'Clinica - Base Cadastro e CRM',
    description: 'Coleta dados faltantes do paciente.',
    role: `Voce ajuda a completar cadastro de paciente para CRM.
Responda SEMPRE em JSON valido:
{
  "patient_name":"string ou vazio",
  "patient_email":"string ou vazio",
  "patient_phone":"string ou vazio",
  "patient_dob":"string ou vazio",
  "patient_lookup_status":"existing|new|incomplete",
  "triage_notes":"observacoes curtas"
}

Nunca invente dados ausentes.`,
  },
  {
    name: 'Clinica - Base Triagem',
    description: 'Sugere especialidade com seguranca.',
    role: `Voce faz triagem inicial de clinica medica sem diagnosticar.
Responda SEMPRE em JSON valido:
{
  "specialty":"clinica_geral|cardiologia|dermatologia|ginecologia|ortopedia|pediatria|endocrinologia|psiquiatria|psicologia|nutricao|outra",
  "specialty_confidence":"high|medium|low",
  "triage_notes":"resumo curto do motivo da consulta"
}

Nunca de diagnostico ou tratamento.`,
  },
  {
    name: 'Clinica - Base Urgencia',
    description: 'Detecta sinais de emergencia.',
    role: `Voce avalia apenas sinais de urgencia antes do agendamento.
Responda SEMPRE em JSON valido:
{
  "urgency_status":"urgent|non_urgent",
  "handoff_reason":"texto curto ou vazio",
  "triage_notes":"reforco curto da triagem"
}

Marque urgent quando houver sinais compativeis com dor no peito, falta de ar intensa, desmaio, sangramento intenso, confusao mental, dor muito forte ou risco de vida.`,
  },
  {
    name: 'Clinica - Base Comunicacao',
    description: 'Explica especialidades e proximos passos.',
    role: `Voce responde duvidas sobre especialidades medicas e orienta proximos passos de forma clara e humana.
Nao diagnostique doencas, nao interprete exames e nao prescreva medicamentos.
Responda em texto curto, pronto para WhatsApp.`,
  },
  {
    name: 'Clinica - Base Suporte Humano',
    description: 'Explica transbordo para atendimento humano.',
    role: `Voce informa que a equipe humana continuara o atendimento.
Responda em texto curto, acolhedor e objetivo, pronto para WhatsApp.`,
  },
]

const AGENTS: AgentDefinition[] = [
  {
    key: 'initial',
    name: 'Sonia Clinica - Atendimento Inicial',
    template: 'Clinica - Base Atendimento Inicial',
    prompt:
      'Voce e o primeiro contato da clinica. Identifique a intencao com linguagem acolhedora e objetiva. Saida sempre em JSON.',
  },
  {
    key: 'crm',
    name: 'Sonia Clinica - Cadastro e CRM',
    template: 'Clinica - Base Cadastro e CRM',
    prompt:
      'Voce coleta ou confirma dados de cadastro sem inventar nada. Saida sempre em JSON.',
  },
  {
    key: 'triage',
    name: 'Sonia Clinica - Triagem',
    template: 'Clinica - Base Triagem',
    prompt:
      'Voce organiza a demanda clinica e sugere a especialidade provavel sem diagnosticar. Saida sempre em JSON.',
  },
  {
    key: 'urgency',
    name: 'Sonia Clinica - Urgencia',
    template: 'Clinica - Base Urgencia',
    prompt:
      'Voce avalia apenas sinais de urgencia e interrompe o fluxo quando necessario. Saida sempre em JSON.',
  },
  {
    key: 'communication',
    name: 'Sonia Clinica - Comunicacao',
    template: 'Clinica - Base Comunicacao',
    prompt:
      'Voce responde duvidas sobre especialidades, orientacoes e retorno em texto curto.',
  },
  {
    key: 'human',
    name: 'Sonia Clinica - Suporte Humano',
    template: 'Clinica - Base Suporte Humano',
    prompt:
      'Voce explica o encaminhamento para equipe humana em texto curto.',
  },
]

function unwrapRpcId(data: unknown): string {
  if (typeof data === 'string' && data.trim()) return data.trim()
  if (Array.isArray(data) && data[0] && typeof data[0].id === 'string') return String(data[0].id).trim()
  if (data && typeof data === 'object' && 'id' in data && typeof (data as { id?: unknown }).id === 'string') {
    return String((data as { id: string }).id).trim()
  }
  throw new Error(`Resposta RPC inesperada: ${JSON.stringify(data).slice(0, 200)}`)
}

async function ensureTemplate(
  email: string,
  companiesId: string,
  definition: RoleTemplateDefinition
): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from('tb_agents_templates')
    .select('id')
    .eq('name', definition.name)
    .eq('companies_id', companiesId)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Buscar template "${definition.name}": ${existingError.message}`)
  }

  if (existing?.id) {
    return String(existing.id)
  }

  const { data, error } = await supabase.rpc('sp_create_agent_template', {
    p_name: definition.name,
    p_role: definition.role,
    p_description: definition.description,
    p_icon: 'bot',
    p_complexity: 'Intermediate',
    p_channel_names: ['whatsapp', 'webchat', 'email'],
    p_skill_names: [],
    p_email: email,
  })

  if (error) {
    throw new Error(`Criar template "${definition.name}": ${error.message}`)
  }

  return unwrapRpcId(data)
}

async function ensureAgent(
  email: string,
  companiesId: string,
  definition: AgentDefinition,
  roleTemplateId: string
): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from('tb_agents')
    .select('id')
    .eq('nome', definition.name)
    .eq('companies_id', companiesId)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Buscar agente "${definition.name}": ${existingError.message}`)
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('tb_agents')
      .update({
        role_template_id: roleTemplateId,
        personality_prompt: definition.prompt,
        provider: 'openai',
        provider_model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 1200,
      })
      .eq('id', existing.id)

    if (updateError) {
      throw new Error(`Atualizar agente "${definition.name}": ${updateError.message}`)
    }

    return String(existing.id)
  }

  const { data, error } = await supabase.rpc('sp_create_agent_by_email', {
    p_email: email,
    p_nome: definition.name,
    p_role_template_id: roleTemplateId,
    p_primary_language: normalizeAgentLanguageCode(DEFAULT_LANGUAGE, DEFAULT_LANGUAGE),
    p_bio: 'Agente especialista do fluxo demo de clinica medica.',
    p_integrations_id: null,
  })

  if (error) {
    throw new Error(`Criar agente "${definition.name}": ${error.message}`)
  }

  const agentId = unwrapRpcId(data)
  const { error: updateError } = await supabase
    .from('tb_agents')
    .update({
      personality_prompt: definition.prompt,
      provider: 'openai',
      provider_model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 1200,
    })
    .eq('id', agentId)

  if (updateError) {
    throw new Error(`Configurar agente "${definition.name}": ${updateError.message}`)
  }

  return agentId
}

function createFlowPayload(params: {
  agentIds: Record<ProvisionedAgentKey, string>
  crmIntegrationId: string
  emailIntegrationId: string
  teamNotifyEmail: string
  appointmentProvider: 'mock_calendly' | 'calendly'
  appointmentIntegrationId: string
}): FlowData {
  const appointmentNodeData = {
    appointmentProvider: params.appointmentProvider,
    appointmentIntegrationId: params.appointmentIntegrationId,
    specialtyField: 'specialty',
    doctorField: 'doctor_name',
    consultationTypeField: 'consultation_type',
    unitField: 'clinic_unit',
    periodField: 'preferred_period',
    preferredDateField: 'preferred_date',
  }

  const nodes: Record<string, any> = {
    start: { id: 'n-start', type: 'start', position: { x: 80, y: 0 }, data: { label: 'Inicio' } },
    overview: {
      id: 'n-overview',
      type: 'comment',
      position: { x: 40, y: 110 },
      data: {
        label: 'Visao geral',
        comment:
          'Fluxo demo WhatsApp-first para clinica medica com CRM, triagem, urgencia, agenda, documentos, handoff e follow-up.',
      },
    },
    initial: {
      id: 'n-initial',
      type: 'agent',
      position: { x: 80, y: 240 },
      data: {
        label: 'Agente de Atendimento Inicial',
        executionMode: 'agent',
        agentId: params.agentIds.initial,
        agentName: 'Sonia Clinica - Atendimento Inicial',
        additionalInstructions: 'Classifique a intencao em intent e normalize channel_origin=whatsapp.',
      },
    },
    intentSwitch: {
      id: 'n-intent-switch',
      type: 'switch',
      position: { x: 80, y: 380 },
      data: {
        label: 'Intent',
        branchField: 'intent',
        switchDefaultLabel: 'Fora do escopo',
        switchCases: [
          { id: 'agendar', label: 'Agendar', value: 'agendar' },
          { id: 'remarcar', label: 'Remarcar', value: 'remarcar' },
          { id: 'cancelar', label: 'Cancelar', value: 'cancelar' },
          { id: 'especialidades', label: 'Especialidades', value: 'especialidades' },
          { id: 'documentos', label: 'Documentos', value: 'documentos' },
          { id: 'retorno', label: 'Retorno', value: 'retorno' },
          { id: 'humano', label: 'Humano', value: 'humano' },
        ],
      },
    },
    crmLookup: {
      id: 'n-crm-lookup',
      type: 'crm_contact',
      position: { x: -260, y: 560 },
      data: {
        label: 'Identificar paciente',
        crmOperation: 'lookup',
        crmIntegrationId: params.crmIntegrationId,
        lookupFields: ['patient_phone', 'patient_email', 'patient_cpf'],
        requiredFields: ['patient_name', 'patient_email', 'patient_phone'],
        originTag: 'Atendimento IA Clinica',
        allowMissingDob: true,
      },
    },
    patientStatus: {
      id: 'n-patient-status',
      type: 'switch',
      position: { x: -260, y: 710 },
      data: {
        label: 'Paciente existe no CRM?',
        branchField: 'patient_lookup_status',
        switchDefaultLabel: 'Faltam dados',
        switchCases: [
          { id: 'existing', label: 'Existente', value: 'existing' },
          { id: 'new', label: 'Novo', value: 'new' },
          { id: 'incomplete', label: 'Incompleto', value: 'incomplete' },
        ],
      },
    },
    cadastroAgent: {
      id: 'n-cadastro-agent',
      type: 'agent',
      position: { x: -520, y: 900 },
      data: {
        label: 'Agente de Cadastro e CRM',
        executionMode: 'agent',
        agentId: params.agentIds.crm,
        agentName: 'Sonia Clinica - Cadastro e CRM',
        additionalInstructions:
          'Se faltarem dados, organize patient_name, patient_email, patient_phone, patient_dob e patient_lookup_status.',
      },
    },
    crmCreate: {
      id: 'n-crm-create',
      type: 'crm_contact',
      position: { x: -520, y: 1050 },
      data: {
        label: 'Criar paciente',
        crmOperation: 'create',
        crmIntegrationId: params.crmIntegrationId,
        requiredFields: ['patient_name', 'patient_email', 'patient_phone'],
        originTag: 'Atendimento IA Clinica',
        allowMissingDob: true,
      },
    },
    crmUpdate: {
      id: 'n-crm-update',
      type: 'crm_contact',
      position: { x: -260, y: 900 },
      data: {
        label: 'Atualizar cadastro',
        crmOperation: 'update',
        crmIntegrationId: params.crmIntegrationId,
        requiredFields: ['patient_name', 'patient_email', 'patient_phone'],
        originTag: 'Atendimento IA Clinica',
        allowMissingDob: true,
      },
    },
    triageAgent: {
      id: 'n-triage-agent',
      type: 'agent',
      position: { x: -260, y: 1210 },
      data: {
        label: 'Agente de Triagem',
        executionMode: 'agent',
        agentId: params.agentIds.triage,
        agentName: 'Sonia Clinica - Triagem',
        additionalInstructions: 'Normalize specialty, specialty_confidence e triage_notes.',
      },
    },
    urgencyAgent: {
      id: 'n-urgency-agent',
      type: 'agent',
      position: { x: -260, y: 1370 },
      data: {
        label: 'Agente de Urgencia',
        executionMode: 'agent',
        agentId: params.agentIds.urgency,
        agentName: 'Sonia Clinica - Urgencia',
        additionalInstructions: 'Normalize urgency_status e handoff_reason.',
      },
    },
    urgencySwitch: {
      id: 'n-urgency-switch',
      type: 'switch',
      position: { x: -260, y: 1530 },
      data: {
        label: 'Urgencia?',
        branchField: 'urgency_status',
        switchDefaultLabel: 'Falha',
        switchCases: [
          { id: 'urgent', label: 'Urgente', value: 'urgent' },
          { id: 'non_urgent', label: 'Nao urgente', value: 'non_urgent' },
        ],
      },
    },
    urgentHandoff: {
      id: 'n-urgent-handoff',
      type: 'human_handoff',
      position: { x: -520, y: 1710 },
      data: {
        label: 'Encaminhar urgencia',
        handoffReasonField: 'handoff_reason',
        handoffPriority: 'urgent',
        notifyEmail: params.teamNotifyEmail,
        patientMessage:
          'Identificamos um possivel sinal de urgencia. Procure atendimento emergencial imediatamente e nossa equipe humana seguira acompanhando voce.',
      },
    },
    appointmentAvailability: {
      id: 'n-appointment-availability',
      type: 'appointment',
      position: { x: -260, y: 1710 },
      data: {
        label: 'Consultar disponibilidade',
        appointmentOperation: 'availability',
        ...appointmentNodeData,
      },
    },
    appointmentStatus: {
      id: 'n-appointment-status',
      type: 'switch',
      position: { x: -260, y: 1870 },
      data: {
        label: 'Ha horarios?',
        branchField: 'appointment_status',
        switchDefaultLabel: 'Falha',
        switchCases: [
          { id: 'available', label: 'Disponivel', value: 'available' },
          { id: 'unavailable', label: 'Indisponivel', value: 'unavailable' },
        ],
      },
    },
    appointmentBook: {
      id: 'n-appointment-book',
      type: 'appointment',
      position: { x: -260, y: 2040 },
      data: {
        label: 'Agendar consulta',
        appointmentOperation: 'book',
        ...appointmentNodeData,
      },
    },
    appointmentConfirmed: {
      id: 'n-appointment-confirmed',
      type: 'if-else',
      position: { x: -260, y: 2200 },
      data: {
        label: 'Agendamento confirmado?',
        branchField: 'appointment_status',
        ifValue: 'confirmed',
        elseLabel: 'falhou',
      },
    },
    waConfirm: {
      id: 'n-wa-confirm',
      type: 'whatsapp_message',
      position: { x: -520, y: 2380 },
      data: {
        label: 'WhatsApp confirmacao',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText:
          'Consulta agendada com sucesso. Especialidade: {{specialty}}. Data e hora: {{appointment_slot.startsAt}}. Se precisar, responda a esta mensagem para remarcar.',
        waIntegrationId: '',
      },
    },
    emailConfirm: {
      id: 'n-email-confirm',
      type: 'email_send',
      position: { x: -520, y: 2530 },
      data: {
        label: 'Email confirmacao',
        emailIntegrationId: params.emailIntegrationId,
        emailTo: '{{patient_email}}',
        emailSubject: 'Confirmacao da consulta - {{specialty}}',
        emailText:
          'Sua consulta foi agendada.\nEspecialidade: {{specialty}}\nData: {{appointment_slot.startsAt}}\nLocal ou link: {{appointment_slot.location}}',
      },
    },
    schedule24h: {
      id: 'n-schedule-24h',
      type: 'schedule',
      position: { x: -520, y: 2680 },
      data: {
        label: 'Lembrete 24h',
        scheduleAt: '{{appointment_reminder_24h_at}}',
        scheduleTimezone: 'America/Sao_Paulo',
      },
    },
    waReminder24h: {
      id: 'n-wa-reminder-24h',
      type: 'whatsapp_message',
      position: { x: -520, y: 2830 },
      data: {
        label: 'WhatsApp 24h',
        waWindowMode: 'session_only',
        waMessageType: 'reminder',
        waMessageText:
          'Lembrete: sua consulta acontece em aproximadamente 24 horas. Responda aqui se precisar de ajuda.',
        waReminderAt: '{{appointment_reminder_24h_at}}',
        waIntegrationId: '',
      },
    },
    schedule2h: {
      id: 'n-schedule-2h',
      type: 'schedule',
      position: { x: -520, y: 2980 },
      data: {
        label: 'Lembrete 2h',
        scheduleAt: '{{appointment_reminder_2h_at}}',
        scheduleTimezone: 'America/Sao_Paulo',
      },
    },
    waReminder2h: {
      id: 'n-wa-reminder-2h',
      type: 'whatsapp_message',
      position: { x: -520, y: 3130 },
      data: {
        label: 'WhatsApp 2h',
        waWindowMode: 'session_only',
        waMessageType: 'reminder',
        waMessageText: 'Sua consulta esta se aproximando. Faltam cerca de 2 horas para o atendimento.',
        waReminderAt: '{{appointment_reminder_2h_at}}',
        waIntegrationId: '',
      },
    },
    scheduleFollowup: {
      id: 'n-schedule-followup',
      type: 'schedule',
      position: { x: -520, y: 3280 },
      data: {
        label: 'Follow-up pos consulta',
        scheduleAt: '{{appointment_followup_at}}',
        scheduleTimezone: 'America/Sao_Paulo',
      },
    },
    waFollowup: {
      id: 'n-wa-followup',
      type: 'whatsapp_message',
      position: { x: -520, y: 3430 },
      data: {
        label: 'Follow-up retorno',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText:
          'Esperamos que sua consulta tenha corrido bem. Se desejar, podemos ajudar a organizar um retorno.',
        waIntegrationId: '',
      },
    },
    unavailableMessage: {
      id: 'n-unavailable-message',
      type: 'whatsapp_message',
      position: { x: 0, y: 2040 },
      data: {
        label: 'Lista de espera',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText:
          'No momento nao encontramos horarios proximos. Podemos registrar seu interesse na lista de espera.',
        waIntegrationId: '',
      },
    },
    unavailableHandoff: {
      id: 'n-unavailable-handoff',
      type: 'human_handoff',
      position: { x: 0, y: 2200 },
      data: {
        label: 'Encaminhar lista de espera',
        handoffReasonField: 'handoff_reason',
        handoffPriority: 'medium',
        notifyEmail: params.teamNotifyEmail,
        patientMessage: 'Nossa equipe vai verificar alternativas de agenda e retornara em breve.',
      },
    },
    scheduleAbandonment: {
      id: 'n-abandonment-schedule',
      type: 'schedule',
      position: { x: 240, y: 560 },
      data: {
        label: 'Retomar abandono',
        scheduleAt: '2026-05-20T15:00:00.000Z',
        scheduleTimezone: 'America/Sao_Paulo',
      },
    },
    abandonmentMessage: {
      id: 'n-abandonment-message',
      type: 'whatsapp_message',
      position: { x: 240, y: 710 },
      data: {
        label: 'Follow-up abandono',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText:
          'Percebemos que o agendamento nao foi concluido. Se quiser, posso retomar por aqui.',
        waIntegrationId: '',
      },
    },
    rescheduleBranch: {
      id: 'n-reschedule-branch',
      type: 'appointment',
      position: { x: -20, y: 560 },
      data: {
        label: 'Remarcar consulta',
        appointmentOperation: 'reschedule',
        ...appointmentNodeData,
      },
    },
    cancelBranch: {
      id: 'n-cancel-branch',
      type: 'appointment',
      position: { x: 220, y: 560 },
      data: {
        label: 'Cancelar consulta',
        appointmentOperation: 'cancel',
        ...appointmentNodeData,
      },
    },
    rescheduleNotify: {
      id: 'n-reschedule-notify',
      type: 'whatsapp_message',
      position: { x: -20, y: 720 },
      data: {
        label: 'Confirmacao remarcacao',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText: 'Sua consulta foi remarcada com sucesso para {{appointment_slot.startsAt}}.',
        waIntegrationId: '',
      },
    },
    cancelNotify: {
      id: 'n-cancel-notify',
      type: 'whatsapp_message',
      position: { x: 220, y: 720 },
      data: {
        label: 'Confirmacao cancelamento',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText:
          'Sua consulta foi cancelada. Se desejar, podemos ajudar a reagendar futuramente.',
        waIntegrationId: '',
      },
    },
    specialtyAgent: {
      id: 'n-specialty-agent',
      type: 'agent',
      position: { x: 480, y: 560 },
      data: {
        label: 'Agente de Comunicacao',
        executionMode: 'agent',
        agentId: params.agentIds.communication,
        agentName: 'Sonia Clinica - Comunicacao',
        additionalInstructions:
          'Explique especialidades disponiveis e sugira proximos passos em texto curto.',
      },
    },
    documentsLookup: {
      id: 'n-documents-lookup',
      type: 'crm_contact',
      position: { x: 720, y: 560 },
      data: {
        label: 'Identificar paciente para documentos',
        crmOperation: 'lookup',
        crmIntegrationId: params.crmIntegrationId,
        lookupFields: ['patient_phone', 'patient_email', 'patient_cpf'],
        requiredFields: ['patient_name', 'patient_email', 'patient_phone'],
        originTag: 'Atendimento IA Clinica',
        allowMissingDob: true,
      },
    },
    documentIntake: {
      id: 'n-document-intake',
      type: 'document_intake',
      position: { x: 720, y: 720 },
      data: {
        label: 'Receber exames e documentos',
        documentKinds: ['exam', 'pedido_medico', 'document'],
        notifyTeam: true,
        acceptWithoutFile: false,
      },
    },
    documentsNotify: {
      id: 'n-documents-notify',
      type: 'human_handoff',
      position: { x: 720, y: 880 },
      data: {
        label: 'Notificar equipe sobre documentos',
        handoffReasonField: 'handoff_reason',
        handoffPriority: 'medium',
        notifyEmail: params.teamNotifyEmail,
        patientMessage:
          'Recebemos sua solicitacao. Nossa equipe vai conferir os documentos e retornar se precisar de algo mais.',
      },
    },
    returnMessage: {
      id: 'n-return-message',
      type: 'whatsapp_message',
      position: { x: 960, y: 560 },
      data: {
        label: 'Solicitacao de retorno',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText: 'Registramos seu pedido de retorno. Nossa equipe vai falar com voce o quanto antes.',
        waIntegrationId: '',
      },
    },
    humanDirect: {
      id: 'n-human-direct',
      type: 'human_handoff',
      position: { x: 1200, y: 560 },
      data: {
        label: 'Transferencia direta',
        handoffReasonField: 'handoff_reason',
        handoffPriority: 'medium',
        notifyEmail: params.teamNotifyEmail,
        patientMessage: 'Vou encaminhar voce para nossa equipe humana agora.',
      },
    },
    defaultHandoff: {
      id: 'n-default-handoff',
      type: 'human_handoff',
      position: { x: 1440, y: 560 },
      data: {
        label: 'Fora do escopo',
        handoffReasonField: 'handoff_reason',
        handoffPriority: 'medium',
        notifyEmail: params.teamNotifyEmail,
        patientMessage:
          'Seu pedido precisa de apoio da nossa equipe humana. Vamos continuar o atendimento por la.',
      },
    },
    stopA: { id: 'n-stop-a', type: 'stop', position: { x: -520, y: 3600 }, data: { label: 'Fim' } },
    stopB: { id: 'n-stop-b', type: 'stop', position: { x: 0, y: 2360 }, data: { label: 'Fim' } },
    stopC: { id: 'n-stop-c', type: 'stop', position: { x: 240, y: 880 }, data: { label: 'Fim' } },
    stopD: { id: 'n-stop-d', type: 'stop', position: { x: 480, y: 720 }, data: { label: 'Fim' } },
    stopE: { id: 'n-stop-e', type: 'stop', position: { x: 720, y: 1040 }, data: { label: 'Fim' } },
    stopF: { id: 'n-stop-f', type: 'stop', position: { x: 960, y: 720 }, data: { label: 'Fim' } },
    stopG: { id: 'n-stop-g', type: 'stop', position: { x: 1200, y: 720 }, data: { label: 'Fim' } },
    stopH: { id: 'n-stop-h', type: 'stop', position: { x: 1440, y: 720 }, data: { label: 'Fim' } },
    stopI: { id: 'n-stop-i', type: 'stop', position: { x: -520, y: 1860 }, data: { label: 'Fim' } },
  }

  return {
    startNodeId: nodes.start.id,
    nodes: Object.values(nodes),
    edges: [
      { source: nodes.start.id, target: nodes.overview.id },
      { source: nodes.overview.id, target: nodes.initial.id, sourceHandle: 'pointer' },
      { source: nodes.initial.id, target: nodes.intentSwitch.id },
      { source: nodes.intentSwitch.id, target: nodes.crmLookup.id, sourceHandle: 'case:agendar' },
      { source: nodes.intentSwitch.id, target: nodes.rescheduleBranch.id, sourceHandle: 'case:remarcar' },
      { source: nodes.intentSwitch.id, target: nodes.cancelBranch.id, sourceHandle: 'case:cancelar' },
      { source: nodes.intentSwitch.id, target: nodes.specialtyAgent.id, sourceHandle: 'case:especialidades' },
      { source: nodes.intentSwitch.id, target: nodes.documentsLookup.id, sourceHandle: 'case:documentos' },
      { source: nodes.intentSwitch.id, target: nodes.returnMessage.id, sourceHandle: 'case:retorno' },
      { source: nodes.intentSwitch.id, target: nodes.humanDirect.id, sourceHandle: 'case:humano' },
      { source: nodes.intentSwitch.id, target: nodes.defaultHandoff.id, sourceHandle: 'default' },

      { source: nodes.crmLookup.id, target: nodes.patientStatus.id },
      { source: nodes.patientStatus.id, target: nodes.cadastroAgent.id, sourceHandle: 'case:new' },
      { source: nodes.patientStatus.id, target: nodes.crmUpdate.id, sourceHandle: 'case:existing' },
      { source: nodes.patientStatus.id, target: nodes.cadastroAgent.id, sourceHandle: 'case:incomplete' },
      { source: nodes.patientStatus.id, target: nodes.scheduleAbandonment.id, sourceHandle: 'default' },
      { source: nodes.cadastroAgent.id, target: nodes.crmCreate.id },
      { source: nodes.crmCreate.id, target: nodes.triageAgent.id },
      { source: nodes.crmUpdate.id, target: nodes.triageAgent.id },
      { source: nodes.triageAgent.id, target: nodes.urgencyAgent.id },
      { source: nodes.urgencyAgent.id, target: nodes.urgencySwitch.id },
      { source: nodes.urgencySwitch.id, target: nodes.urgentHandoff.id, sourceHandle: 'case:urgent' },
      { source: nodes.urgencySwitch.id, target: nodes.appointmentAvailability.id, sourceHandle: 'case:non_urgent' },
      { source: nodes.urgencySwitch.id, target: nodes.humanDirect.id, sourceHandle: 'default' },
      { source: nodes.urgentHandoff.id, target: nodes.stopI.id },

      { source: nodes.appointmentAvailability.id, target: nodes.appointmentStatus.id },
      { source: nodes.appointmentStatus.id, target: nodes.appointmentBook.id, sourceHandle: 'case:available' },
      { source: nodes.appointmentStatus.id, target: nodes.unavailableMessage.id, sourceHandle: 'case:unavailable' },
      { source: nodes.appointmentStatus.id, target: nodes.humanDirect.id, sourceHandle: 'default' },
      { source: nodes.appointmentBook.id, target: nodes.appointmentConfirmed.id },
      { source: nodes.appointmentConfirmed.id, target: nodes.waConfirm.id, sourceHandle: 'true' },
      { source: nodes.appointmentConfirmed.id, target: nodes.humanDirect.id, sourceHandle: 'false' },
      { source: nodes.waConfirm.id, target: nodes.emailConfirm.id },
      { source: nodes.emailConfirm.id, target: nodes.schedule24h.id },
      { source: nodes.schedule24h.id, target: nodes.waReminder24h.id },
      { source: nodes.waReminder24h.id, target: nodes.schedule2h.id },
      { source: nodes.schedule2h.id, target: nodes.waReminder2h.id },
      { source: nodes.waReminder2h.id, target: nodes.scheduleFollowup.id },
      { source: nodes.scheduleFollowup.id, target: nodes.waFollowup.id },
      { source: nodes.waFollowup.id, target: nodes.stopA.id },

      { source: nodes.unavailableMessage.id, target: nodes.unavailableHandoff.id },
      { source: nodes.unavailableHandoff.id, target: nodes.stopB.id },
      { source: nodes.scheduleAbandonment.id, target: nodes.abandonmentMessage.id },
      { source: nodes.abandonmentMessage.id, target: nodes.stopC.id },

      { source: nodes.rescheduleBranch.id, target: nodes.rescheduleNotify.id },
      { source: nodes.rescheduleNotify.id, target: nodes.stopC.id },
      { source: nodes.cancelBranch.id, target: nodes.cancelNotify.id },
      { source: nodes.cancelNotify.id, target: nodes.stopC.id },

      { source: nodes.specialtyAgent.id, target: nodes.stopD.id },
      { source: nodes.documentsLookup.id, target: nodes.documentIntake.id },
      { source: nodes.documentIntake.id, target: nodes.documentsNotify.id },
      { source: nodes.documentsNotify.id, target: nodes.stopE.id },
      { source: nodes.returnMessage.id, target: nodes.stopF.id },
      { source: nodes.humanDirect.id, target: nodes.stopG.id },
      { source: nodes.defaultHandoff.id, target: nodes.stopH.id },
    ],
  }
}

async function ensureFlow(email: string, companiesId: string, flow: FlowData): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from('tb_flows')
    .select('id')
    .eq('companies_id', companiesId)
    .eq('name', FLOW_NAME)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Buscar fluxo demo: ${existingError.message}`)
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('tb_flows')
      .update({ nodes: flow, user_email: email })
      .eq('id', existing.id)

    if (updateError) {
      throw new Error(`Atualizar fluxo demo: ${updateError.message}`)
    }

    return String(existing.id)
  }

  const { data, error } = await supabase
    .from('tb_flows')
    .insert({
      name: FLOW_NAME,
      nodes: flow,
      user_email: email,
      companies_id: companiesId,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new Error(`Criar fluxo demo: ${error?.message || 'falha ao persistir fluxo'}`)
  }

  return String(data.id)
}

async function resolveCalendlyProvisioning(userEmail: string, preferredIntegrationId: string) {
  const normalizedPreferred = preferredIntegrationId.trim()
  if (normalizedPreferred) {
    return {
      provider: 'calendly' as const,
      integrationId: normalizedPreferred,
    }
  }

  const integrations = await listCalendlyIntegrationConfigsForUser(userEmail)
  const active = integrations.find((item) => item.isActive !== false && item.isDefault === true)
  const fallback = active || integrations.find((item) => item.isActive !== false)

  if (fallback?.integrationId) {
    return {
      provider: 'calendly' as const,
      integrationId: String(fallback.integrationId),
    }
  }

  return {
    provider: 'mock_calendly' as const,
    integrationId: '',
  }
}

export async function provisionMedicalClinicDemoFlow(
  userEmail: string,
  options?: ProvisionOptions
): Promise<ProvisionMedicalClinicDemoResult> {
  const normalizedEmail = String(userEmail || '').trim().toLowerCase()
  if (!normalizedEmail) {
    throw new Error('Email do usuario e obrigatorio para provisionar o fluxo da clinica.')
  }

  const identity = await getUserIdAndCompanyIdByEmail(normalizedEmail)
  if (!identity.companyId) {
    throw new Error('Empresa nao encontrada para o usuario autenticado.')
  }

  const calendlyProvisioning = await resolveCalendlyProvisioning(
    normalizedEmail,
    String(options?.calendlyIntegrationId || '')
  )

  const teamNotifyEmail = String(options?.teamNotifyEmail || DEFAULT_TEAM_NOTIFY_EMAIL).trim() || DEFAULT_TEAM_NOTIFY_EMAIL
  const crmIntegrationId = String(options?.crmIntegrationId || '').trim()
  const emailIntegrationId = String(options?.emailIntegrationId || '').trim()

  const templateIds: Record<string, string> = {}
  for (const template of ROLE_TEMPLATES) {
    templateIds[template.name] = await ensureTemplate(normalizedEmail, identity.companyId, template)
  }

  const agentIds = {} as Record<ProvisionedAgentKey, string>
  for (const agent of AGENTS) {
    const templateId = templateIds[agent.template]
    agentIds[agent.key] = await ensureAgent(normalizedEmail, identity.companyId, agent, templateId)
  }

  const flow = createFlowPayload({
    agentIds,
    crmIntegrationId,
    emailIntegrationId,
    teamNotifyEmail,
    appointmentProvider: calendlyProvisioning.provider,
    appointmentIntegrationId: calendlyProvisioning.integrationId,
  })

  const flowId = await ensureFlow(normalizedEmail, identity.companyId, flow)

  logger.info('[flow-provision-medical-clinic] Demo provisionado', {
    userEmail: normalizedEmail,
    companyId: identity.companyId,
    flowId,
    appointmentProvider: calendlyProvisioning.provider,
    appointmentIntegrationId: calendlyProvisioning.integrationId || null,
  })

  return {
    flowId,
    flowName: FLOW_NAME,
    templateIds,
    agentIds,
    templatesCreated: ROLE_TEMPLATES.map((template) => ({
      name: template.name,
      id: templateIds[template.name],
    })),
    agentsCreated: AGENTS.map((agent) => ({
      key: agent.key,
      name: agent.name,
      id: agentIds[agent.key],
    })),
    flow,
    appointmentProvider: calendlyProvisioning.provider,
    appointmentIntegrationId: calendlyProvisioning.integrationId,
  }
}
