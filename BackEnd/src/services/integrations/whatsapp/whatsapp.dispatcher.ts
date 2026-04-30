import axios from 'axios'
import logger from '../../../lib/logger'
import { supabase } from '../../../lib/supabase'
import {
  formatMetaRecipient,
  normalizeDigits,
  type MetaWhatsAppConfig
} from './whatsapp.meta'
import {
  getContactNumberForSending,
  markMessagesAsRead,
  saveWhatsAppMessage,
  type SendWhatsAppInput,
  type SendWhatsAppTemplateInput
} from './whatsapp.service'
import { buildCloudApiTemplateMessageBody } from './whatsapp-template-payload'
import { isTemplatesEnabledForIntegration } from './whatsapp-feature-flags'
import { recordWhatsappMessageEvent } from './whatsapp-message-events.service'
import { createOrUpdateContact, getContactByPhoneNumber } from './whatsapp.contacts'
import { getHistoryFromRedis, saveMessageToHistory } from './whatsapp.redis'

interface StoredWhatsAppIntegration {
  id: string
  user_id?: string | null
  companies_id?: string | null
  phone_number: string | null
  provider?: string | null
  access_token?: string | null
  app_key?: string | null
  auth_token?: string | null
}

const DEFAULT_META_API_VERSION = 'v23.0'

type WhatsAppCallAction = 'connect' | 'pre_accept' | 'accept' | 'reject' | 'terminate'

interface WhatsAppCallSessionPayload {
  sdpType: 'offer' | 'answer'
  sdp: string
}

async function getStoredWhatsAppIntegration(integrationsId: string): Promise<StoredWhatsAppIntegration | null> {
  const { data, error } = await supabase
    .from('tb_integrations')
    .select('id, user_id, companies_id, phone_number, provider, access_token, app_key, auth_token')
    .eq('id', integrationsId)
    .maybeSingle()

  if (error) {
    logger.error('[whatsapp.dispatcher] Erro ao buscar integraÃ§Ã£o:', {
      integrationsId,
      error: error.message
    })
    return null
  }

  return (data || null) as StoredWhatsAppIntegration | null
}

function resolveMetaConfig(integration: StoredWhatsAppIntegration | null): MetaWhatsAppConfig | null {
  if (!integration) {
    return null
  }

  const accessToken = String(integration.access_token || '').trim()
  const phoneNumberId = String(integration.app_key || '').trim()

  if (!accessToken || !phoneNumberId) {
    return null
  }

  const providerHint = String(integration.provider || '').toLowerCase()
  const shouldUseMeta =
    providerHint === 'whatsapp' ||
    providerHint.includes('meta') ||
    providerHint.includes('cloud')

  if (!shouldUseMeta) {
    return null
  }

  return {
    provider: 'meta',
    apiVersion: DEFAULT_META_API_VERSION,
    accessToken,
    phoneNumberId,
    verifyToken: String(integration.auth_token || '').trim() || undefined,
    businessPhoneNumber: normalizeDigits(integration.phone_number || '')
  }
}

function getMetaOnlyError(): string {
  return 'Somente integracoes oficiais do WhatsApp pela Meta sao aceitas. Configure Phone Number ID, Access Token, Verify Token e numero oficial da Meta na integracao.'
}

async function resolveIntegrationUserEmail(userId?: string | null): Promise<string | undefined> {
  const normalizedUserId = String(userId || '').trim()
  if (!normalizedUserId) {
    return undefined
  }

  const { data, error } = await supabase
    .from('tb_users')
    .select('email')
    .eq('id', normalizedUserId)
    .maybeSingle()

  if (error) {
    logger.warn('[whatsapp.dispatcher] Falha ao buscar email do dono da integracao', {
      userId: normalizedUserId,
      error: error.message
    })
    return undefined
  }

  const normalizedEmail = String(data?.email || '').trim()
  return normalizedEmail || undefined
}

async function saveOutboundWhatsAppLog(params: {
  integration: StoredWhatsAppIntegration
  phoneNumber: string
  message: string
  messageId?: string
  agentId?: string
}): Promise<void> {
  try {
    const { saveSystemLog } = await import('../../system-logs')
    const userEmail = await resolveIntegrationUserEmail(params.integration.user_id)

    await saveSystemLog({
      user_id: params.integration.user_id || undefined,
      companies_id: params.integration.companies_id || undefined,
      user_email: userEmail,
      agent_id: params.agentId || undefined,
      log_type: 'whatsapp_outbound',
      level: 'info',
      message: `WhatsApp enviado para ${params.phoneNumber}`,
      metadata: {
        integration_id: params.integration.id,
        integration_phone_number: params.integration.phone_number,
        phone_number: params.phoneNumber,
        message_id: params.messageId || null,
        message_preview: params.message.trim().slice(0, 180)
      },
      impact_level: 'low'
    })
  } catch (logError: any) {
    logger.warn('[whatsapp.dispatcher] Falha ao salvar log de outbound WhatsApp', {
      integrationId: params.integration.id,
      error: logError?.message
    })
  }
}

async function persistMetaOutbound(
  integration: StoredWhatsAppIntegration,
  conversationIdForDb: string,
  data: SendWhatsAppInput,
  messageId?: string
): Promise<void> {
  try {
    await saveMessageToHistory(integration.id, conversationIdForDb, 'assistant', data.message)
  } catch (error: any) {
    logger.error('[whatsapp.dispatcher] Erro ao salvar histÃ³rico Redis:', {
      error: error?.message
    })
  }

  try {
    const normalizedPhone = conversationIdForDb.replace(/@s\.whatsapp\.net$/, '').trim()
    let contact = await getContactByPhoneNumber(normalizedPhone)

    if (!contact.success || !contact.contact) {
      const created = await createOrUpdateContact({
        lid: normalizedPhone,
        phone_number: normalizedPhone,
        status: 'active'
      })

      if (created.success && created.contact) {
        contact = { success: true, contact: created.contact }
      }
    }

    if (!contact.success || !contact.contact) {
      return
    }

    const metadata: Record<string, any> = {}
    metadata.whatsapp_status = 'accepted'
    metadata.whatsapp_status_updated_at = new Date().toISOString()
    if (data.context?.request_started_at) {
      metadata.request_started_at = data.context.request_started_at
    }
    if (data.context?.automation_source) {
      metadata.automation_source = data.context.automation_source
    }
    if (data.context?.flow_id) {
      metadata.flow_id = data.context.flow_id
    }
    if (data.context?.flow_execution_id) {
      metadata.flow_execution_id = data.context.flow_execution_id
    }
    if (data.messageType) {
      metadata.message_type = data.messageType
    }
    if (Array.isArray(data.buttons) && data.buttons.length > 0) {
      metadata.buttons = data.buttons.map((button) => ({
        id: button.id || null,
        text: String(button.text || '').trim()
      }))
    }

    await saveWhatsAppMessage({
      whatsapp_contact_id: contact.contact.id,
      message: data.message,
      message_id: messageId,
      direction: 'outbound',
      integrations_id: integration.id,
      agent_id: data.agentId,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined
    })

    await markMessagesAsRead(contact.contact.id, integration.id)
    await saveOutboundWhatsAppLog({
      integration,
      phoneNumber: normalizedPhone,
      message: data.message,
      messageId,
      agentId: data.agentId
    })
  } catch (error: any) {
    logger.error('[whatsapp.dispatcher] Erro ao persistir outbound Meta:', {
      error: error?.message
    })
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForImmediateMetaFailure(messageId?: string): Promise<{
  failed: boolean
  error?: string
  status?: string
}> {
  const normalizedMessageId = String(messageId || '').trim()
  if (!normalizedMessageId) {
    return { failed: false }
  }

  const maxAttempts = 6

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data, error } = await supabase
      .from('tb_whatsapp_messages')
      .select('metadata')
      .eq('message_id', normalizedMessageId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!error && Array.isArray(data) && data.length > 0) {
      const metadata =
        data[0]?.metadata && typeof data[0].metadata === 'object' && !Array.isArray(data[0].metadata)
          ? (data[0].metadata as Record<string, unknown>)
          : {}

      const status = String(metadata.whatsapp_status || '').trim().toLowerCase()
      if (status === 'failed') {
        const errorParts = [
          metadata.whatsapp_error_title,
          metadata.whatsapp_error_message,
          typeof metadata.whatsapp_error_code === 'number' ? `code ${metadata.whatsapp_error_code}` : null
        ]
          .map((part) => String(part || '').trim())
          .filter(Boolean)

        return {
          failed: true,
          status,
          error: errorParts.length > 0 ? errorParts.join(' - ') : 'Falha de entrega reportada pela Meta.'
        }
      }

      if (status === 'delivered' || status === 'read') {
        return { failed: false, status }
      }
    }

    if (attempt < maxAttempts - 1) {
      await delay(500)
    }
  }

  return { failed: false }
}

/**
 * Envio de mensagem de sessão em texto (fluxo legado — inalterado semanticamente).
 * Extraído para função nomeada; `sendViaMeta` permanece como alias estável.
 */
async function sendSessionTextViaMeta(
  integration: StoredWhatsAppIntegration,
  config: MetaWhatsAppConfig,
  data: SendWhatsAppInput
): Promise<{ success: boolean; messageId?: string; error?: string; history?: any[]; qrCode?: string; queued?: boolean; message?: string }> {
  let recipientSource = data.to
  const contactNumberResult = await getContactNumberForSending(data.to, integration.id)
  if (contactNumberResult.success && contactNumberResult.number) {
    recipientSource = contactNumberResult.number
  }

  const historyRedisRef =
    contactNumberResult.success && contactNumberResult.number
      ? `${contactNumberResult.number}@s.whatsapp.net`
      : data.to
  const history = await getHistoryFromRedis(integration.id, historyRedisRef, 10)

  const recipientNumber = formatMetaRecipient(recipientSource)

  if (!recipientNumber) {
    return {
      success: false,
      error: 'NÃ£o foi possÃ­vel determinar o destinatÃ¡rio para a Meta Cloud API.'
    }
  }

  try {
    const buttonRows = Array.isArray(data.buttons)
      ? data.buttons
          .map((button, index) => ({
            id: String(button.id || `btn_${index + 1}`).trim() || `btn_${index + 1}`,
            title: String(button.text || '').trim().slice(0, 20)
          }))
          .filter((button) => button.title)
          .slice(0, 3)
      : []

    const body =
      data.messageType === 'interactive_buttons' && buttonRows.length > 0
        ? {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipientNumber,
            type: 'interactive',
            interactive: {
              type: 'button',
              body: {
                text: data.message
              },
              action: {
                buttons: buttonRows.map((button) => ({
                  type: 'reply',
                  reply: button
                }))
              }
            }
          }
        : {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipientNumber,
            type: 'text',
            text: {
              body: data.message,
              preview_url: data.previewUrl === true
            }
          }

    const response = await axios.post(
      `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
      body,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    )

    const messageId = response.data?.messages?.[0]?.id
    const conversationIdForDb = `${recipientNumber}@s.whatsapp.net`

    await persistMetaOutbound(integration, conversationIdForDb, data, messageId)

    return {
      success: true,
      messageId,
      history
    }
  } catch (error: any) {
    const metaError =
      error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      error?.message ||
      'Erro desconhecido na Meta Cloud API'

    return {
      success: false,
      error: `Meta Cloud API: ${metaError}`
    }
  }
}

async function sendViaMeta(
  integration: StoredWhatsAppIntegration,
  config: MetaWhatsAppConfig,
  data: SendWhatsAppInput
): Promise<{ success: boolean; messageId?: string; error?: string; history?: any[]; qrCode?: string; queued?: boolean; message?: string }> {
  return sendSessionTextViaMeta(integration, config, data)
}

async function sendTemplateViaMeta(
  integration: StoredWhatsAppIntegration,
  config: MetaWhatsAppConfig,
  data: SendWhatsAppTemplateInput
): Promise<{ success: boolean; messageId?: string; error?: string; history?: any[]; queued?: boolean; message?: string }> {
  const enabled = await isTemplatesEnabledForIntegration(integration.id)
  if (!enabled) {
    return {
      success: false,
      error:
        'Envio por template desabilitado para esta integracao. Defina WHATSAPP_TEMPLATES_ENABLED=true ou habilite em tb_whatsapp_integration_feature_flags.'
    }
  }

  let recipientSource = data.to
  const contactNumberResult = await getContactNumberForSending(data.to, integration.id)
  if (contactNumberResult.success && contactNumberResult.number) {
    recipientSource = contactNumberResult.number
  }

  const historyRedisRef =
    contactNumberResult.success && contactNumberResult.number
      ? `${contactNumberResult.number}@s.whatsapp.net`
      : data.to
  const history = await getHistoryFromRedis(integration.id, historyRedisRef, 10)

  const recipientNumber = formatMetaRecipient(recipientSource)

  if (!recipientNumber) {
    return {
      success: false,
      error: 'NÃ£o foi possÃ­vel determinar o destinatÃ¡rio para a Meta Cloud API.'
    }
  }

  const body = buildCloudApiTemplateMessageBody({
    toDigits: recipientNumber,
    templateName: data.templateName,
    languageCode: data.languageCode,
    components: (data.components || []) as any[]
  })

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
      body,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 45000
      }
    )

    const messageId = response.data?.messages?.[0]?.id
    const conversationIdForDb = `${recipientNumber}@s.whatsapp.net`

    const sessionPayload: SendWhatsAppInput = {
      to: data.to,
      message: `[Template] ${data.templateName} (${data.languageCode})`,
      agentId: data.agentId,
      context: {
        ...(data.context || {}),
        template_name: data.templateName,
        template_language: data.languageCode,
        message_kind: 'template'
      }
    }

    await persistMetaOutbound(integration, conversationIdForDb, sessionPayload, messageId)

    let contactUuid: string | null = null
    try {
      const normalizedPhone = conversationIdForDb.replace(/@s\.whatsapp\.net$/, '').trim()
      const c = await getContactByPhoneNumber(normalizedPhone)
      if (c.success && c.contact?.id) {
        contactUuid = c.contact.id
      }
    } catch {
      contactUuid = null
    }

    void recordWhatsappMessageEvent({
      integrations_id: integration.id,
      companies_id: integration.companies_id || null,
      whatsapp_contact_id: contactUuid,
      wamid: messageId || null,
      event_type: 'sent',
      message_kind: 'template',
      template_name: data.templateName,
      template_language: data.languageCode,
      payload: { graph_response_preview: 'ok' }
    })

    const immediateFailure = await waitForImmediateMetaFailure(messageId)
    if (immediateFailure.failed) {
      logger.warn('[whatsapp.dispatcher] Template aceito pela Meta e reprovado logo em seguida', {
        integrationId: integration.id,
        messageId,
        templateName: data.templateName,
        status: immediateFailure.status || null,
        error: immediateFailure.error || null
      })

      return {
        success: false,
        messageId,
        error: `Meta Cloud API: ${immediateFailure.error || 'Falha de entrega reportada pela Meta.'}`,
        history
      }
    }

    return {
      success: true,
      messageId,
      history
    }
  } catch (error: any) {
    const metaError =
      error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      error?.message ||
      'Erro desconhecido na Meta Cloud API'

    void recordWhatsappMessageEvent({
      integrations_id: integration.id,
      companies_id: integration.companies_id || null,
      whatsapp_contact_id: null,
      wamid: null,
      event_type: 'failed',
      message_kind: 'template',
      template_name: data.templateName,
      template_language: data.languageCode,
      error_message: String(metaError).slice(0, 2000),
      payload: {
        graph_error: error?.response?.data || null
      }
    })

    return {
      success: false,
      error: `Meta Cloud API: ${metaError}`
    }
  }
}

async function validateMetaConnection(config: MetaWhatsAppConfig): Promise<boolean> {
  try {
    await axios.get(
      `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}`,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`
        },
        params: {
          fields: 'id'
        },
        timeout: 15000
      }
    )

    return true
  } catch (error: any) {
    const metaError =
      error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      error?.message ||
      'Erro desconhecido ao validar conexao com a Meta'

    logger.warn('[whatsapp.dispatcher] Falha ao validar conexao com a Meta', {
      phoneNumberId: config.phoneNumberId,
      error: metaError
    })
    return false
  }
}

export async function sendWhatsApp(
  integrationsId: string,
  data: SendWhatsAppInput
): Promise<{ success: boolean; messageId?: string; error?: string; qrCode?: string; history?: any[]; queued?: boolean; message?: string }> {
  const integration = await getStoredWhatsAppIntegration(integrationsId)
  const metaConfig = resolveMetaConfig(integration)

  if (metaConfig && integration) {
    return sendViaMeta(integration, metaConfig, data)
  }

  logger.warn('[whatsapp.dispatcher] Integracao WhatsApp rejeitada por nao ser Meta', {
    integrationsId,
    integrationProvider: integration?.provider || null,
    hasAccessToken: !!integration?.access_token,
    hasPhoneNumberId: !!integration?.app_key
  })

  return {
    success: false,
    error: getMetaOnlyError()
  }
}

/**
 * Novo caminho: template oficial (Cloud API). Convive com {@link sendWhatsApp}; não o substitui.
 */
export async function sendWhatsAppTemplate(
  integrationsId: string,
  data: SendWhatsAppTemplateInput
): Promise<{ success: boolean; messageId?: string; error?: string; history?: any[]; queued?: boolean; message?: string }> {
  const integration = await getStoredWhatsAppIntegration(integrationsId)
  const metaConfig = resolveMetaConfig(integration)

  if (metaConfig && integration) {
    return sendTemplateViaMeta(integration, metaConfig, data)
  }

  logger.warn('[whatsapp.dispatcher] Template rejeitado: integracao nao-Meta ou incompleta', {
    integrationsId,
    integrationProvider: integration?.provider || null
  })

  return {
    success: false,
    error: getMetaOnlyError()
  }
}

export async function performWhatsAppCallAction(
  integrationsId: string,
  params: {
    callId: string
    action: WhatsAppCallAction
    session?: WhatsAppCallSessionPayload
    to?: string
  }
): Promise<{ success: boolean; error?: string }> {
  const integration = await getStoredWhatsAppIntegration(integrationsId)
  const metaConfig = resolveMetaConfig(integration)
  const normalizedCallId = String(params.callId || '').trim()

  if (!normalizedCallId) {
    return {
      success: false,
      error: 'callId e obrigatorio para recusar a ligacao.'
    }
  }

  if (!metaConfig) {
    logger.warn('[whatsapp.dispatcher] Ligacao nao recusada: integracao Meta incompleta', {
      integrationsId,
      integrationProvider: integration?.provider || null
    })
    return {
      success: false,
      error: getMetaOnlyError()
    }
  }

  try {
    await axios.post(
      `https://graph.facebook.com/${metaConfig.apiVersion}/${metaConfig.phoneNumberId}/calls`,
      {
        messaging_product: 'whatsapp',
        call_id: normalizedCallId,
        action: params.action,
        ...(params.to ? { to: formatMetaRecipient(params.to) } : {}),
        ...(params.session
          ? {
              session: {
                sdp_type: params.session.sdpType,
                sdp: params.session.sdp
              }
            }
          : {})
      },
      {
        headers: {
          Authorization: `Bearer ${metaConfig.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    )

    return { success: true }
  } catch (error: any) {
    const metaError =
      error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      error?.message ||
      'Erro desconhecido ao recusar ligacao via Meta'

    logger.warn('[whatsapp.dispatcher] Falha ao executar acao de ligacao via Meta', {
      integrationsId,
      phoneNumberId: metaConfig.phoneNumberId,
      callId: normalizedCallId,
      action: params.action,
      error: metaError
    })

    return {
      success: false,
      error: `Meta Cloud API: ${metaError}`
    }
  }
}

export function rejectWhatsAppCall(
  integrationsId: string,
  callId: string
): Promise<{ success: boolean; error?: string }> {
  return performWhatsAppCallAction(integrationsId, {
    callId,
    action: 'reject'
  })
}

export function preAcceptWhatsAppCall(
  integrationsId: string,
  callId: string,
  sdpAnswer: string
): Promise<{ success: boolean; error?: string }> {
  return performWhatsAppCallAction(integrationsId, {
    callId,
    action: 'pre_accept',
    session: {
      sdpType: 'answer',
      sdp: sdpAnswer
    }
  })
}

export function acceptWhatsAppCall(
  integrationsId: string,
  callId: string,
  sdpAnswer: string
): Promise<{ success: boolean; error?: string }> {
  return performWhatsAppCallAction(integrationsId, {
    callId,
    action: 'accept',
    session: {
      sdpType: 'answer',
      sdp: sdpAnswer
    }
  })
}

export function terminateWhatsAppCall(
  integrationsId: string,
  callId: string
): Promise<{ success: boolean; error?: string }> {
  return performWhatsAppCallAction(integrationsId, {
    callId,
    action: 'terminate'
  })
}

export async function checkConnectionStatus(
  integrationsId: string
): Promise<'connected' | 'disconnected' | 'connecting'> {
  const integration = await getStoredWhatsAppIntegration(integrationsId)
  const metaConfig = resolveMetaConfig(integration)

  if (metaConfig) {
    const isConnected = await validateMetaConnection(metaConfig)
    return isConnected ? 'connected' : 'disconnected'
  }

  logger.warn('[whatsapp.dispatcher] Status solicitado para integracao nao-Meta', {
    integrationsId,
    integrationProvider: integration?.provider || null
  })
  return 'disconnected'
}
