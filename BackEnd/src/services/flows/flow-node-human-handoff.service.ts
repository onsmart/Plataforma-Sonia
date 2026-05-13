import logger from '../../lib/logger'
import { sendEmailForUser } from '../integrations/email/email.service'
import { saveSystemLog } from '../system-logs'
import { FlowNode } from './flow.types'
import { buildFlowIntegrationResult, FlowIntegrationResult } from './flow-node-result'

function buildHandoffBody(params: {
  reason: string
  priority: string
  contextData: Record<string, any>
}): string {
  const patientName = String(params.contextData.patient_name || params.contextData.name || '').trim() || 'Paciente não identificado'
  const patientEmail = String(params.contextData.patient_email || params.contextData.email || '').trim() || 'não informado'
  const patientPhone = String(params.contextData.patient_phone || params.contextData.phone || '').trim() || 'não informado'
  const channel = String(params.contextData.channel_origin || 'whatsapp').trim() || 'whatsapp'
  const intent = String(params.contextData.intent || '').trim() || 'não identificado'
  const triage = String(params.contextData.triage_notes || '').trim() || 'sem observações'
  return [
    `Transferência para atendimento humano`,
    `Prioridade: ${params.priority}`,
    `Motivo: ${params.reason}`,
    `Paciente: ${patientName}`,
    `Email: ${patientEmail}`,
    `Telefone: ${patientPhone}`,
    `Canal: ${channel}`,
    `Intent detectado: ${intent}`,
    `Triagem: ${triage}`,
  ].join('\n')
}

export async function executeHumanHandoffNode(params: {
  node: FlowNode
  contextData: Record<string, any>
  userEmail: string
  companiesId?: string
  flowId: string
  executionId?: string
}): Promise<FlowIntegrationResult> {
  const nodeData = params.node.data || {}
  const reasonField = String(nodeData.handoffReasonField || 'handoff_reason').trim() || 'handoff_reason'
  const reason =
    String(params.contextData[reasonField] || '').trim() ||
    String(params.contextData.handoff_reason || '').trim() ||
    'Solicitação de atendimento humano'
  const priority = String(nodeData.handoffPriority || 'medium').trim() || 'medium'
  const notifyEmail = String(
    nodeData.notifyEmail || params.contextData.team_notify_email || params.contextData.notify_email || ''
  ).trim()
  const notifyWhatsApp = String(
    nodeData.notifyWhatsApp || params.contextData.team_notify_whatsapp || ''
  ).trim()
  const response =
    String(nodeData.patientMessage || '').trim() ||
    'Vou encaminhar seu caso para nossa equipe humana e eles continuarão o atendimento em breve.'

  const notifiedChannels: string[] = []
  let emailError: string | null = null

  await saveSystemLog({
    companies_id: params.companiesId,
    user_email: params.userEmail,
    workflow_id: params.flowId,
    execution_id: params.executionId,
    node_id: params.node.id,
    log_type: 'human_handoff_requested',
    level: 'warn',
    message: `Fluxo encaminhou atendimento humano. Motivo: ${reason}`,
    metadata: {
      priority,
      reason,
      notifyEmail,
      notifyWhatsApp,
      contextKeys: Object.keys(params.contextData),
    },
    impact_level: priority === 'urgent' ? 'high' : 'medium',
  })

  if (notifyEmail) {
    try {
      await sendEmailForUser(params.userEmail, undefined, {
        to: notifyEmail,
        subject: `[Fluxo Clínica] Atendimento humano necessário - ${priority.toUpperCase()}`,
        text: buildHandoffBody({
          reason,
          priority,
          contextData: params.contextData,
        }),
      })
      notifiedChannels.push('email')
    } catch (error: any) {
      emailError = error?.message || 'Falha ao enviar email interno'
      logger.warn('[flow-node-human-handoff] Falha ao notificar por email', {
        error: emailError,
      })
    }
  }

  if (notifyWhatsApp) {
    notifiedChannels.push('whatsapp_placeholder')
  }

  return buildFlowIntegrationResult('human_handoff', {
    success: true,
    status: emailError ? 'partial' : 'forwarded',
    user_safe_message: response,
    retryable: false,
    integration_status: emailError ? 'partial' : 'success',
    handoff_reason: reason,
    response,
    priority,
    notified_channels: notifiedChannels,
    notify_email_error: emailError,
  })
}

