import logger from '../../lib/logger'
import { sendEmailForUser } from '../integrations/email/email.service'
import { sendWhatsApp } from '../integrations/whatsapp/whatsapp.dispatcher'
import { saveSystemLog } from '../system-logs'
import { FlowNode } from './flow.types'
import { buildFlowIntegrationResult, FlowIntegrationResult } from './flow-node-result'
import { resolveFlowTeamNotifyEmail, resolveFlowTeamNotifyWhatsApp } from './flow-team-notify.config'

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
  const notifyEmail = resolveFlowTeamNotifyEmail(
    nodeData.notifyEmail || params.contextData.team_notify_email || params.contextData.notify_email
  )
  const notifyWhatsApp = resolveFlowTeamNotifyWhatsApp(
    nodeData.notifyWhatsApp || params.contextData.team_notify_whatsapp
  )
  const integrationsId = String(
    params.contextData.integrations_id || params.contextData.integration_id || ''
  ).trim()
  const agentId = String(params.contextData.agent_id || params.contextData.agentId || '').trim() || undefined
  const requestStartedAt = String(params.contextData.request_started_at || '').trim() || undefined
  const response =
    String(nodeData.patientMessage || '').trim() ||
    'Vou encaminhar seu caso para nossa equipe humana e eles continuarão o atendimento em breve.'

  const notifiedChannels: string[] = []
  let emailError: string | null = null
  let whatsappError: string | null = null

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
        subject: `[Plataforma Sonia] Atendimento humano necessário - ${priority.toUpperCase()}`,
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
        notifyEmailPreview: notifyEmail.slice(0, 48),
      })
    }
  } else {
    logger.info('[flow-node-human-handoff] Notificacao por e-mail omitida (desabilitada ou nao configurada)', {
      nodeId: params.node.id,
      flowId: params.flowId,
    })
  }

  if (notifyWhatsApp) {
    if (!integrationsId) {
      whatsappError = 'Integracao WhatsApp nao configurada para o handoff humano'
      logger.warn('[flow-node-human-handoff] Falha ao notificar por WhatsApp', {
        error: whatsappError,
      })
    } else {
      try {
        const sendResult = await sendWhatsApp(integrationsId, {
          to: notifyWhatsApp,
          message: buildHandoffBody({
            reason,
            priority,
            contextData: params.contextData,
          }),
          agentId,
          context: {
            automation_source: 'flow_human_handoff',
            flow_id: params.flowId,
            flow_execution_id: params.executionId,
            ...(requestStartedAt ? { request_started_at: requestStartedAt } : {}),
          },
        })

        if (!sendResult.success) {
          whatsappError = sendResult.error || 'Falha ao enviar WhatsApp interno'
          logger.warn('[flow-node-human-handoff] Falha ao notificar por WhatsApp', {
            error: whatsappError,
          })
        } else {
          notifiedChannels.push('whatsapp')
        }
      } catch (error: any) {
        whatsappError = error?.message || 'Falha ao enviar WhatsApp interno'
        logger.warn('[flow-node-human-handoff] Falha ao notificar por WhatsApp', {
          error: whatsappError,
        })
      }
    }
  }

  return buildFlowIntegrationResult('human_handoff', {
    success: true,
    status: emailError || whatsappError ? 'partial' : 'forwarded',
    user_safe_message: response,
    retryable: false,
    integration_status: emailError || whatsappError ? 'partial' : 'success',
    handoff_reason: reason,
    response,
    priority,
    notified_channels: notifiedChannels,
    notify_email_error: emailError,
    notify_whatsapp_error: whatsappError,
  })
}
