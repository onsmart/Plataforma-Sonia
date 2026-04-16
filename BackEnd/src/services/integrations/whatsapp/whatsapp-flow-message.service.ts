import logger from '../../../lib/logger'
import { listStoredTemplates } from './whatsapp-template-catalog.service'
import { sendWhatsApp, sendWhatsAppTemplate } from './whatsapp.dispatcher'
import { getCustomerCareWindowState } from './whatsapp-session-window.service'

type FlowWhatsAppMessageType = 'text' | 'buttons' | 'link' | 'reminder'

interface FlowWhatsAppButton {
  id?: string
  text: string
}

interface SendFlowWhatsAppMessageParams {
  integrationsId: string
  to: string
  flowId: string
  flowExecutionId?: string
  agentId?: string
  requestStartedAt?: string
  nodeId: string
  label?: string
  messageType: FlowWhatsAppMessageType
  messageText: string
  buttons?: FlowWhatsAppButton[]
  linkUrl?: string
  reminderAt?: string
  fallbackTemplateName?: string
  fallbackTemplateLanguage?: string
}

interface AutomaticTemplateMatch {
  templateName: string
  languageCode: string
  reason: 'configured_mapping' | 'configured_direct' | 'body_match'
}

export interface SendFlowWhatsAppMessageResult {
  success: boolean
  sendMode?: 'normal' | 'automatic_template'
  messageId?: string
  error?: string
  userMessage?: string
  templateName?: string
  languageCode?: string
}

function normalizeText(value: string): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function normalizeTemplateLanguage(value?: string): string {
  const raw = String(value || '').trim()
  if (!raw) return 'pt_BR'
  if (raw.includes('-')) {
    const [lang, region] = raw.split('-', 2)
    if (lang && region) return `${lang.toLowerCase()}_${region.toUpperCase()}`
  }
  if (raw.includes('_')) {
    const [lang, region] = raw.split('_', 2)
    if (lang && region) return `${lang.toLowerCase()}_${region.toUpperCase()}`
  }
  return raw
}

function buildSessionMessage(params: {
  messageType: FlowWhatsAppMessageType
  messageText: string
  buttons: FlowWhatsAppButton[]
  linkUrl?: string
  reminderAt?: string
}): {
  body: string
  previewUrl: boolean
  buttons: FlowWhatsAppButton[]
  messageType: 'text' | 'interactive_buttons'
} {
  const messageText = String(params.messageText || '').trim()
  const buttons = params.buttons.filter((button) => String(button.text || '').trim())
  const linkUrl = String(params.linkUrl || '').trim()
  const reminderAt = String(params.reminderAt || '').trim()

  if (params.messageType === 'buttons' && buttons.length > 0) {
    return {
      body: messageText,
      previewUrl: false,
      buttons,
      messageType: 'interactive_buttons'
    }
  }

  if (params.messageType === 'link' && linkUrl) {
    return {
      body: messageText ? `${messageText}\n${linkUrl}` : linkUrl,
      previewUrl: true,
      buttons: [],
      messageType: 'text'
    }
  }

  if (params.messageType === 'reminder' && reminderAt) {
    return {
      body: `${messageText}\n\nLembrete: ${reminderAt}`.trim(),
      previewUrl: false,
      buttons: [],
      messageType: 'text'
    }
  }

  return {
    body: messageText,
    previewUrl: false,
    buttons: [],
    messageType: 'text'
  }
}

function templateRequiresVariables(components: unknown[]): boolean {
  const serialized = JSON.stringify(components || [])
  return /\{\{\d+\}\}/.test(serialized)
}

function extractTemplateBody(components: unknown[]): string {
  if (!Array.isArray(components)) return ''
  for (const item of components as Array<Record<string, unknown>>) {
    if (String(item?.type || '').toUpperCase() !== 'BODY') continue
    const text = String(item?.text || '').trim()
    if (text) return text
  }
  return ''
}

function extractTemplateButtons(components: unknown[]): string[] {
  if (!Array.isArray(components)) return []
  const values: string[] = []

  for (const item of components as Array<Record<string, unknown>>) {
    if (String(item?.type || '').toUpperCase() !== 'BUTTONS') continue
    const buttons = Array.isArray(item?.buttons) ? (item.buttons as Array<Record<string, unknown>>) : []
    for (const button of buttons) {
      const text = String(button?.text || button?.title || '').trim()
      if (text) values.push(text)
    }
  }

  return values
}

async function findAutomaticTemplateMatch(params: {
  integrationsId: string
  fallbackTemplateName?: string
  fallbackTemplateLanguage?: string
  sessionMessage: string
  buttons: FlowWhatsAppButton[]
}): Promise<AutomaticTemplateMatch | null> {
  const fallbackName = String(params.fallbackTemplateName || '').trim()
  const fallbackLanguage = normalizeTemplateLanguage(params.fallbackTemplateLanguage)

  // Se o usuário configurou um template aprovado explicitamente,
  // usamos esse mapeamento mesmo sem catálogo sincronizado.
  if (fallbackName) {
    const templates = await listStoredTemplates(params.integrationsId)
    if (!Array.isArray(templates) || templates.length === 0) {
      return {
        templateName: fallbackName,
        languageCode: fallbackLanguage,
        reason: 'configured_direct'
      }
    }

    const exact = templates.find((template) => {
      if (String(template?.name || '').trim() !== fallbackName) return false
      return normalizeTemplateLanguage(String(template?.language || '')) === fallbackLanguage
    })
    if (exact) {
      return {
        templateName: String(exact.name),
        languageCode: normalizeTemplateLanguage(String(exact.language || fallbackLanguage)),
        reason: 'configured_mapping'
      }
    }

    return {
      templateName: fallbackName,
      languageCode: fallbackLanguage,
      reason: 'configured_direct'
    }
  }

  const templates = await listStoredTemplates(params.integrationsId)
  if (!Array.isArray(templates) || templates.length === 0) {
    return null
  }

  const targetBody = normalizeText(params.sessionMessage)
  const targetButtons = params.buttons.map((button) => normalizeText(button.text)).filter(Boolean)

  for (const template of templates) {
    const status = normalizeText(String(template?.status || ''))
    if (status && !status.includes('approved') && !status.includes('active')) {
      continue
    }

    const components = Array.isArray(template?.components_json) ? template.components_json : []
    if (templateRequiresVariables(components)) {
      continue
    }

    const body = normalizeText(extractTemplateBody(components))
    if (!body || body !== targetBody) {
      continue
    }

    const templateButtons = extractTemplateButtons(components)
      .map((button) => normalizeText(button))
      .filter(Boolean)

    if (targetButtons.length > 0) {
      if (templateButtons.length !== targetButtons.length) {
        continue
      }
      if (templateButtons.some((button, index) => button !== targetButtons[index])) {
        continue
      }
    }

    return {
      templateName: String(template.name),
      languageCode: String(template.language || 'pt_BR'),
      reason: 'body_match'
    }
  }

  return null
}

export async function sendFlowWhatsAppMessage(
  params: SendFlowWhatsAppMessageParams
): Promise<SendFlowWhatsAppMessageResult> {
  const state = await getCustomerCareWindowState(params.integrationsId, params.to)
  const sessionPayload = buildSessionMessage({
    messageType: params.messageType,
    messageText: params.messageText,
    buttons: params.buttons || [],
    linkUrl: params.linkUrl,
    reminderAt: params.reminderAt
  })

  if (state.insideWindow) {
    const sent = await sendWhatsApp(params.integrationsId, {
      to: params.to,
      message: sessionPayload.body,
      messageType: sessionPayload.messageType,
      previewUrl: sessionPayload.previewUrl,
      buttons: sessionPayload.buttons,
      agentId: params.agentId,
      context: {
        automation_source: 'flow_whatsapp_message',
        flow_id: params.flowId,
        flow_execution_id: params.flowExecutionId,
        request_started_at: params.requestStartedAt,
        flow_node_id: params.nodeId,
        flow_node_label: params.label || null
      }
    })

    if (!sent.success) {
      return {
        success: false,
        error: sent.error || 'Falha ao enviar mensagem pelo WhatsApp',
        userMessage: 'Não foi possível enviar a mensagem agora. Tente novamente em instantes.'
      }
    }

    return {
      success: true,
      sendMode: 'normal',
      messageId: sent.messageId
    }
  }

  const match = await findAutomaticTemplateMatch({
    integrationsId: params.integrationsId,
    fallbackTemplateName: params.fallbackTemplateName,
    fallbackTemplateLanguage: params.fallbackTemplateLanguage,
    sessionMessage: sessionPayload.body,
    buttons: sessionPayload.buttons
  })

  if (!match) {
    return {
      success: false,
      error: 'Nenhum template aprovado compatível encontrado para conversão automática.',
      userMessage: 'Não foi possível enviar pois o cliente não interagiu recentemente e não encontramos uma mensagem aprovada compatível.'
    }
  }

  const templateSent = await sendWhatsAppTemplate(params.integrationsId, {
    to: params.to,
    templateName: match.templateName,
    languageCode: match.languageCode,
    agentId: params.agentId,
    context: {
      automation_source: 'flow_whatsapp_message',
      flow_id: params.flowId,
      flow_execution_id: params.flowExecutionId,
      request_started_at: params.requestStartedAt,
      flow_node_id: params.nodeId,
      flow_node_label: params.label || null,
      auto_template_reason: match.reason
    }
  })

  if (!templateSent.success) {
    logger.warn('[whatsapp-flow-message] Falha ao enviar template automático', {
      integrationsId: params.integrationsId,
      nodeId: params.nodeId,
      templateName: match.templateName,
      error: templateSent.error
    })
    return {
      success: false,
      error: templateSent.error || 'Falha ao enviar template automático',
      userMessage: 'Não foi possível enviar pois o cliente não interagiu recentemente.'
    }
  }

  return {
    success: true,
    sendMode: 'automatic_template',
    messageId: templateSent.messageId,
    templateName: match.templateName,
    languageCode: match.languageCode
  }
}
