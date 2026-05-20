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
  teamNotifyWhatsApp?: string | null
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

type FlowStopScope = 'flow' | 'subflow' | 'step'

const STOP_SCOPE_LABELS: Record<FlowStopScope, string> = {
  subflow: 'Saída do subfluxo',
  flow: 'Fim',
  step: 'Próximo passo',
}

const LEGACY_STOP_LABELS = new Set([
  'fim',
  'fim do fluxo',
  'fim do subfluxo',
  'fim subfluxo',
  'saida do subfluxo',
  'saída do subfluxo',
  'retornar ao fluxo principal',
  'encerrar atendimento',
  'encerra este fluxo por completo',
  'proximo passo',
  'próximo passo',
  'finaliza a execução',
  'finaliza a execucao',
])

function buildStopNode(id: string, position: { x: number; y: number }, stopScope: FlowStopScope, label?: string) {
  return {
    id,
    type: 'stop' as const,
    position,
    data: {
      label: label || STOP_SCOPE_LABELS[stopScope],
      stopScope,
    },
  }
}

function resolveFlowStopScope(flow: FlowData, node: FlowData['nodes'][number]): FlowStopScope {
  const explicit = String(node.data?.stopScope || '').trim().toLowerCase()
  if (explicit === 'flow' || explicit === 'subflow' || explicit === 'step') {
    return explicit
  }
  if (flow.meta?.kind === 'subflow') {
    return 'subflow'
  }
  return 'flow'
}

function normalizeStopNodesInFlow(flow: FlowData): FlowData {
  const nodes = flow.nodes.map((node) => {
    if (node.type !== 'stop') {
      return node
    }

    const stopScope = resolveFlowStopScope(flow, node)
    const currentLabel = String(node.data?.label || '').trim()
    const shouldReplaceLabel = !currentLabel || LEGACY_STOP_LABELS.has(currentLabel.toLowerCase())

    return {
      ...node,
      data: {
        ...node.data,
        stopScope,
        label: shouldReplaceLabel ? STOP_SCOPE_LABELS[stopScope] : currentLabel,
      },
    }
  })

  return {
    ...flow,
    nodes,
  }
}

const ROLE_TEMPLATES: RoleTemplateDefinition[] = [
  {
    name: 'Clinica - Base Atendimento Inicial',
    description: 'Recepcionista digital inicial com roteamento seguro por intencao.',
    role: `Voce e a recepcionista digital de uma clinica medica no WhatsApp.
IMPORTANTE: um motor de fluxo (nao voce) executa cadastro, triagem, agenda Calendly e handoff. Voce classifica intencao e acolhe; nao invente etapas paralelas.

Menu oficial (use exatamente esta ordem se precisar apresentar opcoes):
1 = agendar consulta
2 = conhecer especialidades
3 = enviar documentos ou exames
4 = falar com atendente humano

Formato de resposta (obrigatorio):
Mensagem ao paciente: texto curto, natural, pronto para WhatsApp.
Dados internos:
intent=agendar|remarcar|cancelar|especialidades|humano|documentos|retorno|outro
channel_origin=whatsapp
handoff_reason=
patient_phone=
patient_email=
patient_name=

Classificacao de intent:
- agendar: marcar consulta, "quero agendar", "gostaria de agendar", envio de nome+email+telefone+especialidade, escolha de horario.
- remarcar: mudar data/horario/medico de consulta existente.
- cancelar: desmarcar consulta.
- especialidades: duvidas sobre areas medicas, "quais especialidades", informacoes gerais (sem pedir agendamento agora).
- documentos: exames, laudos, guias, arquivos.
- retorno: acompanhamento pos-consulta, retorno medico.
- humano: pedido explicito de pessoa, reclamacao, convenio/autorizacao complexa, irritacao, fora do escopo.
- outro: ambiguo; peca esclarecimento em 1 pergunta curta.

Regras criticas:
- NUNCA peca endereco, CPF, data de nascimento ou formulario longo no atendimento inicial.
- NUNCA invente menu diferente do oficial acima.
- Se o paciente enviar dados de cadastro (nome, email, telefone), classifique intent=agendar e repita os dados nos campos internos.
- Se o paciente responder apenas com numero 1-4, mapeie para o intent correspondente do menu.
- Nao diagnostique, nao prescreva, nao interprete exames.
- Urgencia/emergencia: intent=humano, handoff_reason=urgencia, oriente pronto-socorro na mensagem ao paciente.`,
  },
  {
    name: 'Clinica - Base Cadastro e CRM',
    description: 'Coleta, confirma e normaliza dados cadastrais para HubSpot.',
    role: `Voce e o agente de Cadastro e CRM da clinica (uso reserva; o fluxo usa mensagens automaticas).
Campos obrigatorios: patient_name, patient_email, patient_phone.
Proibido pedir ou confirmar: endereco, data de nascimento, CPF.
Se o paciente disser "esta correto" ou "sim", e faltar email, peca APENAS o email.
Nunca repita listas longas de confirmacao.`,
  },
  {
    name: 'Clinica - Base Triagem',
    description: 'Triagem inicial sem diagnostico, com sugestao de especialidade.',
    role: `Voce e o agente de Triagem Inicial da clinica.
Voce organiza a demanda e sugere a especialidade provavel, sem diagnosticar.
Responda sempre separando a mensagem humana dos dados internos do fluxo.

Formato de resposta:
Mensagem ao paciente: escreva uma mensagem curta, natural e pronta para WhatsApp.
Dados internos:
specialty=clinica_geral|cardiologia
specialty_confidence=high|medium|low
consultation_type=presencial|online|indefinido
clinic_unit=
preferred_period=manha|tarde|noite|indefinido
preferred_date=
doctor_name=
triage_notes=

Especialidades disponíveis neste ambiente (agendamento automatico):
- clinica_geral: sintomas gerais, check-up, duvida ampla, primeira avaliacao.
- cardiologia: pressao, coracao, palpitacao, dor no peito sem emergencia, acompanhamento cardiaco.

Regras:
- Nao peca novamente nome, email, telefone, endereco ou data de nascimento.
- Se nome, email e telefone ja estiverem no contexto, pergunte APENAS qual especialidade medica o paciente deseja.
- Nao de diagnostico, tratamento, interpretacao de exames ou promessa de cura.
- Somente clinica_geral e cardiologia sao suportados para agendamento automatico. Se o paciente pedir outra especialidade, informe que o agendamento automatico esta disponivel apenas para Clinica geral e Cardiologia e peca para escolher uma dessas duas.
- Se a especialidade for incerta, use specialty_confidence=low e sugira clinica_geral.
- Se o paciente citar preferencia de dia, periodo, medico, unidade ou consulta online/presencial, preencha os campos correspondentes.
- Na mensagem ao paciente, confirme o direcionamento de forma segura e avise que a avaliacao final sera feita pelo profissional.`,
  },
  {
    name: 'Clinica - Base Urgencia',
    description: 'Detecta sinais de urgencia e interrompe agendamento quando necessario.',
    role: `Voce e o agente de Seguranca e Urgencia.
Sua funcao e identificar sinais de emergencia antes de qualquer agendamento.
Responda sempre separando a mensagem humana dos dados internos do fluxo.

Formato de resposta:
Mensagem ao paciente: escreva uma mensagem curta, natural e pronta para WhatsApp.
Dados internos:
urgency_status=urgent|non_urgent
handoff_reason=
triage_notes=

Marque urgency_status=urgent se houver qualquer indicio de:
- dor no peito intensa ou persistente;
- falta de ar intensa;
- desmaio, convulsao ou perda de consciencia;
- sangramento intenso;
- confusao mental importante;
- dor muito forte ou pior dor da vida;
- sintomas neurologicos subitos, como fraqueza de um lado, fala enrolada, perda de visao;
- risco de vida, tentativa de autoagressao ou emergencia declarada.

Regras:
- Nao minimize sintomas graves.
- Nao peca dados cadastrais nem especialidade; isso ja foi tratado em etapas anteriores.
- Se urgent, a mensagem ao paciente deve orientar procurar atendimento emergencial imediatamente e informar que a equipe humana sera acionada.
- Se non_urgent, a mensagem ao paciente deve ser breve e permitir continuar para agenda.
- Nao diagnostique e nao prescreva.`,
  },
  {
    name: 'Clinica - Base Comunicacao',
    description: 'Comunica especialidades, orientacoes pre-consulta e proximos passos.',
    role: `Voce e o agente de Comunicacao da clinica no WhatsApp.
O fluxo automatico so agenda Clínica geral e Cardiologia via Calendly. Outras especialidades: explique com empatia e convide a escolher 1 ou 2, ou falar com humano.

Especialidades com agendamento automatico:
1. Clinica geral
2. Cardiologia

Ao listar especialidades, seja factual e curto. Ao final, sempre diga:
"Para agendar, responda *quero agendar* ou digite *1*."

Proibido:
- diagnosticar, prescrever, interpretar exames, prometer cura;
- inventar horarios ou confirmar agenda (isso e feito pelo fluxo/Calendly);
- pedir endereco, CPF ou data de nascimento.

Se o paciente quiser agendar apos ver especialidades, confirme que vai iniciar o agendamento e nao repita listas longas.`,
  },
  {
    name: 'Clinica - Base Suporte Humano',
    description: 'Conduz transferencia para atendimento humano com contexto e seguranca.',
    role: `Voce e o agente de Suporte Humano da clinica.
Responda em texto natural para WhatsApp, curto, acolhedor e objetivo.

Use quando:
- o paciente pedir uma pessoa;
- houver irritacao, confusao, reclamacao ou tema sensivel;
- o assunto envolver valores, convenio, autorizacao, documentos complexos;
- uma integracao falhar;
- houver sinal de urgencia.

Regras:
- Informe que a equipe humana continuara o atendimento.
- Se for urgencia, oriente procurar atendimento emergencial imediatamente.
- Nao prometa prazo exato se ele nao estiver no contexto.
- Nao exponha dados sensiveis.
- Nao diagnostique, nao prescreva e nao interprete exames.`,
  },
]

const AGENTS: AgentDefinition[] = [
  {
    key: 'initial',
    name: 'Sonia Clinica - Atendimento Inicial',
    template: 'Clinica - Base Atendimento Inicial',
    prompt:
      'Voce e o primeiro contato da clinica. Classifique a intencao, preserve dados informados e separe mensagem ao paciente dos dados internos do fluxo.',
  },
  {
    key: 'crm',
    name: 'Sonia Clinica - Cadastro e CRM',
    template: 'Clinica - Base Cadastro e CRM',
    prompt:
      'Cadastro: somente nome, email e telefone. Nunca endereco ou data de nascimento. Se faltar email apos confirmacao, peca so o email.',
  },
  {
    key: 'triage',
    name: 'Sonia Clinica - Triagem',
    template: 'Clinica - Base Triagem',
    prompt:
      'Voce organiza a demanda clinica, sugere especialidade provavel e captura preferencias de agenda, sem diagnosticar. Separe mensagem ao paciente dos dados internos.',
  },
  {
    key: 'urgency',
    name: 'Sonia Clinica - Urgencia',
    template: 'Clinica - Base Urgencia',
    prompt:
      'Voce avalia sinais de urgencia antes da agenda. Se houver risco, marque urgent nos dados internos, explique procurar emergencia e acione handoff.',
  },
  {
    key: 'communication',
    name: 'Sonia Clinica - Comunicacao',
    template: 'Clinica - Base Comunicacao',
    prompt:
      'Voce responde duvidas sobre especialidades, orientacoes, documentos e retorno com linguagem segura para WhatsApp.',
  },
  {
    key: 'human',
    name: 'Sonia Clinica - Suporte Humano',
    template: 'Clinica - Base Suporte Humano',
    prompt:
      'Voce explica o encaminhamento para equipe humana com acolhimento, seguranca e contexto do motivo.',
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
    const { error: updateError } = await supabase
      .from('tb_agents_templates')
      .update({
        role: definition.role,
        description: definition.description.slice(0, 800),
        icon: 'bot',
        complexity: 'Advanced',
      })
      .eq('id', existing.id)
      .eq('companies_id', companiesId)

    if (updateError) {
      throw new Error(`Atualizar template "${definition.name}": ${updateError.message}`)
    }

    return String(existing.id)
  }

  const { data, error } = await supabase.rpc('sp_create_agent_template', {
    p_name: definition.name,
    p_role: definition.role,
    p_description: definition.description,
    p_icon: 'bot',
    p_complexity: 'Advanced',
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
  teamNotifyWhatsApp: string
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
        notifyWhatsApp: params.teamNotifyWhatsApp,
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
          'Lembrete da clinica: sua consulta esta marcada para {{appointment_slot.startsAt}}.\n\nEspecialidade: {{specialty}}\nLocal/link: {{appointment_slot.location}}\n\nSe precisar remarcar ou cancelar, responda esta mensagem.',
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
        waMessageText:
          'Sua consulta esta se aproximando. Faltam cerca de 2 horas.\n\nTenha documentos, exames e informacoes importantes em maos. Se for presencial, considere chegar com antecedencia.',
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
          'Esperamos que sua consulta tenha corrido bem. Se o profissional indicou retorno ou acompanhamento, responda esta mensagem e ajudamos a organizar o proximo agendamento.',
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
        notifyWhatsApp: params.teamNotifyWhatsApp,
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
        notifyWhatsApp: params.teamNotifyWhatsApp,
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
        notifyWhatsApp: params.teamNotifyWhatsApp,
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
        notifyWhatsApp: params.teamNotifyWhatsApp,
        patientMessage:
          'Seu pedido precisa de apoio da nossa equipe humana. Vamos continuar o atendimento por la.',
      },
    },
    stopA: buildStopNode('n-stop-a', { x: -520, y: 3600 }, 'flow'),
    stopB: buildStopNode('n-stop-b', { x: 0, y: 2360 }, 'flow'),
    stopC: buildStopNode('n-stop-c', { x: 240, y: 880 }, 'flow'),
    stopD: buildStopNode('n-stop-d', { x: 480, y: 720 }, 'flow'),
    stopE: buildStopNode('n-stop-e', { x: 720, y: 1040 }, 'flow'),
    stopF: buildStopNode('n-stop-f', { x: 960, y: 720 }, 'flow'),
    stopG: buildStopNode('n-stop-g', { x: 1200, y: 720 }, 'flow'),
    stopH: buildStopNode('n-stop-h', { x: 1440, y: 720 }, 'flow'),
    stopI: buildStopNode('n-stop-i', { x: -520, y: 1860 }, 'flow'),
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
  teamNotifyWhatsApp: string
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
        useDeterministicIntake: true,
        additionalInstructions:
          'Fluxo deterministico: nome, email e telefone apenas. Sem endereco ou data de nascimento.',
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
        useDeterministicIntake: true,
        additionalInstructions:
          'Fluxo deterministico: pergunte somente especialidade (menu 1-2: Clinica geral ou Cardiologia). Nao repita cadastro.',
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
        useDeterministicIntake: true,
        additionalInstructions: 'Fluxo deterministico: urgency_status=non_urgent para agendamento padrao.',
      },
    },
    stop: buildStopNode('sf-intake-stop', { x: 80, y: 1300 }, 'subflow'),
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
          'Lembrete da clinica: sua consulta esta marcada para {{appointment_slot.startsAt}}.\n\nEspecialidade: {{specialty}}\nLocal/link: {{appointment_slot.location}}\n\nSe precisar remarcar ou cancelar, responda esta mensagem.',
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
        waMessageText:
          'Sua consulta esta se aproximando. Faltam cerca de 2 horas.\n\nTenha documentos, exames e informacoes importantes em maos. Se for presencial, considere chegar com antecedencia.',
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
          'Esperamos que sua consulta tenha corrido bem. Se o profissional indicou retorno ou acompanhamento, responda esta mensagem e ajudamos a organizar o proximo agendamento.',
        waIntegrationId: '',
      },
    },
    stop: buildStopNode('sf-followups-stop', { x: 80, y: 1270 }, 'subflow'),
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
          'Consulta disponibilidade no Calendly, apresenta horarios ao paciente, confirma a escolha e dispara comunicacoes.',
      },
    },
    specialty: {
      id: 'sf-appointment-specialty',
      type: 'agent',
      position: { x: 80, y: 280 },
      data: {
        label: 'Confirmar especialidade',
        executionMode: 'agent',
        agentId: params.agentIds.triage,
        agentName: 'Sonia Clinica - Triagem',
        useDeterministicIntake: true,
        additionalInstructions:
          'Fluxo deterministico: use a especialidade do contexto quando existir. Caso contrario, pergunte apenas a especialidade medica desejada e preencha specialty.',
      },
    },
    availability: {
      id: 'sf-appointment-availability',
      type: 'appointment',
      position: { x: 80, y: 440 },
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
    chooseSlotMessage: {
      id: 'sf-appointment-choose-slot',
      type: 'whatsapp_message',
      position: { x: -120, y: 640 },
      data: {
        label: 'Enviar opcoes de horario',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText:
          'Encontrei horarios disponiveis para {{specialty}}.\n\nResponda com o numero da opcao desejada para eu confirmar o agendamento.',
        waIntegrationId: '',
      },
    },
    book: {
      id: 'sf-appointment-book',
      type: 'appointment',
      position: { x: -120, y: 800 },
      data: {
        label: 'Criar agendamento',
        appointmentOperation: 'book',
        ...appointmentData,
      },
    },
    confirmed: {
      id: 'sf-appointment-confirmed',
      type: 'switch',
      position: { x: -120, y: 960 },
      data: {
        label: 'Status do agendamento',
        branchField: 'appointment_status',
        switchDefaultLabel: 'Falha',
        switchCases: [
          { id: 'confirmed', label: 'Confirmado', value: 'confirmed' },
          { id: 'incomplete', label: 'Aguardando escolha', value: 'incomplete' },
        ],
      },
    },
    waConfirm: {
      id: 'sf-appointment-wa-confirm',
      type: 'whatsapp_message',
      position: { x: -350, y: 1140 },
      data: {
        label: 'Confirmacao WhatsApp',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText:
          'Consulta agendada com sucesso.\n\nPaciente: {{patient_name}}\nEspecialidade: {{specialty}}\nData e horario: {{appointment_slot.startsAt}}\nTipo: {{appointment_slot.mode}}\nLocal/link: {{appointment_slot.location}}\n\nSe precisar remarcar ou cancelar, responda esta mensagem para continuarmos por aqui.',
        waIntegrationId: '',
      },
    },
    emailConfirm: {
      id: 'sf-appointment-email-confirm',
      type: 'email_send',
      position: { x: -350, y: 1300 },
      data: {
        label: 'Confirmacao por email',
        emailIntegrationId: params.emailIntegrationId,
        emailTo: '{{patient_email}}',
        emailSubject: 'Confirmacao da consulta - {{specialty}}',
        emailText:
          'Ola, {{patient_name}}.\n\nSua consulta foi agendada com sucesso.\n\nEspecialidade: {{specialty}}\nData e horario: {{appointment_slot.startsAt}}\nTipo: {{appointment_slot.mode}}\nLocal/link: {{appointment_slot.location}}\n\nOrientacoes: chegue com antecedencia se a consulta for presencial e tenha documentos/exames disponiveis. Para remarcar ou cancelar, responda ao canal de atendimento da clinica.',
      },
    },
    followups: {
      id: 'sf-appointment-followups',
      type: 'subflow',
      position: { x: -350, y: 1460 },
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
      position: { x: 320, y: 640 },
      data: {
        label: 'Oferecer lista de espera',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText:
          'No momento nao encontramos horarios disponiveis para {{specialty}} com os filtros informados.\n\nPosso registrar seu interesse na lista de espera e acionar a equipe para verificar alternativas proximas.',
        waIntegrationId: '',
      },
    },
    waitlistHandoff: {
      id: 'sf-appointment-waitlist-handoff',
      type: 'human_handoff',
      position: { x: 320, y: 800 },
      data: {
        label: 'Notificar equipe',
        handoffReasonField: 'handoff_reason',
        handoffPriority: 'medium',
        notifyEmail: params.teamNotifyEmail,
        notifyWhatsApp: params.teamNotifyWhatsApp,
        patientMessage:
          'Registrei seu interesse na lista de espera. Nossa equipe vai verificar alternativas de agenda e retornar assim que possivel.',
      },
    },
    failedHandoff: {
      id: 'sf-appointment-failed-handoff',
      type: 'human_handoff',
      position: { x: 90, y: 1140 },
      data: {
        label: 'Falha de agenda',
        handoffReasonField: 'handoff_reason',
        handoffPriority: 'medium',
        notifyEmail: params.teamNotifyEmail,
        notifyWhatsApp: params.teamNotifyWhatsApp,
        patientMessage:
          'Nao consegui confirmar o horario no sistema de agenda agora. Nossa equipe foi avisada e pode concluir o agendamento com voce. Se preferir, envie outro numero de horario da lista.',
      },
    },
    stopOk: buildStopNode('sf-appointment-stop-ok', { x: -350, y: 1620 }, 'subflow'),
    stopWaitlist: buildStopNode('sf-appointment-stop-waitlist', { x: 320, y: 960 }, 'subflow'),
    stopFail: buildStopNode('sf-appointment-stop-fail', { x: 90, y: 1300 }, 'subflow'),
  }

  const confirmationEdges = params.emailIntegrationId
    ? [
        { source: nodes.waConfirm.id, target: nodes.emailConfirm.id },
        { source: nodes.emailConfirm.id, target: nodes.followups.id },
      ]
    : [
        { source: nodes.waConfirm.id, target: nodes.followups.id },
      ]

  return compactFlowLayout(
    {
      startNodeId: nodes.start.id,
      meta: { kind: 'subflow', parentFlowName: FLOW_NAME, subflowKey: 'appointment', subflowOrder: 2 },
      nodes: Object.values(nodes),
      edges: [
        { source: nodes.start.id, target: nodes.note.id },
        { source: nodes.note.id, target: nodes.specialty.id, sourceHandle: 'pointer' },
        { source: nodes.specialty.id, target: nodes.availability.id },
        { source: nodes.availability.id, target: nodes.status.id },
        { source: nodes.status.id, target: nodes.chooseSlotMessage.id, sourceHandle: 'case:available' },
        { source: nodes.status.id, target: nodes.waitlistMessage.id, sourceHandle: 'case:unavailable' },
        { source: nodes.status.id, target: nodes.failedHandoff.id, sourceHandle: 'default' },
        { source: nodes.chooseSlotMessage.id, target: nodes.book.id },
        { source: nodes.book.id, target: nodes.confirmed.id },
        { source: nodes.confirmed.id, target: nodes.waConfirm.id, sourceHandle: 'case:confirmed' },
        { source: nodes.confirmed.id, target: nodes.chooseSlotMessage.id, sourceHandle: 'case:incomplete' },
        { source: nodes.confirmed.id, target: nodes.failedHandoff.id, sourceHandle: 'default' },
        ...confirmationEdges,
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
    status: {
      id: 'sf-reschedule-status',
      type: 'switch',
      position: { x: 80, y: 350 },
      data: {
        label: 'Remarcacao concluida?',
        branchField: 'appointment_status',
        switchDefaultLabel: 'Falha',
        switchCases: [
          { id: 'rescheduled', label: 'Remarcada', value: 'rescheduled' },
          { id: 'incomplete', label: 'Faltam dados', value: 'incomplete' },
        ],
      },
    },
    notify: {
      id: 'sf-reschedule-notify',
      type: 'whatsapp_message',
      position: { x: -180, y: 530 },
      data: {
        label: 'Confirmar remarcacao',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText:
          'Sua consulta foi remarcada com sucesso.\n\nNovo horario: {{appointment_slot.startsAt}}\nLocal/link: {{appointment_slot.location}}\n\nSe precisar de algo mais, responda por aqui.',
        waIntegrationId: '',
      },
    },
    missingData: {
      id: 'sf-reschedule-missing-data',
      type: 'whatsapp_message',
      position: { x: 80, y: 530 },
      data: {
        label: 'Solicitar dados da remarcacao',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText:
          'Para remarcar, preciso identificar a consulta atual e o novo horario desejado. Envie, por favor, o email/telefone cadastrado e a data ou periodo de preferencia.',
        waIntegrationId: '',
      },
    },
    failedHandoff: {
      id: 'sf-reschedule-failed-handoff',
      type: 'human_handoff',
      position: { x: 340, y: 530 },
      data: {
        label: 'Falha na remarcacao',
        handoffReasonField: 'handoff_reason',
        handoffPriority: 'medium',
        notifyEmail: params.teamNotifyEmail,
        notifyWhatsApp: params.teamNotifyWhatsApp,
        patientMessage:
          'Nao consegui concluir a remarcacao automaticamente. Vou encaminhar para nossa equipe continuar com voce.',
      },
    },
    stop: buildStopNode('sf-reschedule-stop', { x: -180, y: 700 }, 'subflow'),
    stopMissing: buildStopNode('sf-reschedule-stop-missing', { x: 80, y: 700 }, 'subflow'),
    stopFail: buildStopNode('sf-reschedule-stop-fail', { x: 340, y: 700 }, 'subflow'),
  }

  return {
    startNodeId: nodes.start.id,
    meta: { kind: 'subflow', parentFlowName: FLOW_NAME, subflowKey: 'reschedule', subflowOrder: 3 },
    nodes: Object.values(nodes),
    edges: [
      { source: nodes.start.id, target: nodes.action.id },
      { source: nodes.action.id, target: nodes.status.id },
      { source: nodes.status.id, target: nodes.notify.id, sourceHandle: 'case:rescheduled' },
      { source: nodes.status.id, target: nodes.missingData.id, sourceHandle: 'case:incomplete' },
      { source: nodes.status.id, target: nodes.failedHandoff.id, sourceHandle: 'default' },
      { source: nodes.notify.id, target: nodes.stop.id },
      { source: nodes.missingData.id, target: nodes.stopMissing.id },
      { source: nodes.failedHandoff.id, target: nodes.stopFail.id },
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
    status: {
      id: 'sf-cancel-status',
      type: 'switch',
      position: { x: 80, y: 350 },
      data: {
        label: 'Cancelamento concluido?',
        branchField: 'appointment_status',
        switchDefaultLabel: 'Falha',
        switchCases: [
          { id: 'cancelled', label: 'Cancelada', value: 'cancelled' },
          { id: 'incomplete', label: 'Faltam dados', value: 'incomplete' },
          { id: 'not_found', label: 'Nao encontrada', value: 'not_found' },
        ],
      },
    },
    notify: {
      id: 'sf-cancel-notify',
      type: 'whatsapp_message',
      position: { x: -180, y: 540 },
      data: {
        label: 'Confirmar cancelamento',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText:
          'Sua consulta foi cancelada com sucesso. Se desejar, podemos ajudar a reagendar futuramente.',
        waIntegrationId: '',
      },
    },
    missingData: {
      id: 'sf-cancel-missing-data',
      type: 'whatsapp_message',
      position: { x: 100, y: 540 },
      data: {
        label: 'Solicitar dados do cancelamento',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText:
          'Para cancelar, preciso localizar sua consulta. Envie o email/telefone cadastrado e, se souber, a data ou horario da consulta.',
        waIntegrationId: '',
      },
    },
    failedHandoff: {
      id: 'sf-cancel-failed-handoff',
      type: 'human_handoff',
      position: { x: 380, y: 540 },
      data: {
        label: 'Falha no cancelamento',
        handoffReasonField: 'handoff_reason',
        handoffPriority: 'medium',
        notifyEmail: params.teamNotifyEmail,
        notifyWhatsApp: params.teamNotifyWhatsApp,
        patientMessage:
          'Nao consegui concluir o cancelamento automaticamente. Vou encaminhar para nossa equipe continuar com voce.',
      },
    },
    stop: buildStopNode('sf-cancel-stop', { x: -180, y: 710 }, 'subflow'),
    stopMissing: buildStopNode('sf-cancel-stop-missing', { x: 100, y: 710 }, 'subflow'),
    stopFail: buildStopNode('sf-cancel-stop-fail', { x: 380, y: 710 }, 'subflow'),
  }

  return {
    startNodeId: nodes.start.id,
    meta: { kind: 'subflow', parentFlowName: FLOW_NAME, subflowKey: 'cancellation', subflowOrder: 4 },
    nodes: Object.values(nodes),
    edges: [
      { source: nodes.start.id, target: nodes.action.id },
      { source: nodes.action.id, target: nodes.status.id },
      { source: nodes.status.id, target: nodes.notify.id, sourceHandle: 'case:cancelled' },
      { source: nodes.status.id, target: nodes.missingData.id, sourceHandle: 'case:incomplete' },
      { source: nodes.status.id, target: nodes.missingData.id, sourceHandle: 'case:not_found' },
      { source: nodes.status.id, target: nodes.failedHandoff.id, sourceHandle: 'default' },
      { source: nodes.notify.id, target: nodes.stop.id },
      { source: nodes.missingData.id, target: nodes.stopMissing.id },
      { source: nodes.failedHandoff.id, target: nodes.stopFail.id },
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
    status: {
      id: 'sf-docs-status',
      type: 'switch',
      position: { x: 80, y: 510 },
      data: {
        label: 'Documento recebido?',
        branchField: 'document_status',
        switchDefaultLabel: 'Aguardando arquivo',
        switchCases: [
          { id: 'received', label: 'Recebido', value: 'received' },
          { id: 'pending_upload', label: 'Aguardando upload', value: 'pending_upload' },
        ],
      },
    },
    notify: {
      id: 'sf-docs-notify',
      type: 'human_handoff',
      position: { x: -160, y: 690 },
      data: {
        label: 'Notificar equipe',
        handoffReasonField: 'handoff_reason',
        handoffPriority: 'medium',
        notifyEmail: params.teamNotifyEmail,
        notifyWhatsApp: params.teamNotifyWhatsApp,
        patientMessage:
          'Recebemos sua solicitacao. Nossa equipe vai conferir os documentos e retornar se precisar de algo mais.',
      },
    },
    askUpload: {
      id: 'sf-docs-ask-upload',
      type: 'whatsapp_message',
      position: { x: 220, y: 690 },
      data: {
        label: 'Pedir envio do arquivo',
        waWindowMode: 'session_only',
        waMessageType: 'text',
        waMessageText:
          'Pode enviar o arquivo por aqui, por favor? Aceitamos exame, pedido medico, guia, laudo ou documento em imagem/PDF. Assim que recebermos, a equipe sera notificada.',
        waIntegrationId: '',
      },
    },
    stop: buildStopNode('sf-docs-stop', { x: -160, y: 860 }, 'subflow'),
    stopPending: buildStopNode('sf-docs-stop-pending', { x: 220, y: 860 }, 'subflow'),
  }

  return {
    startNodeId: nodes.start.id,
    meta: { kind: 'subflow', parentFlowName: FLOW_NAME, subflowKey: 'documents', subflowOrder: 5 },
    nodes: Object.values(nodes),
    edges: [
      { source: nodes.start.id, target: nodes.lookup.id },
      { source: nodes.lookup.id, target: nodes.intake.id },
      { source: nodes.intake.id, target: nodes.status.id },
      { source: nodes.status.id, target: nodes.notify.id, sourceHandle: 'case:received' },
      { source: nodes.status.id, target: nodes.askUpload.id, sourceHandle: 'case:pending_upload' },
      { source: nodes.status.id, target: nodes.askUpload.id, sourceHandle: 'default' },
      { source: nodes.notify.id, target: nodes.stop.id },
      { source: nodes.askUpload.id, target: nodes.stopPending.id },
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
    stop: buildStopNode('sf-specialties-stop', { x: 80, y: 350 }, 'subflow'),
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
        notifyWhatsApp: params.teamNotifyWhatsApp,
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
        notifyWhatsApp: params.teamNotifyWhatsApp,
        patientMessage: 'Vou encaminhar voce para nossa equipe humana agora.',
      },
    },
    stopUrgent: buildStopNode('sf-human-stop-urgent', { x: -160, y: 540 }, 'subflow'),
    stopStandard: buildStopNode('sf-human-stop-standard', { x: 250, y: 540 }, 'subflow'),
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
        additionalInstructions:
          'Modo fluxo: mensagem de boas-vindas e menu sao deterministicos. Classifique intent nos dados internos; nao invente formularios. Menu: 1=agendar, 2=especialidades, 3=documentos, 4=humano.',
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
          { id: 'especialidades', label: 'Especialidades', value: 'especialidades' },
          { id: 'documentos', label: 'Documentos', value: 'documentos' },
          { id: 'humano', label: 'Humano', value: 'humano' },
          { id: 'cancelar', label: 'Cancelar', value: 'cancelar' },
          { id: 'remarcar', label: 'Remarcar', value: 'remarcar' },
          { id: 'retorno', label: 'Retorno', value: 'retorno' },
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
        switchDefaultLabel: 'Agendamento',
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
    stepAfterIntake: buildStopNode('clinic-main-step-after-intake', { x: -220, y: 990 }, 'step'),
    stepAfterUrgency: buildStopNode('clinic-main-step-after-urgency', { x: -20, y: 1110 }, 'step'),
    stopAppointment: buildStopNode('clinic-main-stop-appointment', { x: -20, y: 1280 }, 'flow'),
    stopHuman: buildStopNode('clinic-main-stop-human', { x: -420, y: 1190 }, 'flow'),
    stopOther: buildStopNode('clinic-main-stop-other', { x: 545, y: 850 }, 'flow'),
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
      { source: nodes.intake.id, target: nodes.stepAfterIntake.id },
      { source: nodes.stepAfterIntake.id, target: nodes.urgency.id },
      { source: nodes.urgency.id, target: nodes.human.id, sourceHandle: 'case:urgent' },
      { source: nodes.urgency.id, target: nodes.stepAfterUrgency.id, sourceHandle: 'case:non_urgent' },
      { source: nodes.urgency.id, target: nodes.stepAfterUrgency.id, sourceHandle: 'default' },
      { source: nodes.stepAfterUrgency.id, target: nodes.appointment.id },
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
  const normalizedFlow = normalizeStopNodesInFlow(flow)

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
      .update({ nodes: normalizedFlow, user_email: email })
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
      nodes: normalizedFlow,
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

export const __test__ = {
  createAppointmentSubflow,
  createIntakeTriageSubflow,
  createMainOrchestratorFlow,
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
  const teamNotifyWhatsApp = String(options?.teamNotifyWhatsApp || '').trim()
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
    teamNotifyWhatsApp,
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
