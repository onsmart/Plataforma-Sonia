import { Request, Response } from 'express'
import { checkConnectionStatus } from '../../services/integrations/whatsapp'
import {
  getHistoryFromRedis,
  getUnreadConversations,
  saveMessageToHistory
} from '../../services/integrations/whatsapp/whatsapp.redis'
import { createOrUpdateContact } from '../../services/integrations/whatsapp/whatsapp.contacts'
import {
  buildMetaConfigFromEnv,
  extractMetaWebhookMessages,
  isMetaWebhookPayload,
  normalizeDigits,
  validateMetaWebhookVerification
} from '../../services/integrations/whatsapp/whatsapp.meta'
import { saveWhatsAppMessage } from '../../services/integrations/whatsapp/whatsapp.service'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

type StoredWhatsAppIntegration = {
  id: string
  user_id: string | null
  phone_number: string | null
  app_key: string | null
  provider: string | null
}

function normalizePhoneNumberForDatabase(phoneNumberOrId: string): string {
  if (phoneNumberOrId.endsWith('@s.whatsapp.net')) {
    return phoneNumberOrId.replace('@s.whatsapp.net', '')
  }

  return phoneNumberOrId
}

function getIntegrationUserEmail(integrationWithUser: any): string {
  const integrationUserRaw = integrationWithUser?.tb_users

  if (Array.isArray(integrationUserRaw)) {
    return String(integrationUserRaw[0]?.email || '').trim()
  }

  return String(integrationUserRaw?.email || '').trim()
}

function isAgentActive(statusId: unknown): boolean {
  if (statusId === null || statusId === undefined) {
    return false
  }

  const numericStatus =
    typeof statusId === 'string'
      ? parseInt(statusId, 10)
      : Number(statusId)

  return numericStatus === 1
}

async function resolveStoredMetaVerifyToken(receivedToken?: string): Promise<string | undefined> {
  const envVerifyToken = buildMetaConfigFromEnv()?.verifyToken
  const normalizedToken = String(receivedToken || '').trim()

  if (!normalizedToken) {
    return envVerifyToken
  }

  if (envVerifyToken && envVerifyToken === normalizedToken) {
    return envVerifyToken
  }

  const { data, error } = await supabase
    .from('tb_integrations')
    .select('id, auth_token')
    .eq('provider', 'whatsapp')
    .eq('auth_token', normalizedToken)
    .maybeSingle()

  if (error) {
    logger.error('[verifyWhatsAppWebhook] Erro ao buscar verify token salvo na integracao', {
      error: error.message
    })
    return envVerifyToken
  }

  return String((data as any)?.auth_token || envVerifyToken || '').trim() || undefined
}

async function findMetaIntegrationForMessage(instance: string, phoneNumberId?: string): Promise<StoredWhatsAppIntegration | null> {
  const normalizedInstance = normalizeDigits(instance)
  const normalizedPhoneNumberId = String(phoneNumberId || '').trim()

  if (normalizedPhoneNumberId) {
    const { data, error } = await supabase
      .from('tb_integrations')
      .select('id, user_id, phone_number, app_key, provider')
      .eq('provider', 'whatsapp')
      .eq('app_key', normalizedPhoneNumberId)
      .maybeSingle()

    if (!error && data) {
      return data as StoredWhatsAppIntegration
    }
  }

  if (!normalizedInstance) {
    return null
  }

  const { data, error } = await supabase
    .from('tb_integrations')
    .select('id, user_id, phone_number, app_key, provider')
    .eq('provider', 'whatsapp')
    .eq('phone_number', normalizedInstance)
    .maybeSingle()

  if (!error && data) {
    return data as StoredWhatsAppIntegration
  }

  const { data: fallbackRows, error: fallbackError } = await supabase
    .from('tb_integrations')
    .select('id, user_id, phone_number, app_key, provider')
    .eq('provider', 'whatsapp')

  if (fallbackError) {
    logger.error('[receiveWhatsAppWebhook] Erro ao buscar integracao por fallback', {
      error: fallbackError.message,
      instance: normalizedInstance,
      phoneNumberId: normalizedPhoneNumberId
    })
    return null
  }

  const fallbackMatch = (fallbackRows || []).find((row: any) => {
    const storedPhoneNumber = normalizeDigits(row?.phone_number)
    const storedPhoneNumberId = String(row?.app_key || '').trim()

    return (
      (!!normalizedPhoneNumberId && storedPhoneNumberId === normalizedPhoneNumberId) ||
      (!!normalizedInstance && storedPhoneNumber === normalizedInstance)
    )
  })

  return (fallbackMatch || null) as StoredWhatsAppIntegration | null
}

export async function verifyWhatsAppWebhook(req: Request, res: Response) {
  const query = req.query as Record<string, unknown>
  const verifyToken = await resolveStoredMetaVerifyToken(String(query['hub.verify_token'] || ''))
  const verification = validateMetaWebhookVerification(query, verifyToken)

  if (verification.ok && verification.challenge) {
    logger.log('[verifyWhatsAppWebhook] Webhook da Meta verificado com sucesso')
    return res.status(200).send(verification.challenge)
  }

  if (!verifyToken) {
    logger.error('[verifyWhatsAppWebhook] WHATSAPP_META_VERIFY_TOKEN nao configurado')
    return res.status(500).json({
      error: 'WHATSAPP_META_VERIFY_TOKEN nao configurado nem salvo na integracao'
    })
  }

  logger.warn('[verifyWhatsAppWebhook] Falha na verificacao do webhook da Meta', {
    query: req.query
  })

  return res.sendStatus(403)
}

export async function getWhatsAppStatus(req: Request, res: Response) {
  try {
    const { integration_id } = req.query

    if (!integration_id) {
      return res.status(400).json({ error: 'integration_id e obrigatorio' })
    }

    const status = await checkConnectionStatus(integration_id as string)

    return res.json({
      success: true,
      status,
      message:
        status === 'connected'
          ? 'WhatsApp esta conectado'
          : status === 'connecting'
            ? 'WhatsApp esta conectando...'
            : 'WhatsApp esta desconectado. Verifique Phone Number ID, Access Token, Verify Token e o webhook da Meta.'
    })
  } catch (error: any) {
    logger.error('[getWhatsAppStatus] Erro ao verificar status', {
      error: error.message
    })
    return res.status(500).json({
      error: 'Erro ao verificar status',
      details: error.message
    })
  }
}

export async function listWhatsAppIntegrations(req: Request, res: Response) {
  try {
    const { email } = req.query

    if (!email) {
      return res.status(400).json({ error: 'email e obrigatorio' })
    }

    const { data: userData, error: userError } = await supabase
      .from('tb_users')
      .select('id')
      .eq('email', email)
      .single()

    if (userError || !userData) {
      return res.status(404).json({ error: 'Usuario nao encontrado' })
    }

    const { data: integrations, error } = await supabase
      .from('tb_integrations')
      .select('id, phone_number, provider, created_at')
      .eq('user_id', userData.id)
      .eq('provider', 'whatsapp')

    if (error) {
      throw error
    }

    return res.json({
      success: true,
      integrations: integrations || []
    })
  } catch (error: any) {
    logger.error('[listWhatsAppIntegrations] Erro ao listar integracoes', {
      error: error.message
    })
    return res.status(500).json({
      error: 'Erro ao listar integracoes',
      details: error.message
    })
  }
}

export async function receiveWhatsAppWebhook(req: Request, res: Response) {
  try {
    const webhookData = req.body

    if (!isMetaWebhookPayload(webhookData)) {
      logger.warn('[receiveWhatsAppWebhook] Payload rejeitado: somente a Meta e aceita neste endpoint', {
        bodyKeys: Object.keys(webhookData || {})
      })
      return res.status(200).json({
        received: true,
        ignored: true,
        reason: 'unsupported_payload'
      })
    }

    const extractedMessages = extractMetaWebhookMessages(webhookData)

    if (extractedMessages.length === 0) {
      logger.log('[receiveWhatsAppWebhook] Evento oficial da Meta recebido sem mensagens processaveis')
      return res.status(200).json({
        received: true,
        ignored: true,
        reason: 'no_messages'
      })
    }

    const processedMessages: any[] = []

    for (const metaMessage of extractedMessages) {
      const integration = await findMetaIntegrationForMessage(metaMessage.instance, metaMessage.phoneNumberId)

      if (!integration) {
        logger.warn('[receiveWhatsAppWebhook] Integracao Meta nao encontrada para mensagem recebida', {
          instance: metaMessage.instance,
          phoneNumberId: metaMessage.phoneNumberId,
          remoteJid: metaMessage.remoteJid
        })
        continue
      }

      const normalizedPhone = normalizePhoneNumberForDatabase(metaMessage.remoteJid)
      const contactResult = await createOrUpdateContact({
        lid: normalizedPhone,
        phone_number: normalizedPhone,
        status: 'active'
      })

      if (!contactResult.success || !contactResult.contact) {
        logger.error('[receiveWhatsAppWebhook] Erro ao criar/atualizar contato Meta', {
          integrationId: integration.id,
          phoneNumber: normalizedPhone,
          error: contactResult.error
        })
        continue
      }

      await saveMessageToHistory(integration.id, normalizedPhone, 'user', metaMessage.messageText)

      const contactId = contactResult.contact.id
      let messageDbId: string | undefined
      const dbResult = await saveWhatsAppMessage({
        whatsapp_contact_id: contactId,
        message: metaMessage.messageText,
        message_id: metaMessage.messageId,
        direction: 'inbound',
        integrations_id: integration.id
      })

      if (dbResult.success && dbResult.id) {
        messageDbId = dbResult.id
      } else {
        logger.warn('[receiveWhatsAppWebhook] Falha ao salvar mensagem inbound no banco', {
          integrationId: integration.id,
          phoneNumber: normalizedPhone,
          error: dbResult.error
        })
      }

      const { data: agent, error: agentError } = await supabase
        .from('tb_agents')
        .select('id, nome, status_id')
        .eq('integrations_id', integration.id)
        .maybeSingle()

      if (agentError) {
        logger.error('[receiveWhatsAppWebhook] Erro ao buscar agente vinculado', {
          integrationId: integration.id,
          error: agentError.message
        })
      }

      if (!agent?.id) {
        logger.warn('[receiveWhatsAppWebhook] Nenhum agente vinculado a integracao WhatsApp', {
          integrationId: integration.id
        })
      } else if (!isAgentActive(agent.status_id)) {
        logger.warn('[receiveWhatsAppWebhook] Agente vinculado esta inativo e nao sera disparado', {
          agentId: agent.id,
          agentName: agent.nome,
          status_id: agent.status_id
        })
      } else {
        const { data: integrationWithUser, error: integrationUserError } = await supabase
          .from('tb_integrations')
          .select(`
            user_id,
            phone_number,
            tb_users!inner(email)
          `)
          .eq('id', integration.id)
          .maybeSingle()

        if (integrationUserError) {
          logger.error('[receiveWhatsAppWebhook] Erro ao buscar email do dono da integracao', {
            integrationId: integration.id,
            error: integrationUserError.message
          })
        } else {
          const integrationUserEmail = getIntegrationUserEmail(integrationWithUser)

          if (integrationUserEmail) {
            const requestStartedAt = new Date().toISOString()

            void (async () => {
              try {
                const { chatWithAgent } = await import('../../services/agents/chatwithAgent')

                await chatWithAgent(
                  integrationUserEmail,
                  agent.id,
                  metaMessage.messageText,
                  {
                    channel: 'whatsapp',
                    phone_number: metaMessage.remoteJid,
                    from: metaMessage.remoteJid,
                    to: String((integrationWithUser as any)?.phone_number || metaMessage.instance || '').trim(),
                    text: metaMessage.messageText,
                    input: metaMessage.messageText,
                    userMessage: metaMessage.messageText,
                    originalMessage: metaMessage.messageText,
                    whatsappMessage: metaMessage.messageText,
                    whatsapp_contact_id: contactId,
                    integrations_id: integration.id,
                    whatsapp_message_id: messageDbId,
                    request_started_at: requestStartedAt
                  }
                )
              } catch (agentError: any) {
                logger.error('[receiveWhatsAppWebhook] Erro ao processar agente automaticamente', {
                  integrationId: integration.id,
                  agentId: agent.id,
                  error: agentError?.message
                })
              }
            })()
          } else {
            logger.warn('[receiveWhatsAppWebhook] Email do dono da integracao nao encontrado', {
              integrationId: integration.id
            })
          }
        }
      }

      processedMessages.push({
        integration_id: integration.id,
        whatsapp_contact_id: contactResult.contact.id,
        message_id: metaMessage.messageId,
        phone_number: normalizedPhone
      })
    }

    return res.status(200).json({
      received: true,
      processed: processedMessages.length,
      messages: processedMessages
    })
  } catch (error: any) {
    logger.error('[receiveWhatsAppWebhook] Erro ao processar webhook oficial da Meta', {
      error: error.message,
      stack: error.stack
    })
    return res.status(500).json({
      error: 'Erro ao processar webhook',
      details: error.message
    })
  }
}

export async function getWhatsAppHistoryEndpoint(req: Request, res: Response) {
  try {
    const { integration_id, phone_number, limit } = req.query

    if (!integration_id || !phone_number) {
      return res.status(400).json({
        error: 'integration_id e phone_number sao obrigatorios'
      })
    }

    const history = await getHistoryFromRedis(
      integration_id as string,
      phone_number as string,
      limit ? parseInt(limit as string, 10) : 20
    )

    return res.json({
      success: true,
      count: history.length,
      messages: history
    })
  } catch (error: any) {
    logger.error('[getWhatsAppHistoryEndpoint] Erro ao buscar historico', {
      error: error.message
    })
    return res.status(500).json({
      error: 'Erro ao buscar historico',
      details: error.message
    })
  }
}

export async function processPendingWhatsAppConversations(req: Request, res: Response) {
  return res.json({
    success: true,
    processed: 0,
    message: 'Meta Cloud API nao utiliza processamento manual de conversas pendentes neste endpoint.'
  })
}

export async function processQueueManually(req: Request, res: Response) {
  try {
    const { processQueue } = await import('../../services/integrations/whatsapp/whatsapp.queue.worker')
    const result = await processQueue()

    return res.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      message: `${result.processed} mensagem(ns) processada(s)`
    })
  } catch (error: any) {
    logger.error('[processQueueManually] Erro ao processar fila', {
      error: error.message
    })
    return res.status(500).json({
      error: 'Erro ao processar fila',
      details: error.message
    })
  }
}

export async function getQueueStatsEndpoint(req: Request, res: Response) {
  try {
    const { getWorkerStatus } = await import('../../services/integrations/whatsapp/whatsapp.queue.worker')
    const { getQueueStats: getStats } = await import('../../services/integrations/whatsapp/whatsapp.queue')

    const stats = await getStats()
    const workerStatus = getWorkerStatus()

    return res.json({
      success: true,
      queue: stats,
      worker: workerStatus
    })
  } catch (error: any) {
    logger.error('[getQueueStatsEndpoint] Erro ao obter estatisticas da fila', {
      error: error.message
    })
    return res.status(500).json({
      error: 'Erro ao obter estatisticas da fila',
      details: error.message
    })
  }
}

export async function getUnreadWhatsAppMessages(req: Request, res: Response) {
  try {
    const { integration_id } = req.query

    if (!integration_id) {
      return res.status(400).json({
        error: 'integration_id e obrigatorio'
      })
    }

    const unreadNumbers = await getUnreadConversations(integration_id as string)
    const unreadMessages = []

    for (const conversationId of unreadNumbers) {
      const history = await getHistoryFromRedis(integration_id as string, conversationId)

      if (history.length > 0 && history[history.length - 1].role === 'user') {
        unreadMessages.push({
          phone_number: conversationId,
          last_message: history[history.length - 1].content,
          timestamp: history[history.length - 1].timestamp
        })
      }
    }

    return res.json({
      success: true,
      count: unreadMessages.length,
      conversations: unreadMessages
    })
  } catch (error: any) {
    logger.error('[getUnreadWhatsAppMessages] Erro ao buscar mensagens nao lidas', {
      error: error.message
    })
    return res.status(500).json({
      error: 'Erro ao buscar mensagens nao lidas',
      details: error.message
    })
  }
}
