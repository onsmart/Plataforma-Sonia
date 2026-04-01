import axios from 'axios'
import logger from '../../../lib/logger'
import { supabase } from '../../../lib/supabase'
import {
  buildMetaConfigFromEnv,
  formatMetaRecipient,
  normalizeDigits,
  type MetaWhatsAppConfig
} from './whatsapp.meta'
import {
  getContactNumberForSending,
  markMessagesAsRead,
  saveWhatsAppMessage,
  type SendWhatsAppInput
} from './whatsapp.service'
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
  const envConfig = buildMetaConfigFromEnv()

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
    apiVersion: envConfig?.apiVersion || 'v23.0',
    accessToken,
    phoneNumberId,
    verifyToken: integration?.auth_token || envConfig?.verifyToken,
    businessPhoneNumber: normalizeDigits(integration?.phone_number || envConfig?.businessPhoneNumber || '')
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

async function sendViaMeta(
  integration: StoredWhatsAppIntegration,
  config: MetaWhatsAppConfig,
  data: SendWhatsAppInput
): Promise<{ success: boolean; messageId?: string; error?: string; history?: any[]; qrCode?: string; queued?: boolean; message?: string }> {
  const history = await getHistoryFromRedis(integration.id, data.to, 10)

  let recipientSource = data.to
  const contactNumberResult = await getContactNumberForSending(data.to, integration.id)
  if (contactNumberResult.success && contactNumberResult.number) {
    recipientSource = contactNumberResult.number
  }

  const recipientNumber = formatMetaRecipient(recipientSource)

  if (!recipientNumber) {
    return {
      success: false,
      error: 'NÃ£o foi possÃ­vel determinar o destinatÃ¡rio para a Meta Cloud API.'
    }
  }

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientNumber,
        type: 'text',
        text: {
          body: data.message,
          preview_url: false
        }
      },
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
