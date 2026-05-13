/**
 * Cria agentes especialistas e o fluxo demo "Clínica Médica — Atendimento Completo".
 *
 * Uso:
 *   OWNER_EMAIL=admin@suaempresa.com npx tsx scripts/seed-medical-clinic-demo.ts
 *
 * Opcionais:
 *   CRM_INTEGRATION_ID=uuid-do-hubspot
 *   EMAIL_INTEGRATION_ID=uuid-da-integracao-email
 *   TEAM_NOTIFY_EMAIL=recepcao@clinica.com.br
 */

import path from 'path'
import dotenv from 'dotenv'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const OWNER_EMAIL = String(process.env.OWNER_EMAIL || process.env.SEED_OWNER_EMAIL || '')
  .trim()
  .toLowerCase()
const CRM_INTEGRATION_ID = String(process.env.CRM_INTEGRATION_ID || '').trim()
const EMAIL_INTEGRATION_ID = String(process.env.EMAIL_INTEGRATION_ID || '').trim()
const TEAM_NOTIFY_EMAIL = String(process.env.TEAM_NOTIFY_EMAIL || 'recepcao@clinica.com.br').trim()
const FLOW_NAME = 'Clínica Médica — Atendimento Completo'

const ROLE_TEMPLATES = [
  {
    name: 'Clínica — Base Atendimento Inicial',
    description: 'Recepcionista digital inicial.',
    role: `Você é a recepcionista digital de uma clínica médica.
Seu objetivo é acolher, entender a intenção e devolver SEMPRE JSON válido em uma única linha.

Campos esperados:
{
  "intent":"agendar|remarcar|cancelar|especialidades|humano|documentos|retorno|outro",
  "channel_origin":"whatsapp",
  "handoff_reason":"texto curto ou vazio"
}

Regras:
- Linguagem acolhedora e profissional.
- Se o paciente pedir humano, marque intent=humano.
- Não diagnostique doenças.`,
  },
  {
    name: 'Clínica — Base Cadastro e CRM',
    description: 'Coleta dados faltantes do paciente.',
    role: `Você ajuda a completar cadastro de paciente para CRM.
Responda SEMPRE em JSON válido:
{
  "patient_name":"string ou vazio",
  "patient_email":"string ou vazio",
  "patient_phone":"string ou vazio",
  "patient_dob":"string ou vazio",
  "patient_lookup_status":"existing|new|incomplete",
  "triage_notes":"observações curtas"
}

Nunca invente dados ausentes.`,
  },
  {
    name: 'Clínica — Base Triagem',
    description: 'Sugere especialidade com segurança.',
    role: `Você faz triagem inicial de clínica médica sem diagnosticar.
Responda SEMPRE em JSON válido:
{
  "specialty":"clinica_geral|cardiologia|dermatologia|ginecologia|ortopedia|pediatria|endocrinologia|psiquiatria|psicologia|nutricao|outra",
  "specialty_confidence":"high|medium|low",
  "triage_notes":"resumo curto do motivo da consulta"
}

Nunca dê diagnóstico ou tratamento.`,
  },
  {
    name: 'Clínica — Base Urgência',
    description: 'Detecta sinais de emergência.',
    role: `Você avalia apenas sinais de urgência antes do agendamento.
Responda SEMPRE em JSON válido:
{
  "urgency_status":"urgent|non_urgent",
  "handoff_reason":"texto curto ou vazio",
  "triage_notes":"reforço curto da triagem"
}

Marque urgent quando houver sinais compatíveis com dor no peito, falta de ar intensa, desmaio, sangramento intenso, confusão mental, dor muito forte ou risco de vida.`,
  },
  {
    name: 'Clínica — Base Comunicação',
    description: 'Explica especialidades e próximos passos.',
    role: `Você responde dúvidas sobre especialidades médicas e orienta próximos passos de forma clara e humana.
Não diagnostique doenças, não interprete exames e não prescreva medicamentos.
Responda em texto curto, pronto para WhatsApp.`,
  },
  {
    name: 'Clínica — Base Suporte Humano',
    description: 'Explica transbordo para atendimento humano.',
    role: `Você informa que a equipe humana continuará o atendimento.
Responda em texto curto, acolhedor e objetivo, pronto para WhatsApp.`,
  },
]

const AGENTS = [
  {
    name: 'Sonia Clínica — Atendimento Inicial',
    template: 'Clínica — Base Atendimento Inicial',
    prompt:
      'Você é o primeiro contato da clínica. Identifique a intenção com linguagem acolhedora e objetiva. Saída sempre em JSON.',
  },
  {
    name: 'Sonia Clínica — Cadastro e CRM',
    template: 'Clínica — Base Cadastro e CRM',
    prompt:
      'Você coleta ou confirma dados de cadastro sem inventar nada. Saída sempre em JSON.',
  },
  {
    name: 'Sonia Clínica — Triagem',
    template: 'Clínica — Base Triagem',
    prompt:
      'Você organiza a demanda clínica e sugere a especialidade provável sem diagnosticar. Saída sempre em JSON.',
  },
  {
    name: 'Sonia Clínica — Urgência',
    template: 'Clínica — Base Urgência',
    prompt:
      'Você avalia apenas sinais de urgência e interrompe o fluxo quando necessário. Saída sempre em JSON.',
  },
  {
    name: 'Sonia Clínica — Comunicação',
    template: 'Clínica — Base Comunicação',
    prompt:
      'Você responde dúvidas sobre especialidades, orientações e retorno em texto curto.',
  },
  {
    name: 'Sonia Clínica — Suporte Humano',
    template: 'Clínica — Base Suporte Humano',
    prompt:
      'Você explica o encaminhamento para equipe humana em texto curto.',
  },
]

function unwrapRpcId(data: unknown): string {
  if (typeof data === 'string' && data) return data
  if (Array.isArray(data) && data[0] && typeof data[0].id === 'string') return data[0].id
  if (data && typeof data === 'object' && 'id' in data && typeof (data as { id: unknown }).id === 'string') {
    return (data as { id: string }).id
  }
  throw new Error(`Resposta RPC inesperada: ${JSON.stringify(data).slice(0, 200)}`)
}

async function getCompanyAndUser(supabase: SupabaseClient, email: string) {
  const { data: userRow, error: userError } = await supabase
    .from('tb_users')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (userError) throw userError
  if (!userRow?.id) throw new Error(`Usuário não encontrado em tb_users: ${email}`)

  const { data: companyUser, error: companyError } = await supabase
    .from('tb_company_users')
    .select('companies_id')
    .eq('user_id', userRow.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (companyError) throw companyError
  if (!companyUser?.companies_id) throw new Error(`Nenhuma empresa encontrada para ${email}`)

  return { userId: userRow.id as string, companiesId: companyUser.companies_id as string }
}

async function ensureTemplate(
  supabase: SupabaseClient,
  email: string,
  companiesId: string,
  def: (typeof ROLE_TEMPLATES)[number]
) {
  const { data: existing } = await supabase
    .from('tb_agents_templates')
    .select('id')
    .eq('name', def.name)
    .eq('companies_id', companiesId)
    .maybeSingle()
  if (existing?.id) return existing.id as string

  const { data, error } = await supabase.rpc('sp_create_agent_template', {
    p_name: def.name,
    p_role: def.role,
    p_description: def.description,
    p_icon: 'bot',
    p_complexity: 'Intermediate',
    p_channel_names: ['whatsapp', 'webchat', 'email'],
    p_skill_names: [],
    p_email: email,
  })
  if (error) throw error
  return unwrapRpcId(data)
}

async function ensureAgent(
  supabase: SupabaseClient,
  email: string,
  companiesId: string,
  name: string,
  roleTemplateId: string,
  personalityPrompt: string
) {
  const { data: existing } = await supabase
    .from('tb_agents')
    .select('id')
    .eq('nome', name)
    .eq('companies_id', companiesId)
    .maybeSingle()

  if (existing?.id) {
    await supabase
      .from('tb_agents')
      .update({
        personality_prompt: personalityPrompt,
        provider: 'openai',
        provider_model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 1200,
      })
      .eq('id', existing.id)
    return existing.id as string
  }

  const { data, error } = await supabase.rpc('sp_create_agent_by_email', {
    p_email: email,
    p_nome: name,
    p_role_template_id: roleTemplateId,
    p_primary_language: 'pt-BR',
    p_bio: 'Agente especialista do fluxo demo de clínica médica.',
    p_integrations_id: null,
  })
  if (error) throw error
  const id = unwrapRpcId(data)
  await supabase
    .from('tb_agents')
    .update({
      personality_prompt: personalityPrompt,
      provider: 'openai',
      provider_model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 1200,
    })
    .eq('id', id)
  return id
}

function buildFlowPayload(agentIds: Record<string, string>) {
  const n = {
    start: { id: 'n-start', type: 'start', position: { x: 80, y: 0 }, data: { label: 'Início' } },
    overview: {
      id: 'n-overview',
      type: 'comment',
      position: { x: 40, y: 110 },
      data: { label: 'Visão geral', comment: 'Fluxo demo WhatsApp-first para clínica médica com CRM, triagem, urgência, agenda mock, documentos, handoff e follow-up.' },
    },
    initial: {
      id: 'n-initial',
      type: 'agent',
      position: { x: 80, y: 240 },
      data: {
        label: 'Agente de Atendimento Inicial',
        executionMode: 'agent',
        agentId: agentIds.initial,
        agentName: 'Sonia Clínica — Atendimento Inicial',
        additionalInstructions: 'Classifique a intenção em intent e normalize channel_origin=whatsapp.',
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
        crmIntegrationId: CRM_INTEGRATION_ID,
        lookupFields: ['patient_phone', 'patient_email', 'patient_cpf'],
        requiredFields: ['patient_name', 'patient_email', 'patient_phone'],
        originTag: 'Atendimento IA Clínica',
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
        agentId: agentIds.crm,
        agentName: 'Sonia Clínica — Cadastro e CRM',
        additionalInstructions: 'Se faltarem dados, organize patient_name, patient_email, patient_phone, patient_dob e patient_lookup_status.',
      },
    },
    crmCreate: {
      id: 'n-crm-create',
      type: 'crm_contact',
      position: { x: -520, y: 1050 },
      data: {
        label: 'Criar paciente',
        crmOperation: 'create',
        crmIntegrationId: CRM_INTEGRATION_ID,
        requiredFields: ['patient_name', 'patient_email', 'patient_phone'],
        originTag: 'Atendimento IA Clínica',
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
        crmIntegrationId: CRM_INTEGRATION_ID,
        requiredFields: ['patient_name', 'patient_email', 'patient_phone'],
        originTag: 'Atendimento IA Clínica',
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
        agentId: agentIds.triage,
        agentName: 'Sonia Clínica — Triagem',
        additionalInstructions: 'Normalize specialty, specialty_confidence e triage_notes.',
      },
    },
    urgencyAgent: {
      id: 'n-urgency-agent',
      type: 'agent',
      position: { x: -260, y: 1370 },
      data: {
        label: 'Agente de Urgência',
        executionMode: 'agent',
        agentId: agentIds.urgency,
        agentName: 'Sonia Clínica — Urgência',
        additionalInstructions: 'Normalize urgency_status e handoff_reason.',
      },
    },
    urgencySwitch: {
      id: 'n-urgency-switch',
      type: 'switch',
      position: { x: -260, y: 1530 },
      data: {
        label: 'Urgência?',
        branchField: 'urgency_status',
        switchDefaultLabel: 'Falha',
        switchCases: [
          { id: 'urgent', label: 'Urgente', value: 'urgent' },
          { id: 'non_urgent', label: 'Não urgente', value: 'non_urgent' },
        ],
      },
    },
    urgentHandoff: {
      id: 'n-urgent-handoff',
      type: 'human_handoff',
      position: { x: -520, y: 1710 },
      data: {
        label: 'Encaminhar urgência',
        handoffReasonField: 'handoff_reason',
        handoffPriority: 'urgent',
        notifyEmail: TEAM_NOTIFY_EMAIL,
        patientMessage: 'Identificamos um possível sinal de urgência. Procure atendimento emergencial imediatamente e nossa equipe humana seguirá acompanhando você.',
      },
    },
    appointmentAvailability: {
      id: 'n-appointment-availability',
      type: 'appointment',
      position: { x: -260, y: 1710 },
      data: {
        label: 'Consultar disponibilidade',
        appointmentOperation: 'availability',
        appointmentProvider: 'mock_calendly',
        specialtyField: 'specialty',
        doctorField: 'doctor_name',
        consultationTypeField: 'consultation_type',
        unitField: 'clinic_unit',
        periodField: 'preferred_period',
        preferredDateField: 'preferred_date',
      },
    },
    appointmentStatus: {
      id: 'n-appointment-status',
      type: 'switch',
      position: { x: -260, y: 1870 },
      data: {
        label: 'Há horários?',
        branchField: 'appointment_status',
        switchDefaultLabel: 'Falha',
        switchCases: [
          { id: 'available', label: 'Disponível', value: 'available' },
          { id: 'unavailable', label: 'Indisponível', value: 'unavailable' },
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
        appointmentProvider: 'mock_calendly',
        specialtyField: 'specialty',
        doctorField: 'doctor_name',
        consultationTypeField: 'consultation_type',
        unitField: 'clinic_unit',
        periodField: 'preferred_period',
        preferredDateField: 'preferred_date',
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
        label: 'WhatsApp confirmação',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText: 'Consulta agendada com sucesso. Especialidade: {{specialty}}. Data e hora: {{appointment_slot.startsAt}}. Se precisar, responda a esta mensagem para remarcar.',
        waIntegrationId: '',
      },
    },
    emailConfirm: {
      id: 'n-email-confirm',
      type: 'email_send',
      position: { x: -520, y: 2530 },
      data: {
        label: 'Email confirmação',
        emailIntegrationId: EMAIL_INTEGRATION_ID,
        emailTo: '{{patient_email}}',
        emailSubject: 'Confirmação da consulta — {{specialty}}',
        emailText: 'Sua consulta foi agendada.\nEspecialidade: {{specialty}}\nData: {{appointment_slot.startsAt}}\nLocal ou link: {{appointment_slot.location}}',
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
        waMessageText: 'Lembrete: sua consulta acontece em aproximadamente 24 horas. Responda aqui se precisar de ajuda.',
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
        waMessageText: 'Sua consulta está se aproximando. Faltam cerca de 2 horas para o atendimento.',
        waReminderAt: '{{appointment_reminder_2h_at}}',
        waIntegrationId: '',
      },
    },
    scheduleFollowup: {
      id: 'n-schedule-followup',
      type: 'schedule',
      position: { x: -520, y: 3280 },
      data: {
        label: 'Follow-up pós consulta',
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
        waMessageText: 'Esperamos que sua consulta tenha corrido bem. Se desejar, podemos ajudar a organizar um retorno.',
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
        waMessageText: 'No momento não encontramos horários próximos. Podemos registrar seu interesse na lista de espera.',
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
        notifyEmail: TEAM_NOTIFY_EMAIL,
        patientMessage: 'Nossa equipe vai verificar alternativas de agenda e retornará em breve.',
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
        waMessageText: 'Percebemos que o agendamento não foi concluído. Se quiser, posso retomar por aqui.',
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
        appointmentProvider: 'mock_calendly',
        specialtyField: 'specialty',
        doctorField: 'doctor_name',
        consultationTypeField: 'consultation_type',
        unitField: 'clinic_unit',
        periodField: 'preferred_period',
        preferredDateField: 'preferred_date',
      },
    },
    cancelBranch: {
      id: 'n-cancel-branch',
      type: 'appointment',
      position: { x: 220, y: 560 },
      data: {
        label: 'Cancelar consulta',
        appointmentOperation: 'cancel',
        appointmentProvider: 'mock_calendly',
        specialtyField: 'specialty',
        doctorField: 'doctor_name',
        consultationTypeField: 'consultation_type',
        unitField: 'clinic_unit',
        periodField: 'preferred_period',
        preferredDateField: 'preferred_date',
      },
    },
    rescheduleNotify: {
      id: 'n-reschedule-notify',
      type: 'whatsapp_message',
      position: { x: -20, y: 720 },
      data: {
        label: 'Confirmação remarcação',
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
        label: 'Confirmação cancelamento',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText: 'Sua consulta foi cancelada. Se desejar, podemos ajudar a reagendar futuramente.',
        waIntegrationId: '',
      },
    },
    specialtyAgent: {
      id: 'n-specialty-agent',
      type: 'agent',
      position: { x: 480, y: 560 },
      data: {
        label: 'Agente de Comunicação',
        executionMode: 'agent',
        agentId: agentIds.communication,
        agentName: 'Sonia Clínica — Comunicação',
        additionalInstructions: 'Explique especialidades disponíveis e sugira próximos passos em texto curto.',
      },
    },
    documentsLookup: {
      id: 'n-documents-lookup',
      type: 'crm_contact',
      position: { x: 720, y: 560 },
      data: {
        label: 'Identificar paciente para documentos',
        crmOperation: 'lookup',
        crmIntegrationId: CRM_INTEGRATION_ID,
        lookupFields: ['patient_phone', 'patient_email', 'patient_cpf'],
        requiredFields: ['patient_name', 'patient_email', 'patient_phone'],
        originTag: 'Atendimento IA Clínica',
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
        notifyEmail: TEAM_NOTIFY_EMAIL,
        patientMessage: 'Recebemos sua solicitação. Nossa equipe vai conferir os documentos e retornar se precisar de algo mais.',
      },
    },
    returnMessage: {
      id: 'n-return-message',
      type: 'whatsapp_message',
      position: { x: 960, y: 560 },
      data: {
        label: 'Solicitação de retorno',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText: 'Registramos seu pedido de retorno. Nossa equipe vai falar com você o quanto antes.',
        waIntegrationId: '',
      },
    },
    humanDirect: {
      id: 'n-human-direct',
      type: 'human_handoff',
      position: { x: 1200, y: 560 },
      data: {
        label: 'Transferência direta',
        handoffReasonField: 'handoff_reason',
        handoffPriority: 'medium',
        notifyEmail: TEAM_NOTIFY_EMAIL,
        patientMessage: 'Vou encaminhar você para nossa equipe humana agora.',
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
        notifyEmail: TEAM_NOTIFY_EMAIL,
        patientMessage: 'Seu pedido precisa de apoio da nossa equipe humana. Vamos continuar o atendimento por lá.',
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

  const nodes = Object.values(n)
  const edges = [
    { source: n.start.id, target: n.overview.id },
    { source: n.overview.id, target: n.initial.id, sourceHandle: 'pointer' },
    { source: n.initial.id, target: n.intentSwitch.id },
    { source: n.intentSwitch.id, target: n.crmLookup.id, sourceHandle: 'case:agendar' },
    { source: n.intentSwitch.id, target: n.rescheduleBranch.id, sourceHandle: 'case:remarcar' },
    { source: n.intentSwitch.id, target: n.cancelBranch.id, sourceHandle: 'case:cancelar' },
    { source: n.intentSwitch.id, target: n.specialtyAgent.id, sourceHandle: 'case:especialidades' },
    { source: n.intentSwitch.id, target: n.documentsLookup.id, sourceHandle: 'case:documentos' },
    { source: n.intentSwitch.id, target: n.returnMessage.id, sourceHandle: 'case:retorno' },
    { source: n.intentSwitch.id, target: n.humanDirect.id, sourceHandle: 'case:humano' },
    { source: n.intentSwitch.id, target: n.defaultHandoff.id, sourceHandle: 'default' },

    { source: n.crmLookup.id, target: n.patientStatus.id },
    { source: n.patientStatus.id, target: n.cadastroAgent.id, sourceHandle: 'case:new' },
    { source: n.patientStatus.id, target: n.crmUpdate.id, sourceHandle: 'case:existing' },
    { source: n.patientStatus.id, target: n.cadastroAgent.id, sourceHandle: 'case:incomplete' },
    { source: n.patientStatus.id, target: n.scheduleAbandonment.id, sourceHandle: 'default' },
    { source: n.cadastroAgent.id, target: n.crmCreate.id },
    { source: n.crmCreate.id, target: n.triageAgent.id },
    { source: n.crmUpdate.id, target: n.triageAgent.id },
    { source: n.triageAgent.id, target: n.urgencyAgent.id },
    { source: n.urgencyAgent.id, target: n.urgencySwitch.id },
    { source: n.urgencySwitch.id, target: n.urgentHandoff.id, sourceHandle: 'case:urgent' },
    { source: n.urgencySwitch.id, target: n.appointmentAvailability.id, sourceHandle: 'case:non_urgent' },
    { source: n.urgencySwitch.id, target: n.humanDirect.id, sourceHandle: 'default' },
    { source: n.urgentHandoff.id, target: n.stopI.id },

    { source: n.appointmentAvailability.id, target: n.appointmentStatus.id },
    { source: n.appointmentStatus.id, target: n.appointmentBook.id, sourceHandle: 'case:available' },
    { source: n.appointmentStatus.id, target: n.unavailableMessage.id, sourceHandle: 'case:unavailable' },
    { source: n.appointmentStatus.id, target: n.humanDirect.id, sourceHandle: 'default' },
    { source: n.appointmentBook.id, target: n.appointmentConfirmed.id },
    { source: n.appointmentConfirmed.id, target: n.waConfirm.id, sourceHandle: 'true' },
    { source: n.appointmentConfirmed.id, target: n.humanDirect.id, sourceHandle: 'false' },
    { source: n.waConfirm.id, target: n.emailConfirm.id },
    { source: n.emailConfirm.id, target: n.schedule24h.id },
    { source: n.schedule24h.id, target: n.waReminder24h.id },
    { source: n.waReminder24h.id, target: n.schedule2h.id },
    { source: n.schedule2h.id, target: n.waReminder2h.id },
    { source: n.waReminder2h.id, target: n.scheduleFollowup.id },
    { source: n.scheduleFollowup.id, target: n.waFollowup.id },
    { source: n.waFollowup.id, target: n.stopA.id },

    { source: n.unavailableMessage.id, target: n.unavailableHandoff.id },
    { source: n.unavailableHandoff.id, target: n.stopB.id },
    { source: n.scheduleAbandonment.id, target: n.abandonmentMessage.id },
    { source: n.abandonmentMessage.id, target: n.stopC.id },

    { source: n.rescheduleBranch.id, target: n.rescheduleNotify.id },
    { source: n.rescheduleNotify.id, target: n.stopC.id },
    { source: n.cancelBranch.id, target: n.cancelNotify.id },
    { source: n.cancelNotify.id, target: n.stopC.id },

    { source: n.specialtyAgent.id, target: n.stopD.id },
    { source: n.documentsLookup.id, target: n.documentIntake.id },
    { source: n.documentIntake.id, target: n.documentsNotify.id },
    { source: n.documentsNotify.id, target: n.stopE.id },
    { source: n.returnMessage.id, target: n.stopF.id },
    { source: n.humanDirect.id, target: n.stopG.id },
    { source: n.defaultHandoff.id, target: n.stopH.id },
  ]

  return {
    startNodeId: n.start.id,
    nodes,
    edges,
  }
}

async function ensureFlow(
  supabase: SupabaseClient,
  email: string,
  companiesId: string,
  nodesJson: ReturnType<typeof buildFlowPayload>
) {
  const { data: existing } = await supabase
    .from('tb_flows')
    .select('id')
    .eq('companies_id', companiesId)
    .eq('name', FLOW_NAME)
    .maybeSingle()

  const payload = {
    name: FLOW_NAME,
    nodes: nodesJson,
    user_email: email,
    companies_id: companiesId,
  }

  if (existing?.id) {
    const { error } = await supabase.from('tb_flows').update({ nodes: nodesJson }).eq('id', existing.id)
    if (error) throw error
    return existing.id as string
  }

  const { data, error } = await supabase.from('tb_flows').insert(payload).select('id').single()
  if (error) throw error
  return data.id as string
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRole) {
    throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env do BackEnd.')
  }
  if (!OWNER_EMAIL) {
    throw new Error('Defina OWNER_EMAIL (ou SEED_OWNER_EMAIL) para o seed da clínica.')
  }

  const supabase = createClient(supabaseUrl, serviceRole)
  const { companiesId } = await getCompanyAndUser(supabase, OWNER_EMAIL)

  const templateIds: Record<string, string> = {}
  for (const template of ROLE_TEMPLATES) {
    templateIds[template.name] = await ensureTemplate(supabase, OWNER_EMAIL, companiesId, template)
  }

  const agentIds: Record<string, string> = {}
  for (const agent of AGENTS) {
    const templateId = templateIds[agent.template]
    agentIds[
      agent.name.includes('Atendimento Inicial')
        ? 'initial'
        : agent.name.includes('Cadastro')
          ? 'crm'
          : agent.name.includes('Triagem')
            ? 'triage'
            : agent.name.includes('Urgência')
              ? 'urgency'
              : agent.name.includes('Comunicação')
                ? 'communication'
                : 'human'
    ] = await ensureAgent(supabase, OWNER_EMAIL, companiesId, agent.name, templateId, agent.prompt)
  }

  const flowId = await ensureFlow(supabase, OWNER_EMAIL, companiesId, buildFlowPayload(agentIds))
  console.log(`Fluxo criado/atualizado: ${FLOW_NAME}`)
  console.log(`Flow ID: ${flowId}`)
  console.log(`CRM Integration ID usado: ${CRM_INTEGRATION_ID || '(preencher depois no editor)'}`)
  console.log(`Email Integration ID usado: ${EMAIL_INTEGRATION_ID || '(preencher depois no editor)'}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

