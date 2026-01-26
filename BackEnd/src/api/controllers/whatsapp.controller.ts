import { Request, Response } from 'express'
import { 
  getQRCode, 
  checkConnectionStatus, 
  sendWhatsApp
} from '../../services/integrations/whatsapp'
import { 
  saveMessageToHistory,
  getHistoryFromRedis,
  getUnreadConversations
} from '../../services/integrations/whatsapp/whatsapp.redis'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

/**
 * Obtém o QR Code do WhatsApp em base64
 */
export async function getWhatsAppQRCode(req: Request, res: Response) {
  try {
    const { integration_id } = req.query

    if (!integration_id) {
      return res.status(400).json({ error: 'integration_id é obrigatório' })
    }

    const result = await getQRCode(integration_id as string)

    if (result.isConnected) {
      return res.json({
        success: true,
        connected: true,
        message: 'WhatsApp já está conectado. QR Code não necessário.'
      })
    }

    if (!result.qrCode) {
      return res.status(404).json({ 
        error: 'QR Code não disponível. A instância pode estar já conectada ou não existe.' 
      })
    }

    return res.json({
      success: true,
      qrCode: result.qrCode,
      connected: false,
      message: 'QR Code gerado com sucesso. Escaneie com o WhatsApp para conectar.'
    })
  } catch (error: any) {
    console.error('[WhatsAppController] Erro ao obter QR Code:', error)
    return res.status(500).json({
      error: 'Erro ao obter QR Code',
      details: error.message
    })
  }
}

/**
 * Verifica o status da conexão do WhatsApp
 */
export async function getWhatsAppStatus(req: Request, res: Response) {
  try {
    const { integration_id } = req.query

    if (!integration_id) {
      return res.status(400).json({ error: 'integration_id é obrigatório' })
    }

    const status = await checkConnectionStatus(integration_id as string)

    return res.json({
      success: true,
      status: status,
      message: status === 'connected' 
        ? 'WhatsApp está conectado' 
        : status === 'connecting'
        ? 'WhatsApp está conectando...'
        : 'WhatsApp está desconectado. Escaneie o QR Code para conectar.'
    })
  } catch (error: any) {
    console.error('[WhatsAppController] Erro ao verificar status:', error)
    return res.status(500).json({
      error: 'Erro ao verificar status',
      details: error.message
    })
  }
}

/**
 * Lista integrações WhatsApp do usuário
 */
export async function listWhatsAppIntegrations(req: Request, res: Response) {
  try {
    const { email } = req.query

    if (!email) {
      return res.status(400).json({ error: 'email é obrigatório' })
    }

    // Busca o user_id pelo email
    const { data: userData, error: userError } = await supabase
      .from('tb_users')
      .select('id')
      .eq('email', email)
      .single()

    if (userError || !userData) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    // Busca integrações WhatsApp do usuário
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
    console.error('[WhatsAppController] Erro ao listar integrações:', error)
    return res.status(500).json({
      error: 'Erro ao listar integrações',
      details: error.message
    })
  }
}

/**
 * Recebe webhook da Evolution API quando uma mensagem é recebida
 * POST /whatsapp/webhook
 */
export async function receiveWhatsAppWebhook(req: Request, res: Response) {
  try {
    const webhookData = req.body

    logger.log('[receiveWhatsAppWebhook] Webhook recebido:', {
      event: webhookData.event,
      instance: webhookData.instance,
      hasData: !!webhookData.data
    })

    // Evolution API envia diferentes tipos de eventos
    // Evento principal: messages.upsert (nova mensagem recebida)
    // IMPORTANTE: Ignorar mensagens enviadas por nós (fromMe = true)
    if (webhookData.event === 'messages.upsert' && webhookData.data) {
      const messageData = webhookData.data
      const key = messageData.key
      
      // Ignora mensagens enviadas por nós
      if (key?.fromMe === true) {
        logger.log('[receiveWhatsAppWebhook] ⏭️ Mensagem enviada por nós (fromMe=true), ignorando')
        return res.json({ received: true, skipped: true, reason: 'fromMe' })
      }

      const message = messageData.message

      // Log detalhado para debug
      logger.log('[receiveWhatsAppWebhook] 📨 Dados da mensagem recebida:', {
        key: key,
        messageType: Object.keys(message || {}),
        hasConversation: !!message?.conversation,
        hasExtendedText: !!message?.extendedTextMessage,
        hasImage: !!message?.imageMessage,
        hasVideo: !!message?.videoMessage,
        hasAudio: !!message?.audioMessage,
        hasDocument: !!message?.documentMessage,
        fullMessage: JSON.stringify(message).substring(0, 500) // Primeiros 500 chars para debug
      })

      // Extrai informações da mensagem
      const from = key?.remoteJid?.replace('@s.whatsapp.net', '').replace('@c.us', '') || key?.from
      
      // Tenta extrair texto de diferentes tipos de mensagens
      let messageText = ''
      let messageType = 'text'
      
      if (message?.conversation) {
        messageText = message.conversation
        messageType = 'text'
      } else if (message?.extendedTextMessage?.text) {
        messageText = message.extendedTextMessage.text
        messageType = 'extended_text'
      } else if (message?.imageMessage?.caption) {
        messageText = message.imageMessage.caption
        messageType = 'image_with_caption'
      } else if (message?.imageMessage) {
        messageText = '[Imagem sem legenda]'
        messageType = 'image'
      } else if (message?.videoMessage?.caption) {
        messageText = message.videoMessage.caption
        messageType = 'video_with_caption'
      } else if (message?.videoMessage) {
        messageText = '[Vídeo sem legenda]'
        messageType = 'video'
      } else if (message?.audioMessage) {
        messageText = '[Áudio]'
        messageType = 'audio'
      } else if (message?.documentMessage) {
        messageText = `[Documento: ${message.documentMessage.fileName || 'arquivo'}]`
        messageType = 'document'
      } else if (message?.stickerMessage) {
        messageText = '[Figurinha]'
        messageType = 'sticker'
      } else if (message?.locationMessage) {
        messageText = '[Localização]'
        messageType = 'location'
      } else if (message?.contactMessage) {
        messageText = '[Contato]'
        messageType = 'contact'
      } else {
        // Se não conseguiu identificar, salva o tipo de mensagem
        messageText = `[Mensagem: ${Object.keys(message || {}).join(', ') || 'desconhecido'}]`
        messageType = 'unknown'
      }

      if (!from) {
        logger.warn('[receiveWhatsAppWebhook] ⚠️ Mensagem sem remetente (from), ignorando:', {
          key: key,
          messageType: messageType
        })
        return res.json({ received: true, skipped: true, reason: 'no_from' })
      }

      // Salva mesmo se não tiver texto (para ter registro de todas as mensagens)
      if (!messageText || messageText.trim() === '') {
        messageText = `[${messageType}]`
        logger.log('[receiveWhatsAppWebhook] ℹ️ Mensagem sem texto extraível, salvando com tipo:', {
          messageType: messageType,
          from: from
        })
      }

      // Normaliza o número (remove @s.whatsapp.net, etc)
      const phoneNumber = from.replace(/\D/g, '')

      // Busca a integração pelo instanceName (que é o phone_number da integração)
      const instanceName = webhookData.instance
      
      logger.log('[receiveWhatsAppWebhook] 🔍 Buscando integração:', {
        instanceName: instanceName,
        instanceType: typeof instanceName
      })

      // Tenta buscar com o instanceName exato
      let { data: integration, error: integrationError } = await supabase
        .from('tb_integrations')
        .select('id, phone_number')
        .eq('phone_number', instanceName)
        .eq('provider', 'whatsapp')
        .single()

      // Se não encontrar, tenta buscar todas as integrações para debug
      if (integrationError || !integration) {
        logger.warn('[receiveWhatsAppWebhook] ⚠️ Integração não encontrada com instanceName exato, buscando todas para debug...')
        
        const { data: allIntegrations } = await supabase
          .from('tb_integrations')
          .select('id, phone_number, provider')
          .eq('provider', 'whatsapp')

        logger.log('[receiveWhatsAppWebhook] 📋 Integrações WhatsApp disponíveis no banco:', {
          count: allIntegrations?.length || 0,
          integrations: allIntegrations?.map(i => ({
            id: i.id,
            phone_number: i.phone_number
          })) || []
        })

        logger.error('[receiveWhatsAppWebhook] ❌ Integração não encontrada:', {
          instanceName: instanceName,
          error: integrationError?.message,
          hint: 'Verifique se o instanceName da Evolution API corresponde ao phone_number no banco'
        })
        return res.json({ 
          received: true, 
          error: 'Integration not found',
          instanceName: instanceName,
          availableIntegrations: allIntegrations?.map(i => i.phone_number) || []
        })
      }

      logger.log('[receiveWhatsAppWebhook] ✅ Integração encontrada:', {
        integrationId: integration.id,
        phoneNumber: integration.phone_number,
        instanceName: instanceName
      })

      // Salva mensagem no Redis (histórico temporário)
      logger.log('[receiveWhatsAppWebhook] 💾 Salvando mensagem no Redis:', {
        phoneNumber,
        messageType: messageType,
        messageLength: messageText.length,
        messagePreview: messageText.substring(0, 100)
      })

      const redisResult = await saveMessageToHistory(
        integration.id,
        phoneNumber,
        'user',
        messageText
      )

      if (redisResult.success) {
        logger.log('[receiveWhatsAppWebhook] ✅ Mensagem salva no Redis:', {
          phoneNumber,
          messageType: messageType
        })
      } else {
        logger.error('[receiveWhatsAppWebhook] ⚠️ Erro ao salvar no Redis:', {
          error: redisResult.error,
          phoneNumber
        })
        // Continua mesmo se falhar (não bloqueia webhook)
      }

      // 🤖 Processar automaticamente com o agente (se configurado)
      if (redisResult.success) {
        try {
          // Busca o agente associado a esta integração
          const { data: agent, error: agentError } = await supabase
            .from('tb_agents')
            .select('id, nome, integrations_id')
            .eq('integrations_id', integration.id)
            .single()

          if (agentError || !agent) {
            logger.warn('[receiveWhatsAppWebhook] ⚠️ Agente não encontrado ou não configurado para esta integração:', {
              integrationId: integration.id,
              error: agentError?.message
            })
            // Continua normalmente mesmo sem agente
          } else {
            // Busca o email do usuário através da integração
            const { data: integrationWithUser, error: userError } = await supabase
              .from('tb_integrations')
              .select(`
                user_id,
                tb_users!inner(email)
              `)
              .eq('id', integration.id)
              .single()

            if (userError || !integrationWithUser) {
              logger.error('[receiveWhatsAppWebhook] ❌ Erro ao buscar usuário:', {
                error: userError?.message
              })
            } else {
              const userEmail = (integrationWithUser.tb_users as any)?.email

              if (!userEmail) {
                logger.error('[receiveWhatsAppWebhook] ❌ Email do usuário não encontrado')
              } else {
                logger.log('[receiveWhatsAppWebhook] 🤖 Processando mensagem com agente...', {
                  agentId: agent.id,
                  agentName: agent.nome,
                  phoneNumber,
                  userEmail
                })

                // Importa chatWithAgent dinamicamente para evitar dependência circular
                const { chatWithAgent } = await import('../../services/agents/chatwithAgent')
                
                // Busca histórico do Redis antes de processar (para contexto)
                const history = await getHistoryFromRedis(
                  integration.id,
                  phoneNumber,
                  10 // últimas 10 mensagens
                )

                logger.log('[receiveWhatsAppWebhook] 📚 Histórico encontrado no Redis:', {
                  count: history.length
                })

                // Prepara mensagem para o agente
                // O chatWithAgent já busca histórico automaticamente do Redis
                // Mas passamos aqui também para garantir contexto
                const context = {
                  phone_number: phoneNumber,
                  from: phoneNumber,
                  to: phoneNumber, // Para responder ao mesmo número
                  integration_id: integration.id
                }
                
                // Processa a mensagem com o agente
                // O chatWithAgent busca histórico do Redis automaticamente
                const agentResponse = await chatWithAgent(
                  userEmail,
                  agent.id,
                  messageText,
                  context
                )

                logger.log('[receiveWhatsAppWebhook] ✅ Resposta do agente processada:', {
                  responseLength: agentResponse?.length || 0,
                  responsePreview: agentResponse?.substring(0, 100) || '',
                  hasHistory: history.length > 0
                })

                // A resposta já foi enviada automaticamente pelo chatWithAgent
                // quando ele detecta a ação send_whatsapp e salva no Redis
              }
            }
          }
        } catch (processError: any) {
          // Não bloqueia o webhook se falhar o processamento
          logger.error('[receiveWhatsAppWebhook] ⚠️ Erro ao processar com agente (não bloqueia webhook):', {
            error: processError?.message,
            stack: processError?.stack
          })
        }
      }

      return res.json({ 
        received: true, 
        saved: redisResult.success,
        processed: true
      })
    }

    // Outros eventos (connection.update, qrcode.updated, etc) - apenas log
    logger.log('[receiveWhatsAppWebhook] Evento processado:', {
      event: webhookData.event,
      instance: webhookData.instance
    })

    return res.json({ received: true })
  } catch (error: any) {
    logger.error('[receiveWhatsAppWebhook] ❌ Erro ao processar webhook:', {
      error: error.message,
      stack: error.stack
    })
    // Retorna 200 mesmo com erro para não fazer a Evolution API reenviar
    return res.status(200).json({ 
      received: true, 
      error: error.message 
    })
  }
}

/**
 * Busca histórico de mensagens de um número (do Redis)
 * GET /whatsapp/history?integration_id=xxx&phone_number=xxx&limit=10
 */
export async function getWhatsAppHistoryEndpoint(req: Request, res: Response) {
  try {
    const { integration_id, phone_number, limit } = req.query

    if (!integration_id || !phone_number) {
      return res.status(400).json({ 
        error: 'integration_id e phone_number são obrigatórios' 
      })
    }

    const history = await getHistoryFromRedis(
      integration_id as string,
      phone_number as string,
      limit ? parseInt(limit as string) : 20
    )

    return res.json({
      success: true,
      count: history.length,
      messages: history
    })
  } catch (error: any) {
    logger.error('[WhatsAppController] Erro ao buscar histórico:', error)
    return res.status(500).json({
      error: 'Erro ao buscar histórico',
      details: error.message
    })
  }
}

/**
 * Busca conversas não lidas (do Redis)
 * GET /whatsapp/unread?integration_id=xxx
 */
export async function getUnreadWhatsAppMessages(req: Request, res: Response) {
  try {
    const { integration_id } = req.query

    if (!integration_id) {
      return res.status(400).json({ 
        error: 'integration_id é obrigatório' 
      })
    }

    const unreadNumbers = await getUnreadConversations(integration_id as string)

    // Busca histórico de cada conversa não lida
    const unreadMessages = []
    for (const phoneNumber of unreadNumbers) {
      const history = await getHistoryFromRedis(integration_id as string, phoneNumber)
      if (history.length > 0 && history[history.length - 1].role === 'user') {
        unreadMessages.push({
          phone_number: phoneNumber,
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
    logger.error('[WhatsAppController] Erro ao buscar mensagens não lidas:', error)
    return res.status(500).json({
      error: 'Erro ao buscar mensagens não lidas',
      details: error.message
    })
  }
}
