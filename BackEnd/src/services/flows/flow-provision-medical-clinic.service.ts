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
  subflowIds: Record<string, string>
  templateIds: Record<string, string>
  agentIds: Record<ProvisionedAgentKey, string>
  templatesCreated: Array<{ name: string; id: string }>
  agentsCreated: Array<{ key: ProvisionedAgentKey; name: string; id: string }>
  flow: FlowData
  appointmentProvider: 'calendly'
  appointmentIntegrationId: string
}

const FLOW_NAME = 'Clinica Medica - Atendimento Completo'
const SUBFLOW_NAMES = {
  intake: 'Clinica Medica - 01 Cadastro e Triagem',
  appointment: 'Clinica Medica - 02 Agendamento',
  reschedule: 'Clinica Medica - 03 Remarcacao',
  cancellation: 'Clinica Medica - 04 Cancelamento',
  documents: 'Clinica Medica - 05 Documentos',
  specialties: 'Clinica Medica - 06 Especialidades',
  human: 'Clinica Medica - 07 Handoff Humano',
  followups: 'Clinica Medica - 08 Follow-ups',
} as const
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
  appointmentProvider: 'calendly'
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

  const flow: FlowData = {
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

  return compactFlowLayout(flow, 0.48, 0.54)
}

function compactFlowLayout(flow: FlowData, scaleX: number, scaleY: number): FlowData {
  return {
    ...flow,
    nodes: flow.nodes.map((node) => ({
      ...node,
      position: {
        x: Math.round(node.position.x * scaleX),
        y: Math.round(node.position.y * scaleY),
      },
    })),
  }
}

type FlowBuilderParams = {
  agentIds: Record<ProvisionedAgentKey, string>
  crmIntegrationId: string
  emailIntegrationId: string
  teamNotifyEmail: string
  appointmentProvider: 'calendly'
  appointmentIntegrationId: string
}

function appointmentNodeData(params: FlowBuilderParams) {
  return {
    appointmentProvider: params.appointmentProvider,
    appointmentIntegrationId: params.appointmentIntegrationId,
    specialtyField: 'specialty',
    doctorField: 'doctor_name',
    consultationTypeField: 'consultation_type',
    unitField: 'clinic_unit',
    periodField: 'preferred_period',
    preferredDateField: 'preferred_date',
  }
}

function createIntakeTriageSubflow(params: FlowBuilderParams): FlowData {
  const nodes: Record<string, any> = {
    start: { id: 'sf-intake-start', type: 'start', position: { x: 80, y: 40 }, data: { label: 'Inicio' } },
    note: {
      id: 'sf-intake-note',
      type: 'comment',
      position: { x: 80, y: 150 },
      data: {
        label: 'Cadastro, triagem e urgencia',
        comment:
          'Subfluxo reutilizavel: identifica paciente, cria/atualiza CRM, coleta triagem e normaliza urgency_status.',
      },
    },
    lookup: {
      id: 'sf-intake-crm-lookup',
      type: 'crm_contact',
      position: { x: 80, y: 300 },
      data: {
        label: 'Consultar paciente no CRM',
        crmOperation: 'lookup',
        crmIntegrationId: params.crmIntegrationId,
        lookupFields: ['patient_phone', 'patient_email', 'patient_cpf'],
        requiredFields: ['patient_name', 'patient_email', 'patient_phone'],
        originTag: 'Atendimento IA Clinica',
        allowMissingDob: true,
      },
    },
    patientStatus: {
      id: 'sf-intake-patient-status',
      type: 'switch',
      position: { x: 80, y: 460 },
      data: {
        label: 'Status do paciente',
        branchField: 'patient_lookup_status',
        switchDefaultLabel: 'Incompleto',
        switchCases: [
          { id: 'existing', label: 'Existente', value: 'existing' },
          { id: 'new', label: 'Novo', value: 'new' },
          { id: 'incomplete', label: 'Incompleto', value: 'incomplete' },
        ],
      },
    },
    collectData: {
      id: 'sf-intake-collect-data',
      type: 'agent',
      position: { x: -180, y: 640 },
      data: {
        label: 'Completar cadastro',
        executionMode: 'agent',
        agentId: params.agentIds.crm,
        agentName: 'Sonia Clinica - Cadastro e CRM',
        additionalInstructions:
          'Organize dados faltantes e retorne patient_name, patient_email, patient_phone e patient_lookup_status.',
      },
    },
    upsert: {
      id: 'sf-intake-crm-upsert',
      type: 'crm_contact',
      position: { x: -180, y: 800 },
      data: {
        label: 'Criar ou atualizar contato',
        crmOperation: 'upsert',
        crmIntegrationId: params.crmIntegrationId,
        requiredFields: ['patient_name', 'patient_email', 'patient_phone'],
        originTag: 'Atendimento IA Clinica',
        allowMissingDob: true,
      },
    },
    update: {
      id: 'sf-intake-crm-update',
      type: 'crm_contact',
      position: { x: 210, y: 640 },
      data: {
        label: 'Atualizar contato existente',
        crmOperation: 'update',
        crmIntegrationId: params.crmIntegrationId,
        requiredFields: ['patient_name', 'patient_email', 'patient_phone'],
        originTag: 'Atendimento IA Clinica',
        allowMissingDob: true,
      },
    },
    triage: {
      id: 'sf-intake-triage',
      type: 'agent',
      position: { x: 80, y: 980 },
      data: {
        label: 'Triagem sem diagnostico',
        executionMode: 'agent',
        agentId: params.agentIds.triage,
        agentName: 'Sonia Clinica - Triagem',
        additionalInstructions:
          'Sugira especialidade provavel sem diagnosticar. Normalize specialty, specialty_confidence e triage_notes.',
      },
    },
    urgency: {
      id: 'sf-intake-urgency',
      type: 'agent',
      position: { x: 80, y: 1140 },
      data: {
        label: 'Detectar urgencia',
        executionMode: 'agent',
        agentId: params.agentIds.urgency,
        agentName: 'Sonia Clinica - Urgencia',
        additionalInstructions: 'Normalize urgency_status como urgent ou non_urgent.',
      },
    },
    stop: { id: 'sf-intake-stop', type: 'stop', position: { x: 80, y: 1300 }, data: { label: 'Fim' } },
  }

  return compactFlowLayout(
    {
      startNodeId: nodes.start.id,
      meta: { kind: 'subflow', parentFlowName: FLOW_NAME, subflowKey: 'intake', subflowOrder: 1 },
      nodes: Object.values(nodes),
      edges: [
        { source: nodes.start.id, target: nodes.note.id },
        { source: nodes.note.id, target: nodes.lookup.id, sourceHandle: 'pointer' },
        { source: nodes.lookup.id, target: nodes.patientStatus.id },
        { source: nodes.patientStatus.id, target: nodes.update.id, sourceHandle: 'case:existing' },
        { source: nodes.patientStatus.id, target: nodes.collectData.id, sourceHandle: 'case:new' },
        { source: nodes.patientStatus.id, target: nodes.collectData.id, sourceHandle: 'case:incomplete' },
        { source: nodes.patientStatus.id, target: nodes.collectData.id, sourceHandle: 'default' },
        { source: nodes.collectData.id, target: nodes.upsert.id },
        { source: nodes.upsert.id, target: nodes.triage.id },
        { source: nodes.update.id, target: nodes.triage.id },
        { source: nodes.triage.id, target: nodes.urgency.id },
        { source: nodes.urgency.id, target: nodes.stop.id },
      ],
    },
    0.82,
    0.78
  )
}

function createFollowupsSubflow(): FlowData {
  const nodes: Record<string, any> = {
    start: { id: 'sf-followups-start', type: 'start', position: { x: 80, y: 40 }, data: { label: 'Inicio' } },
    note: {
      id: 'sf-followups-note',
      type: 'comment',
      position: { x: 80, y: 150 },
      data: {
        label: 'Follow-ups automaticos',
        comment:
          'Subfluxo isolado para lembretes e mensagens de retomada. Pode ser reutilizado por outros fluxos com agenda.',
      },
    },
    schedule24h: {
      id: 'sf-followups-schedule-24h',
      type: 'schedule',
      position: { x: 80, y: 310 },
      data: {
        label: 'Lembrete 24h',
        scheduleAt: '{{appointment_reminder_24h_at}}',
        scheduleTimezone: 'America/Sao_Paulo',
      },
    },
    wa24h: {
      id: 'sf-followups-wa-24h',
      type: 'whatsapp_message',
      position: { x: 80, y: 470 },
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
      id: 'sf-followups-schedule-2h',
      type: 'schedule',
      position: { x: 80, y: 630 },
      data: {
        label: 'Lembrete 2h',
        scheduleAt: '{{appointment_reminder_2h_at}}',
        scheduleTimezone: 'America/Sao_Paulo',
      },
    },
    wa2h: {
      id: 'sf-followups-wa-2h',
      type: 'whatsapp_message',
      position: { x: 80, y: 790 },
      data: {
        label: 'WhatsApp 2h',
        waWindowMode: 'session_only',
        waMessageType: 'reminder',
        waMessageText: 'Sua consulta esta se aproximando. Faltam cerca de 2 horas para o atendimento.',
        waReminderAt: '{{appointment_reminder_2h_at}}',
        waIntegrationId: '',
      },
    },
    schedulePost: {
      id: 'sf-followups-schedule-post',
      type: 'schedule',
      position: { x: 80, y: 950 },
      data: {
        label: 'Pos-consulta',
        scheduleAt: '{{appointment_followup_at}}',
        scheduleTimezone: 'America/Sao_Paulo',
      },
    },
    waPost: {
      id: 'sf-followups-wa-post',
      type: 'whatsapp_message',
      position: { x: 80, y: 1110 },
      data: {
        label: 'Mensagem de retorno',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText:
          'Esperamos que sua consulta tenha corrido bem. Se desejar, podemos ajudar a organizar um retorno.',
        waIntegrationId: '',
      },
    },
    stop: { id: 'sf-followups-stop', type: 'stop', position: { x: 80, y: 1270 }, data: { label: 'Fim' } },
  }

  return compactFlowLayout(
    {
      startNodeId: nodes.start.id,
      meta: { kind: 'subflow', parentFlowName: FLOW_NAME, subflowKey: 'followups', subflowOrder: 8 },
      nodes: Object.values(nodes),
      edges: [
        { source: nodes.start.id, target: nodes.note.id },
        { source: nodes.note.id, target: nodes.schedule24h.id, sourceHandle: 'pointer' },
        { source: nodes.schedule24h.id, target: nodes.wa24h.id },
        { source: nodes.wa24h.id, target: nodes.schedule2h.id },
        { source: nodes.schedule2h.id, target: nodes.wa2h.id },
        { source: nodes.wa2h.id, target: nodes.schedulePost.id },
        { source: nodes.schedulePost.id, target: nodes.waPost.id },
        { source: nodes.waPost.id, target: nodes.stop.id },
      ],
    },
    0.82,
    0.78
  )
}

function createAppointmentSubflow(params: FlowBuilderParams, followupsFlowId: string): FlowData {
  const appointmentData = appointmentNodeData(params)
  const nodes: Record<string, any> = {
    start: { id: 'sf-appointment-start', type: 'start', position: { x: 80, y: 40 }, data: { label: 'Inicio' } },
    note: {
      id: 'sf-appointment-note',
      type: 'comment',
      position: { x: 80, y: 150 },
      data: {
        label: 'Agenda generica',
        comment:
          'Consulta disponibilidade, cria agendamento e dispara comunicacoes. O provider pode ser mock ou Calendly real.',
      },
    },
    availability: {
      id: 'sf-appointment-availability',
      type: 'appointment',
      position: { x: 80, y: 310 },
      data: {
        label: 'Consultar disponibilidade',
        appointmentOperation: 'availability',
        ...appointmentData,
      },
    },
    status: {
      id: 'sf-appointment-status',
      type: 'switch',
      position: { x: 80, y: 470 },
      data: {
        label: 'Horario disponivel?',
        branchField: 'appointment_status',
        switchDefaultLabel: 'Falha',
        switchCases: [
          { id: 'available', label: 'Disponivel', value: 'available' },
          { id: 'unavailable', label: 'Indisponivel', value: 'unavailable' },
        ],
      },
    },
    book: {
      id: 'sf-appointment-book',
      type: 'appointment',
      position: { x: 80, y: 640 },
      data: {
        label: 'Criar agendamento',
        appointmentOperation: 'book',
        ...appointmentData,
      },
    },
    confirmed: {
      id: 'sf-appointment-confirmed',
      type: 'if-else',
      position: { x: 80, y: 800 },
      data: {
        label: 'Confirmado?',
        branchField: 'appointment_status',
        ifValue: 'confirmed',
        elseLabel: 'falhou',
      },
    },
    waConfirm: {
      id: 'sf-appointment-wa-confirm',
      type: 'whatsapp_message',
      position: { x: -170, y: 980 },
      data: {
        label: 'Confirmacao WhatsApp',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText:
          'Consulta agendada com sucesso. Especialidade: {{specialty}}. Data e hora: {{appointment_slot.startsAt}}.',
        waIntegrationId: '',
      },
    },
    emailConfirm: {
      id: 'sf-appointment-email-confirm',
      type: 'email_send',
      position: { x: -170, y: 1140 },
      data: {
        label: 'Confirmacao por email',
        emailIntegrationId: params.emailIntegrationId,
        emailTo: '{{patient_email}}',
        emailSubject: 'Confirmacao da consulta - {{specialty}}',
        emailText:
          'Sua consulta foi agendada.\nEspecialidade: {{specialty}}\nData: {{appointment_slot.startsAt}}\nLocal ou link: {{appointment_slot.location}}',
      },
    },
    followups: {
      id: 'sf-appointment-followups',
      type: 'subflow',
      position: { x: -170, y: 1300 },
      data: {
        label: 'Agendar follow-ups',
        subflowId: followupsFlowId,
        subflowName: SUBFLOW_NAMES.followups,
        subflowResultKey: 'clinic_followups_result',
        subflowFailOnError: false,
      },
    },
    waitlistMessage: {
      id: 'sf-appointment-waitlist-message',
      type: 'whatsapp_message',
      position: { x: 360, y: 640 },
      data: {
        label: 'Oferecer lista de espera',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText:
          'No momento nao encontramos horarios proximos. Posso registrar seu interesse na lista de espera.',
        waIntegrationId: '',
      },
    },
    waitlistHandoff: {
      id: 'sf-appointment-waitlist-handoff',
      type: 'human_handoff',
      position: { x: 360, y: 800 },
      data: {
        label: 'Notificar equipe',
        handoffReasonField: 'handoff_reason',
        handoffPriority: 'medium',
        notifyEmail: params.teamNotifyEmail,
        patientMessage: 'Nossa equipe vai verificar alternativas de agenda e retornara em breve.',
      },
    },
    failedHandoff: {
      id: 'sf-appointment-failed-handoff',
      type: 'human_handoff',
      position: { x: 100, y: 980 },
      data: {
        label: 'Falha de agenda',
        handoffReasonField: 'handoff_reason',
        handoffPriority: 'medium',
        notifyEmail: params.teamNotifyEmail,
        patientMessage:
          'Tive uma instabilidade ao finalizar o agendamento. Vou acionar nossa equipe para continuar com voce.',
      },
    },
    stopOk: { id: 'sf-appointment-stop-ok', type: 'stop', position: { x: -170, y: 1460 }, data: { label: 'Fim' } },
    stopWaitlist: { id: 'sf-appointment-stop-waitlist', type: 'stop', position: { x: 360, y: 960 }, data: { label: 'Fim' } },
    stopFail: { id: 'sf-appointment-stop-fail', type: 'stop', position: { x: 100, y: 1140 }, data: { label: 'Fim' } },
  }

  return compactFlowLayout(
    {
      startNodeId: nodes.start.id,
      meta: { kind: 'subflow', parentFlowName: FLOW_NAME, subflowKey: 'appointment', subflowOrder: 2 },
      nodes: Object.values(nodes),
      edges: [
        { source: nodes.start.id, target: nodes.note.id },
        { source: nodes.note.id, target: nodes.availability.id, sourceHandle: 'pointer' },
        { source: nodes.availability.id, target: nodes.status.id },
        { source: nodes.status.id, target: nodes.book.id, sourceHandle: 'case:available' },
        { source: nodes.status.id, target: nodes.waitlistMessage.id, sourceHandle: 'case:unavailable' },
        { source: nodes.status.id, target: nodes.failedHandoff.id, sourceHandle: 'default' },
        { source: nodes.book.id, target: nodes.confirmed.id },
        { source: nodes.confirmed.id, target: nodes.waConfirm.id, sourceHandle: 'true' },
        { source: nodes.confirmed.id, target: nodes.failedHandoff.id, sourceHandle: 'false' },
        { source: nodes.waConfirm.id, target: nodes.emailConfirm.id },
        { source: nodes.emailConfirm.id, target: nodes.followups.id },
        { source: nodes.followups.id, target: nodes.stopOk.id },
        { source: nodes.waitlistMessage.id, target: nodes.waitlistHandoff.id },
        { source: nodes.waitlistHandoff.id, target: nodes.stopWaitlist.id },
        { source: nodes.failedHandoff.id, target: nodes.stopFail.id },
      ],
    },
    0.82,
    0.78
  )
}

function createRescheduleSubflow(params: FlowBuilderParams): FlowData {
  const appointmentData = appointmentNodeData(params)
  const nodes: Record<string, any> = {
    start: { id: 'sf-reschedule-start', type: 'start', position: { x: 80, y: 40 }, data: { label: 'Inicio' } },
    action: {
      id: 'sf-reschedule-action',
      type: 'appointment',
      position: { x: 80, y: 190 },
      data: {
        label: 'Remarcar agendamento',
        appointmentOperation: 'reschedule',
        ...appointmentData,
      },
    },
    notify: {
      id: 'sf-reschedule-notify',
      type: 'whatsapp_message',
      position: { x: 80, y: 350 },
      data: {
        label: 'Confirmar remarcacao',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText: 'Sua consulta foi remarcada com sucesso para {{appointment_slot.startsAt}}.',
        waIntegrationId: '',
      },
    },
    stop: { id: 'sf-reschedule-stop', type: 'stop', position: { x: 80, y: 510 }, data: { label: 'Fim' } },
  }

  return {
    startNodeId: nodes.start.id,
    meta: { kind: 'subflow', parentFlowName: FLOW_NAME, subflowKey: 'reschedule', subflowOrder: 3 },
    nodes: Object.values(nodes),
    edges: [
      { source: nodes.start.id, target: nodes.action.id },
      { source: nodes.action.id, target: nodes.notify.id },
      { source: nodes.notify.id, target: nodes.stop.id },
    ],
  }
}

function createCancellationSubflow(params: FlowBuilderParams): FlowData {
  const appointmentData = appointmentNodeData(params)
  const nodes: Record<string, any> = {
    start: { id: 'sf-cancel-start', type: 'start', position: { x: 80, y: 40 }, data: { label: 'Inicio' } },
    action: {
      id: 'sf-cancel-action',
      type: 'appointment',
      position: { x: 80, y: 190 },
      data: {
        label: 'Cancelar agendamento',
        appointmentOperation: 'cancel',
        ...appointmentData,
      },
    },
    notify: {
      id: 'sf-cancel-notify',
      type: 'whatsapp_message',
      position: { x: 80, y: 350 },
      data: {
        label: 'Confirmar cancelamento',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText:
          'Sua consulta foi cancelada. Se desejar, podemos ajudar a reagendar futuramente.',
        waIntegrationId: '',
      },
    },
    stop: { id: 'sf-cancel-stop', type: 'stop', position: { x: 80, y: 510 }, data: { label: 'Fim' } },
  }

  return {
    startNodeId: nodes.start.id,
    meta: { kind: 'subflow', parentFlowName: FLOW_NAME, subflowKey: 'cancellation', subflowOrder: 4 },
    nodes: Object.values(nodes),
    edges: [
      { source: nodes.start.id, target: nodes.action.id },
      { source: nodes.action.id, target: nodes.notify.id },
      { source: nodes.notify.id, target: nodes.stop.id },
    ],
  }
}

function createDocumentsSubflow(params: FlowBuilderParams): FlowData {
  const nodes: Record<string, any> = {
    start: { id: 'sf-docs-start', type: 'start', position: { x: 80, y: 40 }, data: { label: 'Inicio' } },
    lookup: {
      id: 'sf-docs-lookup',
      type: 'crm_contact',
      position: { x: 80, y: 190 },
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
    intake: {
      id: 'sf-docs-intake',
      type: 'document_intake',
      position: { x: 80, y: 350 },
      data: {
        label: 'Receber documento',
        documentKinds: ['exam', 'pedido_medico', 'document'],
        notifyTeam: true,
        acceptWithoutFile: false,
      },
    },
    notify: {
      id: 'sf-docs-notify',
      type: 'human_handoff',
      position: { x: 80, y: 510 },
      data: {
        label: 'Notificar equipe',
        handoffReasonField: 'handoff_reason',
        handoffPriority: 'medium',
        notifyEmail: params.teamNotifyEmail,
        patientMessage:
          'Recebemos sua solicitacao. Nossa equipe vai conferir os documentos e retornar se precisar de algo mais.',
      },
    },
    stop: { id: 'sf-docs-stop', type: 'stop', position: { x: 80, y: 670 }, data: { label: 'Fim' } },
  }

  return {
    startNodeId: nodes.start.id,
    meta: { kind: 'subflow', parentFlowName: FLOW_NAME, subflowKey: 'documents', subflowOrder: 5 },
    nodes: Object.values(nodes),
    edges: [
      { source: nodes.start.id, target: nodes.lookup.id },
      { source: nodes.lookup.id, target: nodes.intake.id },
      { source: nodes.intake.id, target: nodes.notify.id },
      { source: nodes.notify.id, target: nodes.stop.id },
    ],
  }
}

function createSpecialtiesSubflow(params: FlowBuilderParams): FlowData {
  const nodes: Record<string, any> = {
    start: { id: 'sf-specialties-start', type: 'start', position: { x: 80, y: 40 }, data: { label: 'Inicio' } },
    agent: {
      id: 'sf-specialties-agent',
      type: 'agent',
      position: { x: 80, y: 190 },
      data: {
        label: 'Explicar especialidades',
        executionMode: 'agent',
        agentId: params.agentIds.communication,
        agentName: 'Sonia Clinica - Comunicacao',
        additionalInstructions:
          'Explique especialidades disponiveis e sugira proximos passos em texto curto, sem diagnostico.',
      },
    },
    stop: { id: 'sf-specialties-stop', type: 'stop', position: { x: 80, y: 350 }, data: { label: 'Fim' } },
  }

  return {
    startNodeId: nodes.start.id,
    meta: { kind: 'subflow', parentFlowName: FLOW_NAME, subflowKey: 'specialties', subflowOrder: 6 },
    nodes: Object.values(nodes),
    edges: [
      { source: nodes.start.id, target: nodes.agent.id },
      { source: nodes.agent.id, target: nodes.stop.id },
    ],
  }
}

function createHumanHandoffSubflow(params: FlowBuilderParams): FlowData {
  const nodes: Record<string, any> = {
    start: { id: 'sf-human-start', type: 'start', position: { x: 80, y: 40 }, data: { label: 'Inicio' } },
    urgency: {
      id: 'sf-human-urgency-switch',
      type: 'switch',
      position: { x: 80, y: 190 },
      data: {
        label: 'Prioridade',
        branchField: 'urgency_status',
        switchDefaultLabel: 'Padrao',
        switchCases: [
          { id: 'urgent', label: 'Urgente', value: 'urgent' },
          { id: 'non_urgent', label: 'Padrao', value: 'non_urgent' },
        ],
      },
    },
    urgent: {
      id: 'sf-human-urgent',
      type: 'human_handoff',
      position: { x: -160, y: 370 },
      data: {
        label: 'Alerta de urgencia',
        handoffReasonField: 'handoff_reason',
        handoffPriority: 'urgent',
        notifyEmail: params.teamNotifyEmail,
        patientMessage:
          'Identificamos um possivel sinal de urgencia. Procure atendimento emergencial imediatamente. Nossa equipe humana tambem foi acionada.',
      },
    },
    standard: {
      id: 'sf-human-standard',
      type: 'human_handoff',
      position: { x: 250, y: 370 },
      data: {
        label: 'Transferencia humana',
        handoffReasonField: 'handoff_reason',
        handoffPriority: 'medium',
        notifyEmail: params.teamNotifyEmail,
        patientMessage: 'Vou encaminhar voce para nossa equipe humana agora.',
      },
    },
    stopUrgent: { id: 'sf-human-stop-urgent', type: 'stop', position: { x: -160, y: 540 }, data: { label: 'Fim' } },
    stopStandard: { id: 'sf-human-stop-standard', type: 'stop', position: { x: 250, y: 540 }, data: { label: 'Fim' } },
  }

  return {
    startNodeId: nodes.start.id,
    meta: { kind: 'subflow', parentFlowName: FLOW_NAME, subflowKey: 'human', subflowOrder: 7 },
    nodes: Object.values(nodes),
    edges: [
      { source: nodes.start.id, target: nodes.urgency.id },
      { source: nodes.urgency.id, target: nodes.urgent.id, sourceHandle: 'case:urgent' },
      { source: nodes.urgency.id, target: nodes.standard.id, sourceHandle: 'case:non_urgent' },
      { source: nodes.urgency.id, target: nodes.standard.id, sourceHandle: 'default' },
      { source: nodes.urgent.id, target: nodes.stopUrgent.id },
      { source: nodes.standard.id, target: nodes.stopStandard.id },
    ],
  }
}

function createMainOrchestratorFlow(params: FlowBuilderParams, subflowIds: Record<string, string>): FlowData {
  const nodes: Record<string, any> = {
    start: { id: 'clinic-main-start', type: 'start', position: { x: 80, y: 40 }, data: { label: 'Inicio' } },
    note: {
      id: 'clinic-main-note',
      type: 'comment',
      position: { x: 80, y: 150 },
      data: {
        label: 'Orquestrador da clinica',
        comment:
          'Canvas principal pequeno: entende a intencao e delega para subfluxos especializados. Abra cada subfluxo para editar detalhes.',
      },
    },
    initial: {
      id: 'clinic-main-initial',
      type: 'agent',
      position: { x: 80, y: 310 },
      data: {
        label: 'Atendimento inicial',
        executionMode: 'agent',
        agentId: params.agentIds.initial,
        agentName: 'Sonia Clinica - Atendimento Inicial',
        additionalInstructions: 'Classifique intent e normalize channel_origin=whatsapp.',
      },
    },
    intent: {
      id: 'clinic-main-intent',
      type: 'switch',
      position: { x: 80, y: 470 },
      data: {
        label: 'Roteamento por intencao',
        branchField: 'intent',
        switchDefaultLabel: 'Humano',
        switchCases: [
          { id: 'agendar', label: 'Agendar', value: 'agendar' },
          { id: 'remarcar', label: 'Remarcar', value: 'remarcar' },
          { id: 'cancelar', label: 'Cancelar', value: 'cancelar' },
          { id: 'especialidades', label: 'Especialidades', value: 'especialidades' },
          { id: 'documentos', label: 'Documentos', value: 'documentos' },
          { id: 'retorno', label: 'Retorno/Humano', value: 'retorno' },
          { id: 'humano', label: 'Humano', value: 'humano' },
        ],
      },
    },
    intake: {
      id: 'clinic-main-subflow-intake',
      type: 'subflow',
      position: { x: -220, y: 660 },
      data: {
        label: 'Cadastro + triagem',
        subflowId: subflowIds.intake,
        subflowName: SUBFLOW_NAMES.intake,
        subflowResultKey: 'clinic_intake_result',
        subflowFailOnError: true,
      },
    },
    urgency: {
      id: 'clinic-main-urgency',
      type: 'switch',
      position: { x: -220, y: 840 },
      data: {
        label: 'Urgencia?',
        branchField: 'urgency_status',
        switchDefaultLabel: 'Humano',
        switchCases: [
          { id: 'urgent', label: 'Urgente', value: 'urgent' },
          { id: 'non_urgent', label: 'Nao urgente', value: 'non_urgent' },
        ],
      },
    },
    appointment: {
      id: 'clinic-main-subflow-appointment',
      type: 'subflow',
      position: { x: -20, y: 1020 },
      data: {
        label: 'Agendamento',
        subflowId: subflowIds.appointment,
        subflowName: SUBFLOW_NAMES.appointment,
        subflowResultKey: 'clinic_appointment_result',
        subflowFailOnError: true,
      },
    },
    reschedule: {
      id: 'clinic-main-subflow-reschedule',
      type: 'subflow',
      position: { x: 200, y: 660 },
      data: {
        label: 'Remarcacao',
        subflowId: subflowIds.reschedule,
        subflowName: SUBFLOW_NAMES.reschedule,
        subflowResultKey: 'clinic_reschedule_result',
        subflowFailOnError: true,
      },
    },
    cancellation: {
      id: 'clinic-main-subflow-cancel',
      type: 'subflow',
      position: { x: 430, y: 660 },
      data: {
        label: 'Cancelamento',
        subflowId: subflowIds.cancellation,
        subflowName: SUBFLOW_NAMES.cancellation,
        subflowResultKey: 'clinic_cancel_result',
        subflowFailOnError: true,
      },
    },
    specialties: {
      id: 'clinic-main-subflow-specialties',
      type: 'subflow',
      position: { x: 660, y: 660 },
      data: {
        label: 'Especialidades',
        subflowId: subflowIds.specialties,
        subflowName: SUBFLOW_NAMES.specialties,
        subflowResultKey: 'clinic_specialties_result',
        subflowFailOnError: true,
      },
    },
    documents: {
      id: 'clinic-main-subflow-documents',
      type: 'subflow',
      position: { x: 890, y: 660 },
      data: {
        label: 'Documentos',
        subflowId: subflowIds.documents,
        subflowName: SUBFLOW_NAMES.documents,
        subflowResultKey: 'clinic_documents_result',
        subflowFailOnError: true,
      },
    },
    human: {
      id: 'clinic-main-subflow-human',
      type: 'subflow',
      position: { x: -420, y: 1020 },
      data: {
        label: 'Atendimento humano',
        subflowId: subflowIds.human,
        subflowName: SUBFLOW_NAMES.human,
        subflowResultKey: 'clinic_handoff_result',
        subflowFailOnError: false,
      },
    },
    stopAppointment: { id: 'clinic-main-stop-appointment', type: 'stop', position: { x: -20, y: 1190 }, data: { label: 'Fim' } },
    stopHuman: { id: 'clinic-main-stop-human', type: 'stop', position: { x: -420, y: 1190 }, data: { label: 'Fim' } },
    stopOther: { id: 'clinic-main-stop-other', type: 'stop', position: { x: 545, y: 850 }, data: { label: 'Fim' } },
  }

  return {
    startNodeId: nodes.start.id,
    meta: { kind: 'main' },
    nodes: Object.values(nodes),
    edges: [
      { source: nodes.start.id, target: nodes.note.id },
      { source: nodes.note.id, target: nodes.initial.id, sourceHandle: 'pointer' },
      { source: nodes.initial.id, target: nodes.intent.id },
      { source: nodes.intent.id, target: nodes.intake.id, sourceHandle: 'case:agendar' },
      { source: nodes.intent.id, target: nodes.reschedule.id, sourceHandle: 'case:remarcar' },
      { source: nodes.intent.id, target: nodes.cancellation.id, sourceHandle: 'case:cancelar' },
      { source: nodes.intent.id, target: nodes.specialties.id, sourceHandle: 'case:especialidades' },
      { source: nodes.intent.id, target: nodes.documents.id, sourceHandle: 'case:documentos' },
      { source: nodes.intent.id, target: nodes.human.id, sourceHandle: 'case:retorno' },
      { source: nodes.intent.id, target: nodes.human.id, sourceHandle: 'case:humano' },
      { source: nodes.intent.id, target: nodes.human.id, sourceHandle: 'default' },
      { source: nodes.intake.id, target: nodes.urgency.id },
      { source: nodes.urgency.id, target: nodes.human.id, sourceHandle: 'case:urgent' },
      { source: nodes.urgency.id, target: nodes.appointment.id, sourceHandle: 'case:non_urgent' },
      { source: nodes.urgency.id, target: nodes.human.id, sourceHandle: 'default' },
      { source: nodes.appointment.id, target: nodes.stopAppointment.id },
      { source: nodes.human.id, target: nodes.stopHuman.id },
      { source: nodes.reschedule.id, target: nodes.stopOther.id },
      { source: nodes.cancellation.id, target: nodes.stopOther.id },
      { source: nodes.specialties.id, target: nodes.stopOther.id },
      { source: nodes.documents.id, target: nodes.stopOther.id },
    ],
  }
}

async function ensureFlow(email: string, companiesId: string, flowName: string, flow: FlowData): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from('tb_flows')
    .select('id')
    .eq('companies_id', companiesId)
    .eq('name', flowName)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Buscar fluxo "${flowName}": ${existingError.message}`)
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('tb_flows')
      .update({ nodes: flow, user_email: email })
      .eq('id', existing.id)

    if (updateError) {
      throw new Error(`Atualizar fluxo "${flowName}": ${updateError.message}`)
    }

    return String(existing.id)
  }

  const { data, error } = await supabase
    .from('tb_flows')
    .insert({
      name: flowName,
      nodes: flow,
      user_email: email,
      companies_id: companiesId,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new Error(`Criar fluxo "${flowName}": ${error?.message || 'falha ao persistir fluxo'}`)
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

  throw new Error(
    'Integre uma conta Calendly ativa antes de provisionar o fluxo da clinica. O fluxo exige agendamento real pelo Calendly.'
  )
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

  const builderParams: FlowBuilderParams = {
    agentIds,
    crmIntegrationId,
    emailIntegrationId,
    teamNotifyEmail,
    appointmentProvider: calendlyProvisioning.provider,
    appointmentIntegrationId: calendlyProvisioning.integrationId,
  }

  const followupsFlow = createFollowupsSubflow()
  const followupsFlowId = await ensureFlow(
    normalizedEmail,
    identity.companyId,
    SUBFLOW_NAMES.followups,
    followupsFlow
  )

  const subflowDefinitions: Array<{ key: string; name: string; flow: FlowData }> = [
    { key: 'intake', name: SUBFLOW_NAMES.intake, flow: createIntakeTriageSubflow(builderParams) },
    {
      key: 'appointment',
      name: SUBFLOW_NAMES.appointment,
      flow: createAppointmentSubflow(builderParams, followupsFlowId),
    },
    { key: 'reschedule', name: SUBFLOW_NAMES.reschedule, flow: createRescheduleSubflow(builderParams) },
    { key: 'cancellation', name: SUBFLOW_NAMES.cancellation, flow: createCancellationSubflow(builderParams) },
    { key: 'documents', name: SUBFLOW_NAMES.documents, flow: createDocumentsSubflow(builderParams) },
    { key: 'specialties', name: SUBFLOW_NAMES.specialties, flow: createSpecialtiesSubflow(builderParams) },
    { key: 'human', name: SUBFLOW_NAMES.human, flow: createHumanHandoffSubflow(builderParams) },
  ]

  const subflowIds: Record<string, string> = {
    followups: followupsFlowId,
  }

  for (const definition of subflowDefinitions) {
    subflowIds[definition.key] = await ensureFlow(
      normalizedEmail,
      identity.companyId,
      definition.name,
      definition.flow
    )
  }

  const flow = createMainOrchestratorFlow(builderParams, subflowIds)
  const flowId = await ensureFlow(normalizedEmail, identity.companyId, FLOW_NAME, flow)

  logger.info('[flow-provision-medical-clinic] Demo provisionado', {
    userEmail: normalizedEmail,
    companyId: identity.companyId,
    flowId,
    subflowIds,
    appointmentProvider: calendlyProvisioning.provider,
    appointmentIntegrationId: calendlyProvisioning.integrationId || null,
  })

  return {
    flowId,
    flowName: FLOW_NAME,
    subflowIds,
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
