import logger from '../../lib/logger'
import { supabase } from '../../lib/supabase'
import { runAgentWhatsAppTurn } from '../agents/agent-whatsapp-automation'
import { executeFlowForChannel, FlowChannelExecutionResult } from '../flows/flow-channel-runtime'
import { normalizePhoneDigits } from '../flows/flow-patient-intake'
import { claimInboundMessageProcessing } from '../flows/flow-inbound-idempotency.service'

export type AutomationMode = 'agent' | 'flow' | 'hybrid'

interface IntegrationAutomationRecord {
  id: string
  companies_id?: string | null
  phone_number?: string | null
  automation_mode?: string | null
  linked_flow_id?: string | null
}

interface LinkedAgent {
  id: string
  nome: string | null
  status_id: number | string | null
}

interface LinkedFlow {
  id: string
  name: string | null
}

interface RouteWhatsAppAutomationParams {
  integrationId: string
  companiesId?: string | null
  userEmail: string
  messageText: string
  phoneNumber: string
  from: string
  to: string
  contactId: string
  messageDbId?: string
  externalMessageId?: string | null
  requestStartedAt?: string
}

export interface RouteWhatsAppAutomationResult {
  handled: boolean
  mode: AutomationMode | 'none'
  agentId?: string
  flowId?: string
  flowExecution?: FlowChannelExecutionResult
  agentResult?: any
  reason?: string
}

function hasMissingColumnError(error: any): boolean {
  const message = String(error?.message || error?.details || '').toLowerCase()
  return message.includes('column') && (message.includes('automation_mode') || message.includes('linked_flow_id'))
}

function isAgentActive(statusId: unknown): boolean {
  if (statusId === null || statusId === undefined) {
    return false
  }

  const numericStatus = typeof statusId === 'string' ? parseInt(statusId, 10) : Number(statusId)
  return numericStatus === 1
}

function pickPreferredAgent(agents: LinkedAgent[]): LinkedAgent | null {
  if (!Array.isArray(agents) || agents.length === 0) {
    return null
  }

  return agents.find((agent) => isAgentActive(agent.status_id)) || agents[0] || null
}

function normalizeAutomationMode(rawValue: unknown, hasLinkedFlow: boolean): AutomationMode {
  const normalized = String(rawValue || '').trim().toLowerCase()

  if (normalized === 'flow' || normalized === 'hybrid') {
    return normalized
  }

  if (normalized === 'agent') {
    return 'agent'
  }

  return hasLinkedFlow ? 'flow' : 'agent'
}

async function loadIntegrationRecord(integrationId: string): Promise<IntegrationAutomationRecord | null> {
  const extendedSelection = 'id, companies_id, phone_number, automation_mode, linked_flow_id'
  const legacySelection = 'id, companies_id, phone_number'

  let response = await supabase
    .from('tb_integrations')
    .select(extendedSelection)
    .eq('id', integrationId)
    .maybeSingle()

  if (response.error && hasMissingColumnError(response.error)) {
    response = await supabase
      .from('tb_integrations')
      .select(legacySelection)
      .eq('id', integrationId)
      .maybeSingle()
  }

  if (response.error) {
    throw new Error(response.error.message)
  }

  return (response.data || null) as IntegrationAutomationRecord | null
}

async function loadLinkedAgentsForIntegration(
  integrationId: string,
  companiesId: string | null | undefined
): Promise<LinkedAgent[]> {
  let query = supabase
    .from('tb_agents')
    .select('id, nome, status_id')
    .eq('integrations_id', integrationId)
    .order('updated_at', { ascending: false })

  if (companiesId) {
    query = query.eq('companies_id', companiesId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return Array.isArray(data) ? (data as LinkedAgent[]) : []
}

async function loadLinkedFlow(
  flowId: string | null | undefined,
  companiesId: string | null | undefined
): Promise<LinkedFlow | null> {
  const normalizedFlowId = String(flowId || '').trim()
  if (!normalizedFlowId) {
    return null
  }

  let query = supabase
    .from('tb_flows')
    .select('id, name, companies_id')
    .eq('id', normalizedFlowId)

  if (companiesId) {
    query = query.or(`companies_id.eq.${companiesId},companies_id.is.null`)
  } else {
    query = query.is('companies_id', null)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  return {
    id: String((data as any).id),
    name: String((data as any).name || '').trim() || null
  }
}

async function executeAgentAutomation(
  params: RouteWhatsAppAutomationParams,
  agent: LinkedAgent
): Promise<RouteWhatsAppAutomationResult> {
  if (!isAgentActive(agent.status_id)) {
    return {
      handled: false,
      mode: 'agent',
      agentId: agent.id,
      reason: 'Agente vinculado esta inativo'
    }
  }

  const turn = await runAgentWhatsAppTurn({
    integrationId: params.integrationId,
    agentId: agent.id,
    userEmail: params.userEmail,
    messageText: params.messageText,
    phoneNumber: params.phoneNumber,
    from: params.from,
    to: params.to,
    contactId: params.contactId,
    messageDbId: params.messageDbId,
    requestStartedAt: params.requestStartedAt,
  })

  return {
    handled: turn.handled,
    mode: 'agent',
    agentId: agent.id,
    agentResult: turn.agentResult,
    reason: turn.reason,
  }
}

function resolveWhatsAppPatientPhone(phoneNumber: string, from: string): string {
  const fromDigits = String(from || '')
    .trim()
    .replace(/@.*/g, '')
  const raw = String(phoneNumber || fromDigits || '').trim()
  return raw ? normalizePhoneDigits(raw) : ''
}

async function executeFlowAutomation(
  params: RouteWhatsAppAutomationParams,
  flow: LinkedFlow,
  agent: LinkedAgent | null,
  integration: IntegrationAutomationRecord
): Promise<RouteWhatsAppAutomationResult> {
  const companiesId = params.companiesId || integration.companies_id || null
  const patientPhone = resolveWhatsAppPatientPhone(params.phoneNumber, params.from)

  const flowExecution = await executeFlowForChannel({
    flowId: flow.id,
    userEmail: params.userEmail,
    initialData: {
      channel: 'whatsapp',
      message: params.messageText,
      originalMessage: params.messageText,
      userMessage: params.messageText,
      input: params.messageText,
      text: params.messageText,
      whatsappMessage: params.messageText,
      phone_number: patientPhone || params.phoneNumber || params.from,
      from: params.from,
      to: params.to,
      patient_phone: patientPhone,
      whatsapp_contact_id: params.contactId,
      integrations_id: params.integrationId,
      whatsapp_message_id: params.messageDbId,
      request_started_at: params.requestStartedAt,
      ...(companiesId ? { companies_id: companiesId, companiesId } : {}),
    },
    deliveryChannel: 'whatsapp',
    integrationsId: params.integrationId,
    recipientId: params.contactId,
    agentId: agent?.id,
    requestStartedAt: params.requestStartedAt
  })

  return {
    handled: flowExecution.delivery.success || !!flowExecution.outboundMessage,
    mode: 'flow',
    agentId: agent?.id,
    flowId: flow.id,
    flowExecution,
    reason: flowExecution.delivery.success
      ? undefined
      : flowExecution.delivery.error || 'Fluxo executado sem entrega'
  }
}

export async function routeWhatsAppAutomation(
  params: RouteWhatsAppAutomationParams
): Promise<RouteWhatsAppAutomationResult> {
  const idempotency = await claimInboundMessageProcessing({
    channel: 'whatsapp',
    integrationId: params.integrationId,
    externalMessageId: params.externalMessageId,
  })

  if (idempotency.status === 'duplicate') {
    return {
      handled: true,
      mode: 'none',
      reason: 'duplicate_inbound_message',
    }
  }

  const integration = await loadIntegrationRecord(params.integrationId)
  if (!integration) {
    return {
      handled: false,
      mode: 'none',
      reason: 'Integracao nao encontrada'
    }
  }

  const linkedAgents = await loadLinkedAgentsForIntegration(params.integrationId, params.companiesId || integration.companies_id)
  const preferredAgent = pickPreferredAgent(linkedAgents)
  const linkedFlow = await loadLinkedFlow(integration.linked_flow_id, params.companiesId || integration.companies_id)
  const automationMode = normalizeAutomationMode(integration.automation_mode, !!linkedFlow?.id)

  logger.info('[routeWhatsAppAutomation] Roteando automacao do WhatsApp', {
    integrationId: params.integrationId,
    automationMode,
    linkedFlowId: linkedFlow?.id || null,
    linkedAgentId: preferredAgent?.id || null
  })

  if (automationMode === 'flow' || automationMode === 'hybrid') {
    if (linkedFlow?.id) {
      try {
        const flowResult = await executeFlowAutomation(params, linkedFlow, preferredAgent, integration)

        if (automationMode === 'flow') {
          return flowResult
        }

        if (flowResult.flowExecution?.delivery.success || flowResult.flowExecution?.outboundMessage) {
          return flowResult
        }

        logger.warn('[routeWhatsAppAutomation] Fluxo em modo hybrid nao entregou resposta; tentando fallback para agente', {
          integrationId: params.integrationId,
          flowId: linkedFlow.id,
          fallbackAgentId: preferredAgent?.id || null
        })
      } catch (error: any) {
        if (automationMode === 'flow') {
          throw error
        }

        logger.warn('[routeWhatsAppAutomation] Falha no fluxo em modo hybrid; tentando fallback para agente', {
          integrationId: params.integrationId,
          flowId: linkedFlow.id,
          error: error?.message
        })
      }
    } else if (automationMode === 'flow') {
      return {
        handled: false,
        mode: 'flow',
        reason: 'Modo flow configurado sem linked_flow_id valido'
      }
    }
  }

  if (!preferredAgent?.id) {
    return {
      handled: false,
      mode: automationMode,
      flowId: linkedFlow?.id,
      reason: 'Nenhum agente vinculado ou fluxo valido encontrado para a integracao'
    }
  }

  return executeAgentAutomation(params, preferredAgent)
}
