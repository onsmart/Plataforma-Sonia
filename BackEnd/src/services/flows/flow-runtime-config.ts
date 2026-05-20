/**
 * Configuracao de runtime do fluxo (meta.runtime no grafo).
 * Definida no builder/seed por fluxo — o motor nao hardcodeia IDs de demo.
 */
export type FlowRuntimeConfig = {
  /** Node de switch de intencao para fast-track quando a mensagem ja traz intent claro */
  fastTrackIntentNodeId?: string | null
  /** Mapa opcional numero de menu -> valor de intent (sobrescreve mapa global do produto) */
  intentMenuMap?: Record<string, string> | null
  /** Regras de retomada do subfluxo de cadastro/triagem */
  intakeResume?: {
    collectNodeId?: string | null
    crmUpsertNodeId?: string | null
    triageNodeId?: string | null
    redirectToCollectWhenIncompleteAt?: string[] | null
  } | null
  /** Politica de persistencia de estado de agendamento no canal */
  appointmentState?: {
    bookNodeId?: string | null
    chooseSlotNodeId?: string | null
  } | null
}

export type FlowNodeConversationPolicy = {
  /** Pausar neste node se faltar perfil minimo do paciente */
  pauseOnMissingPatientProfile?: boolean
  /** Pausar se faltar especialidade definida */
  pauseOnMissingSpecialty?: boolean
  /** Pausar se CRM upsert/update sem perfil completo — retomar no node de coleta */
  pauseOnCrmUpsertWithoutProfile?: {
    enabled?: boolean
    resumeCollectNodeId?: string | null
  }
  /** Pausar se lista de horarios sem slot escolhido (whatsapp_message antes do book) */
  pauseOnMissingAppointmentSlot?: {
    enabled?: boolean
    bookNodeId?: string | null
    slotPromptNodeId?: string | null
  }
  /** Pausar no proprio node quando lookup CRM incompleto (ex.: cancelamento) */
  pauseOnIncompleteCrmLookupAtCurrentNode?: boolean
}

export type FlowNodeDeterministicConfig = {
  /** Perfil registrado em flow-deterministic-registry (ex.: static_message, patient_intake.collect) */
  profile?: string | null
  /** Mensagem estatica quando profile=static_message */
  message?: string | null
  /** Aplicar campos estruturados do intake apos resposta deterministica */
  applyIntakeFields?: boolean
  /** Valor fixo de urgency_status (ex.: non_urgent) */
  setUrgencyStatus?: string | null
}

export function readFlowRuntimeConfig(meta: unknown): FlowRuntimeConfig {
  if (!meta || typeof meta !== 'object') return {}
  const runtime = (meta as { runtime?: unknown }).runtime
  if (!runtime || typeof runtime !== 'object') return {}
  return runtime as FlowRuntimeConfig
}

export function readNodeConversationPolicy(nodeData: Record<string, unknown>): FlowNodeConversationPolicy {
  const raw = nodeData.conversationPolicy
  if (!raw || typeof raw !== 'object') return {}
  return raw as FlowNodeConversationPolicy
}

export function readNodeDeterministicConfig(nodeData: Record<string, unknown>): FlowNodeDeterministicConfig {
  const raw = nodeData.deterministic
  if (raw && typeof raw === 'object') {
    return raw as FlowNodeDeterministicConfig
  }
  if (nodeData.deterministicProfile || nodeData.deterministicMessage) {
    return {
      profile: String(nodeData.deterministicProfile || 'static_message').trim() || 'static_message',
      message: String(nodeData.deterministicMessage || '').trim() || null,
      applyIntakeFields: nodeData.deterministicApplyIntakeFields === true,
      setUrgencyStatus: String(nodeData.deterministicSetUrgencyStatus || '').trim() || null,
    }
  }
  if (nodeData.useDeterministicIntake === true) {
    return { profile: 'patient_intake.collect', applyIntakeFields: true }
  }
  return {}
}

export function resolveIntentFromMenuMap(
  menuMap: Record<string, string> | null | undefined,
  numericChoice: string
): string {
  const key = String(numericChoice || '').trim()
  if (!key || !menuMap) return ''
  return String(menuMap[key] || '').trim()
}
