import { Request, Response } from 'express'
import { 
  getQRCode, 
  checkConnectionStatus, 
  sendWhatsApp,
  resolveConversationId
} from '../../services/integrations/whatsapp'
import { 
  saveMessageToHistory,
  getHistoryFromRedis,
  getUnreadConversations,
  saveLidToRealNumberMapping,
  getRealNumberFromLid
} from '../../services/integrations/whatsapp/whatsapp.redis'
import {
  createOrUpdateContact,
  getContactByLid,
  getContactByPhoneNumber,
  updateContactPhoneNumber
} from '../../services/integrations/whatsapp/whatsapp.contacts'
import { extractPhoneNumberFromText } from '../../services/integrations/whatsapp/whatsapp.utils'
import {
  buildMetaConfigFromEnv,
  buildPseudoEvolutionWebhookFromMeta,
  isMetaWebhookPayload,
  normalizeDigits,
  validateMetaWebhookVerification
} from '../../services/integrations/whatsapp/whatsapp.meta'
// Removido: createOrUpdateConversation - usando apenas tb_whatsapp_messages
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import axios from 'axios'

/**
 * Normaliza o número de telefone para salvar no banco de dados
 * - Se terminar com @s.whatsapp.net: extrai apenas o número (remove o sufixo)
 * - Caso contrário: mantém o ID completo (pode ser @lid ou outro formato)
 */
function normalizePhoneNumberForDatabase(phoneNumberOrId: string): string {
  if (phoneNumberOrId.endsWith('@s.whatsapp.net')) {
    // Extrai apenas o número (remove @s.whatsapp.net)
    const number = phoneNumberOrId.replace('@s.whatsapp.net', '')
    return number
  } else {
    // Mantém o ID completo (pode ser @lid ou outro formato)
    return phoneNumberOrId
  }
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
    .select('id, api_key')
    .eq('provider', 'whatsapp')
    .eq('api_key', normalizedToken)
    .maybeSingle()

  if (error) {
    logger.error('[verifyWhatsAppWebhook] Erro ao buscar verify token salvo na integracao', {
      error: error.message
    })
    return envVerifyToken
  }

  return String(data?.api_key || envVerifyToken || '').trim() || undefined
}

export async function verifyWhatsAppWebhook(req: Request, res: Response) {
  const query = req.query as Record<string, unknown>
  const verifyToken = await resolveStoredMetaVerifyToken(String(query['hub.verify_token'] || ''))
  const verification = validateMetaWebhookVerification(
    query,
    verifyToken
  )

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
 * Busca o número real de um contato usando o ID do WhatsApp
 * Quando recebemos um ID @lid, precisamos buscar o número real na Evolution API
 */
async function getRealPhoneNumberFromContact(
  instanceName: string,
  contactId: string,
  apiUrl: string,
  apiKey: string
): Promise<string | null> {
  try {
    // Remove sufixos do ID
    const cleanId = contactId.replace(/@lid|@s\.whatsapp\.net|@c\.us|@g\.us/gi, '')
    
    logger.log('[getRealPhoneNumberFromContact] 🔍 Buscando número real do usuário:', {
      instanceName,
      contactId,
      cleanId,
      apiUrl
    })
    
    // Tentativa 1: Buscar com @s.whatsapp.net
    logger.log('[getRealPhoneNumberFromContact] 📞 Tentativa 1: Buscando com @s.whatsapp.net...')
    try {
      const response1 = await axios.get(
        `${apiUrl}/contact/fetchStatus/${instanceName}`,
        {
          headers: {
            'apikey': apiKey,
            'Content-Type': 'application/json'
          },
          params: {
            remoteJid: `${cleanId}@s.whatsapp.net`
          },
          timeout: 10000
        }
      )

      logger.log('[getRealPhoneNumberFromContact] Resposta tentativa 1:', {
        status: response1.status,
        data: response1.data,
        hasNumber: !!response1.data?.number,
        hasId: !!response1.data?.id
      })
      
      // Verifica campo number
      if (response1.data?.number) {
        const number = String(response1.data.number).replace(/\D/g, '')
        if (number.length <= 15 && number.length >= 10 && !number.startsWith('14') && !number.startsWith('17')) {
          logger.log('[getRealPhoneNumberFromContact] ✅ Número encontrado na tentativa 1:', number)
          return number
        }
      }
      
      // Verifica campo id (pode conter número real)
      if (response1.data?.id) {
        const idStr = String(response1.data.id)
        const idNumber = idStr.replace(/@s\.whatsapp\.net|@c\.us|@g\.us|@lid/gi, '').replace(/\D/g, '')
        if (idNumber.length <= 15 && idNumber.length >= 10 && !idNumber.startsWith('14') && !idNumber.startsWith('17')) {
          logger.log('[getRealPhoneNumberFromContact] ✅ Número encontrado no campo id:', idNumber)
          return idNumber
        }
      }
    } catch (err1: any) {
      logger.warn('[getRealPhoneNumberFromContact] Erro na tentativa 1:', {
        error: err1?.response?.data || err1?.message,
        status: err1?.response?.status
      })
    }

    // Tentativa 2: Buscar com @lid (se o ID parece ser um @lid)
    if (cleanId.length >= 15 || cleanId.startsWith('14') || cleanId.startsWith('17')) {
      logger.log('[getRealPhoneNumberFromContact] 📞 Tentativa 2: Buscando com @lid...')
      try {
        const response2 = await axios.get(
          `${apiUrl}/contact/fetchStatus/${instanceName}`,
          {
            headers: {
              'apikey': apiKey,
              'Content-Type': 'application/json'
            },
            params: {
              remoteJid: `${cleanId}@lid`
            },
            timeout: 10000
          }
        )

        logger.log('[getRealPhoneNumberFromContact] Resposta tentativa 2:', {
          status: response2.status,
          data: response2.data,
          hasNumber: !!response2.data?.number
        })

        if (response2.data?.number) {
          const number = String(response2.data.number).replace(/\D/g, '')
          if (number.length <= 15 && number.length >= 10 && !number.startsWith('14') && !number.startsWith('17')) {
            logger.log('[getRealPhoneNumberFromContact] ✅ Número encontrado na tentativa 2:', number)
            return number
          }
        }
      } catch (err2: any) {
        logger.warn('[getRealPhoneNumberFromContact] Erro na tentativa 2:', {
          error: err2?.response?.data || err2?.message
        })
      }
    }

    // Tentativa 3: Buscar todos os contatos e filtrar pelo ID
    logger.log('[getRealPhoneNumberFromContact] 📞 Tentativa 3: Buscando todos os contatos...')
    try {
      const contactsResponse = await axios.get(
        `${apiUrl}/contact/fetchContacts/${instanceName}`,
        {
          headers: {
            'apikey': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      )

      if (contactsResponse?.data && Array.isArray(contactsResponse.data)) {
        logger.log('[getRealPhoneNumberFromContact] Total de contatos encontrados:', contactsResponse.data.length)
        
        // Procura o contato que corresponde ao ID
        const contact = contactsResponse.data.find((c: any) => {
          const contactIdStr = String(c.id || c.remoteJid || '').replace(/@.*$/, '').replace(/\D/g, '')
          return contactIdStr === cleanId || contactIdStr.includes(cleanId) || cleanId.includes(contactIdStr)
        })

        if (contact) {
          logger.log('[getRealPhoneNumberFromContact] Contato encontrado na lista:', {
            contactId: contact.id,
            contactRemoteJid: contact.remoteJid,
            contactNumber: contact.number,
            contactName: contact.name
          })
          
          if (contact.number) {
            const number = String(contact.number).replace(/\D/g, '')
            if (number.length <= 15 && number.length >= 10 && !number.startsWith('14') && !number.startsWith('17')) {
              logger.log('[getRealPhoneNumberFromContact] ✅ Número encontrado na tentativa 3:', number)
              return number
            }
          }
          
          // Tenta extrair do remoteJid se não tiver number
          if (contact.remoteJid) {
            const remoteJidStr = String(contact.remoteJid)
            const number = remoteJidStr.replace(/@s\.whatsapp\.net|@c\.us|@g\.us|@lid/gi, '').replace(/\D/g, '')
            if (number.length <= 15 && number.length >= 10 && !number.startsWith('14') && !number.startsWith('17')) {
              logger.log('[getRealPhoneNumberFromContact] ✅ Número extraído do remoteJid:', number)
              return number
            }
          }
        } else {
          logger.warn('[getRealPhoneNumberFromContact] Contato não encontrado na lista de contatos')
        }
      }
    } catch (err3: any) {
      logger.warn('[getRealPhoneNumberFromContact] Erro na tentativa 3:', {
        error: err3?.response?.data || err3?.message,
        status: err3?.response?.status
      })
    }

    // Tentativa 4: Buscar nos chats
    logger.log('[getRealPhoneNumberFromContact] 📞 Tentativa 4: Buscando nos chats...')
    try {
      const chatResponse = await axios.get(
        `${apiUrl}/chat/fetchChats/${instanceName}`,
        {
          headers: {
            'apikey': apiKey,
            'Content-Type': 'application/json'
          },
          params: {
            where: JSON.stringify({ remoteJid: `${cleanId}@s.whatsapp.net` })
          },
          timeout: 10000
        }
      )

      if (chatResponse?.data && Array.isArray(chatResponse.data) && chatResponse.data.length > 0) {
        const chat = chatResponse.data[0]
        logger.log('[getRealPhoneNumberFromContact] Chat encontrado:', {
          remoteJid: chat.remoteJid,
          id: chat.id,
          name: chat.name
        })
        
        if (chat.remoteJid) {
          const remoteJidStr = String(chat.remoteJid)
          const number = remoteJidStr.replace(/@s\.whatsapp\.net|@c\.us|@g\.us|@lid/gi, '').replace(/\D/g, '')
          if (number.length <= 15 && number.length >= 10 && !number.startsWith('14') && !number.startsWith('17')) {
            logger.log('[getRealPhoneNumberFromContact] ✅ Número encontrado na tentativa 4:', number)
            return number
          }
        }
      }
    } catch (err4: any) {
      logger.warn('[getRealPhoneNumberFromContact] Erro na tentativa 4:', {
        error: err4?.response?.data || err4?.message
      })
    }

    logger.warn('[getRealPhoneNumberFromContact] ❌ Nenhuma tentativa encontrou o número real do usuário')
    return null
  } catch (error: any) {
    logger.error('[getRealPhoneNumberFromContact] ❌ Erro geral ao buscar número real:', {
      contactId,
      error: error?.message,
      stack: error?.stack
    })
    return null
  }
}

/**
 * Recebe webhook da Evolution API quando uma mensagem é recebida
 * POST /whatsapp/webhook
 */
export async function receiveWhatsAppWebhook(req: Request, res: Response) {
  try {
    let webhookData = req.body

    if (isMetaWebhookPayload(webhookData)) {
      const transformedWebhook = buildPseudoEvolutionWebhookFromMeta(webhookData)

      if (!transformedWebhook) {
        logger.log('[receiveWhatsAppWebhook] Webhook da Meta recebido sem mensagens processÃ¡veis')
        return res.json({ received: true, skipped: true, reason: 'no_messages' })
      }

      webhookData = transformedWebhook
    }

    logger.log('[receiveWhatsAppWebhook] Webhook recebido:', {
      event: webhookData.event,
      instance: webhookData.instance,
      hasData: !!webhookData.data,
      provider: webhookData.meta?.provider || 'evolution'
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
      // Se for mensagem de grupo, usa o participant (número real do remetente)
      // Se não for grupo, usa o remoteJid (número do contato)
      let remoteJid = ''
      
      if (key?.participant) {
        // Mensagem de grupo - participant contém o número real do remetente
        remoteJid = key.participant
        logger.log('[receiveWhatsAppWebhook] 📱 Mensagem de grupo detectada, usando participant:', {
          participant: key.participant,
          remoteJid: key.remoteJid
        })
      } else {
        // Mensagem direta - remoteJid contém o número
        remoteJid = key?.remoteJid || key?.from || ''
        logger.log('[receiveWhatsAppWebhook] 📱 Mensagem direta, usando remoteJid:', {
          remoteJid: key.remoteJid,
          original: remoteJid
        })
      }
      
      if (!remoteJid) {
        logger.warn('[receiveWhatsAppWebhook] ⚠️ Mensagem sem remetente (remoteJid/participant), ignorando:', {
          key: key
        })
        return res.json({ received: true, skipped: true, reason: 'no_from' })
      }

      // PASSO CRÍTICO: Se o remoteJid é um @lid, tenta buscar o número real no Redis
      if (remoteJid && remoteJid.endsWith('@lid')) {
        console.log('\n' + '='.repeat(80))
        console.log('🔍 [receiveWhatsAppWebhook] LID DETECTADO, BUSCANDO NÚMERO REAL:')
        console.log('='.repeat(80))
        console.log('LID Original:', remoteJid)
        console.log('='.repeat(80) + '\n')
        
        logger.log('[receiveWhatsAppWebhook] 🔍 LID detectado, buscando número real:', {
          lid: remoteJid
        })
        
        const realNumber = await getRealNumberFromLid(remoteJid)
        
        if (realNumber) {
          console.log('\n' + '='.repeat(80))
          console.log('✅ [receiveWhatsAppWebhook] NÚMERO REAL ENCONTRADO:')
          console.log('='.repeat(80))
          console.log('LID Original:', remoteJid)
          console.log('Número Real Encontrado:', realNumber)
          console.log('Usando número real para processamento')
          console.log('='.repeat(80) + '\n')
          
          logger.log('[receiveWhatsAppWebhook] ✅ Número real encontrado, substituindo LID:', {
            lid: remoteJid,
            realNumber: realNumber
          })
          
          // Substitui o LID pelo número real
          remoteJid = realNumber
        } else {
          console.log('\n' + '='.repeat(80))
          console.log('⚠️ [receiveWhatsAppWebhook] NÚMERO REAL NÃO ENCONTRADO:')
          console.log('='.repeat(80))
          console.log('LID:', remoteJid)
          console.log('Mensagem será processada com LID (número real pode aparecer depois)')
          console.log('='.repeat(80) + '\n')
          
          logger.warn('[receiveWhatsAppWebhook] ⚠️ Número real não encontrado para LID, usando LID temporariamente:', {
            lid: remoteJid
          })
        }
      }

      // Identifica se é LID ou número real (após tentativa de resolução)
      const isLid = remoteJid.endsWith('@lid')
      const isRealNumber = remoteJid.endsWith('@s.whatsapp.net')
      
      logger.log('[receiveWhatsAppWebhook] 🔍 Identificador da mensagem (após resolução):', {
        remoteJid,
        isLid,
        isRealNumber
      })
      
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

      // Salva mesmo se não tiver texto (para ter registro de todas as mensagens)
      if (!messageText || messageText.trim() === '') {
        messageText = `[${messageType}]`
        logger.log('[receiveWhatsAppWebhook] ℹ️ Mensagem sem texto extraível, salvando com tipo:', {
          messageType: messageType,
          remoteJid: remoteJid
        })
      }
      
      // Busca a integração pelo instanceName (que é o phone_number da integração)
      const instanceName = String(webhookData.instance || '')
      const normalizedInstance = normalizeDigits(instanceName)
      const metaPhoneNumberId = String(webhookData.meta?.phoneNumberId || '').trim()
      
      logger.log('[receiveWhatsAppWebhook] 🔍 Buscando integração:', {
        instanceName: instanceName,
        normalizedInstance: normalizedInstance,
        metaPhoneNumberId: metaPhoneNumberId
      })

      // Tenta buscar com o instanceName exato (usa maybeSingle para não dar erro se não encontrar)
      let { data: integration, error: integrationError } = await supabase
        .from('tb_integrations')
        .select('id, phone_number, app_key')
        .eq('phone_number', instanceName)
        .maybeSingle() // Usa maybeSingle ao invés de single para não dar erro se não encontrar

      // Se nao encontrar, tenta buscar todas as integracoes para debug
      if (integrationError || !integration) {
        logger.warn('[receiveWhatsAppWebhook] Integracao nao encontrada com instanceName exato, buscando fallback...')
        
        const { data: allIntegrations } = await supabase
          .from('tb_integrations')
          .select('id, phone_number, provider, app_key')
          .not('phone_number', 'is', null)

        const matchedIntegration = (allIntegrations || []).find((item: any) => {
          const storedPhoneNumber = String(item?.phone_number || '').trim()
          const normalizedPhoneNumber = normalizeDigits(storedPhoneNumber)
          const storedPhoneNumberId = String(item?.app_key || '').trim()

          return (
            (!!instanceName && storedPhoneNumber === instanceName) ||
            (!!normalizedInstance && normalizedPhoneNumber === normalizedInstance) ||
            (!!metaPhoneNumberId && storedPhoneNumberId === metaPhoneNumberId)
          )
        })

        if (matchedIntegration) {
          integration = matchedIntegration
          integrationError = null

          logger.log('[receiveWhatsAppWebhook] Integracao encontrada no fallback:', {
            integrationId: matchedIntegration.id,
            phoneNumber: matchedIntegration.phone_number,
            phoneNumberId: matchedIntegration.app_key,
            matchedBy:
              metaPhoneNumberId && String(matchedIntegration.app_key || '').trim() === metaPhoneNumberId
                ? 'phone_number_id'
                : normalizedInstance && normalizeDigits(matchedIntegration.phone_number) === normalizedInstance
                ? 'normalized_phone_number'
                : 'instance_name'
          })
        }

        logger.log('[receiveWhatsAppWebhook] Integracoes WhatsApp disponiveis no banco:', {
          count: allIntegrations?.length || 0,
          integrations: allIntegrations?.map(i => ({
            id: i.id,
            phone_number: i.phone_number,
            app_key: i.app_key
          })) || []
        })

        if (!integration) {
          logger.error('[receiveWhatsAppWebhook] Integracao nao encontrada:', {
            instanceName: instanceName,
            error: integrationError?.message,
            hint: 'Verifique se o phone_number esta salvo com apenas digitos ou se o app_key contem o Phone Number ID da Meta.'
          })
          
          // Salva no Redis mesmo sem integracao (para nao perder mensagens)
          // Usa um ID temporario baseado no instanceName
          const tempIntegrationId = `temp_${instanceName}`
          try {
            const redisResult = await saveMessageToHistory(
              tempIntegrationId,
              remoteJid,
              'user',
              messageText
            )
            
            if (redisResult.success) {
              logger.log('[receiveWhatsAppWebhook] Mensagem salva no Redis sem integracao no banco:', {
                remoteJid,
                tempIntegrationId
              })
            }
          } catch (redisError: any) {
            logger.error('[receiveWhatsAppWebhook] Erro ao salvar no Redis:', {
              error: redisError?.message
            })
          }
          
          return res.json({ 
            received: true, 
            error: 'Integration not found',
            instanceName: instanceName,
            savedToRedis: true,
            availableIntegrations: allIntegrations?.map(i => i.phone_number) || [],
            hint: 'Crie a integracao no Supabase com phone_number = ' + (normalizedInstance || instanceName)
          })
        }
      }

      logger.log('[receiveWhatsAppWebhook] ✅ Integração encontrada:', {
        integrationId: integration.id,
        phoneNumber: integration.phone_number,
        instanceName: instanceName
      })

      // PASSO 2: Gerencia contato (tb_whatsapp_contacts)
      // Se for @lid, cria/atualiza contato com status 'awaiting_phone'
      // Se for número real, cria/atualiza contato com status 'active'
      let contactId: string | null = null
      let originalRemoteJid = remoteJid // Guarda o original para logs
      
      try {
        if (isLid) {
          // É @lid - cria/atualiza contato com status 'awaiting_phone'
          console.log('\n' + '='.repeat(80))
          console.log('📝 [receiveWhatsAppWebhook] CRIANDO/ATUALIZANDO CONTATO COM @LID:')
          console.log('='.repeat(80))
          console.log('LID:', remoteJid)
          console.log('Status: awaiting_phone')
          console.log('='.repeat(80) + '\n')
          
          const contactResult = await createOrUpdateContact({
            lid: remoteJid,
            status: 'awaiting_phone'
          })
          
          if (contactResult.success && contactResult.contact) {
            contactId = contactResult.contact.id
            logger.log('[receiveWhatsAppWebhook] ✅ Contato criado/atualizado (LID):', {
              contactId,
              lid: remoteJid,
              status: contactResult.contact.status
            })
          } else {
            logger.error('[receiveWhatsAppWebhook] ❌ Erro ao criar/atualizar contato:', {
              error: contactResult.error
            })
          }
        } else if (isRealNumber) {
          // É número real - cria/atualiza contato com status 'active'
          const normalizedPhone = remoteJid.replace(/@s\.whatsapp\.net$/, '').trim()
          
          console.log('\n' + '='.repeat(80))
          console.log('📝 [receiveWhatsAppWebhook] CRIANDO/ATUALIZANDO CONTATO COM NÚMERO REAL:')
          console.log('='.repeat(80))
          console.log('Número Real:', remoteJid)
          console.log('Número Normalizado:', normalizedPhone)
          console.log('Status: active')
          console.log('='.repeat(80) + '\n')
          
          // Busca se já existe contato com este número
          const existingContact = await getContactByPhoneNumber(normalizedPhone)
          
          if (existingContact.success && existingContact.contact) {
            // Já existe, apenas atualiza
            contactId = existingContact.contact.id
            logger.log('[receiveWhatsAppWebhook] ✅ Contato existente encontrado:', {
              contactId,
              phone_number: normalizedPhone
            })
          } else {
            // Cria novo contato (sem LID, apenas número)
            const contactResult = await createOrUpdateContact({
              lid: normalizedPhone, // Usa número como LID temporário
              phone_number: normalizedPhone,
              status: 'active'
            })
            
            if (contactResult.success && contactResult.contact) {
              contactId = contactResult.contact.id
              logger.log('[receiveWhatsAppWebhook] ✅ Contato criado (número real):', {
                contactId,
                phone_number: normalizedPhone
              })
            }
          }
        }
      } catch (contactError: any) {
        logger.error('[receiveWhatsAppWebhook] ⚠️ Erro ao gerenciar contato (não bloqueia webhook):', {
          error: contactError?.message
        })
      }

      // PASSO 3: Detecta número na mensagem (se contato está 'awaiting_phone')
      // Se a mensagem contém um número de telefone, atualiza o contato
      if (contactId && isLid && messageText) {
        const extractedPhone = extractPhoneNumberFromText(messageText)
        
        if (extractedPhone) {
          console.log('\n' + '='.repeat(80))
          console.log('🔍 [receiveWhatsAppWebhook] NÚMERO DETECTADO NA MENSAGEM:')
          console.log('='.repeat(80))
          console.log('Mensagem:', messageText)
          console.log('Número Extraído:', extractedPhone)
          console.log('Atualizando contato...')
          console.log('='.repeat(80) + '\n')
          
          logger.log('[receiveWhatsAppWebhook] 🔍 Número detectado na mensagem:', {
            messageText: messageText.substring(0, 100),
            extractedPhone,
            contactId
          })
          
          const updateResult = await updateContactPhoneNumber(remoteJid, extractedPhone)
          
          if (updateResult.success && updateResult.contact) {
            console.log('\n' + '='.repeat(80))
            console.log('✅ [receiveWhatsAppWebhook] CONTATO ATUALIZADO COM NÚMERO:')
            console.log('='.repeat(80))
            console.log('Contact ID:', updateResult.contact.id)
            console.log('LID:', updateResult.contact.lid)
            console.log('Phone Number:', updateResult.contact.phone_number)
            console.log('Status:', updateResult.contact.status)
            console.log('='.repeat(80) + '\n')
            
            logger.log('[receiveWhatsAppWebhook] ✅ Contato atualizado com número:', {
              contactId: updateResult.contact.id,
              phone_number: updateResult.contact.phone_number,
              status: updateResult.contact.status
            })
            
            // Salva mapeamento no Redis também
            await saveLidToRealNumberMapping(
              remoteJid,
              `${extractedPhone}@s.whatsapp.net`
            )
          }
        }
      }

      // PASSO 4: Salva mensagem no Redis (histórico temporário)
      // Usa o LID original ou número real para chave do Redis
      const redisKey = isLid ? remoteJid : (isRealNumber ? remoteJid : remoteJid)
      
      logger.log('[receiveWhatsAppWebhook] 💾 Salvando mensagem no Redis:', {
        remoteJid: redisKey,
        messageType: messageType,
        messageLength: messageText.length,
        messagePreview: messageText.substring(0, 100),
        isLid,
        isRealNumber
      })

      const redisResult = await saveMessageToHistory(
        integration.id,
        redisKey,
        'user',
        messageText
      )

      if (redisResult.success) {
        logger.log('[receiveWhatsAppWebhook] ✅ Mensagem salva no Redis:', {
          remoteJid: redisKey,
          messageType: messageType
        })
      } else {
        logger.error('[receiveWhatsAppWebhook] ⚠️ Erro ao salvar no Redis:', {
          error: redisResult.error,
          remoteJid: redisKey
        })
      }

      // PASSO 5: Salva mensagem no banco de dados (tb_whatsapp_messages)
      // Agora usa whatsapp_contact_id em vez de phone_number
      let savedToDatabase = false
      let messageDbId: string | undefined
      
      if (!contactId) {
        logger.warn('[receiveWhatsAppWebhook] ⚠️ ContactId não disponível, não será possível salvar mensagem no banco')
      } else {
        try {
          logger.log('[receiveWhatsAppWebhook] 💾 Salvando mensagem no banco:', {
            whatsapp_contact_id: contactId,
            original: originalRemoteJid,
            messageLength: messageText.length,
            isLid
          })
          
          const { saveWhatsAppMessage } = await import('../../services/integrations/whatsapp/whatsapp.service')
          const dbResult = await saveWhatsAppMessage({
            whatsapp_contact_id: contactId,
            message: messageText,
            message_id: key?.id,
            direction: 'inbound',
            integrations_id: integration.id
          })
          
          if (dbResult.success && dbResult.id) {
            messageDbId = dbResult.id
            savedToDatabase = true
            
            logger.log('[receiveWhatsAppWebhook] ✅ Mensagem salva no banco:', {
              messageId: messageDbId,
              whatsapp_contact_id: contactId,
              original: originalRemoteJid
            })
          } else {
            logger.error('[receiveWhatsAppWebhook] ⚠️ Erro ao salvar no banco:', {
              error: dbResult.error
            })
          }
        } catch (dbError: any) {
          logger.error('[receiveWhatsAppWebhook] ⚠️ Erro ao salvar no banco (não bloqueia webhook):', {
            error: dbError?.message
          })
        }
      }

      // PASSO 4: Adiciona mensagem à fila para processamento assíncrono
      // O worker vai processar quando a conversa estiver pronta
      try {
        // Busca agente e usuário para adicionar à fila
        const { data: agent } = await supabase
          .from('tb_agents')
          .select('id, nome, status_id')
          .eq('integrations_id', integration.id)
          .maybeSingle()

        // 🛡️ GUARDRAIL: Valida status_id ANTES de processar
        if (agent) {
          const statusId = agent.status_id !== null && agent.status_id !== undefined
            ? (typeof agent.status_id === 'string' ? parseInt(agent.status_id, 10) : Number(agent.status_id))
            : null

          if (statusId !== 1) {
            const reason = statusId === 2 ? 'cancelado' : statusId === 3 || statusId === 4 ? 'pausado' : 'inativo'
            logger.warn('[receiveWhatsAppWebhook] 🛡️ GUARDRAIL: Agente bloqueado - não está ativo:', {
              agentId: agent.id,
              agentNome: agent.nome,
              status_id: statusId,
              reason,
              contactId
            })
            // Salva mensagem no banco, mas não processa
            return res.json({ 
              received: true, 
              savedToRedis: redisResult.success,
              savedToDatabase: savedToDatabase,
              skipped: true,
              reason: `agent_${reason}`,
              contact_id: contactId
            })
          }
        }

        const { data: integrationWithUser } = await supabase
          .from('tb_integrations')
          .select(`
            user_id,
            tb_users!inner(email)
          `)
          .eq('id', integration.id)
          .maybeSingle()


        const integrationUserRaw = (integrationWithUser as any)?.tb_users
        const integrationUserEmail = Array.isArray(integrationUserRaw)
          ? String(integrationUserRaw[0]?.email || '').trim()
          : String(integrationUserRaw?.email || '').trim()

        if (agent?.id && integrationUserEmail && contactId) {
          const requestStartedAt = new Date().toISOString()

          void (async () => {
            try {
              const { chatWithAgent } = await import('../../services/agents/chatwithAgent')

              logger.log('[receiveWhatsAppWebhook] Disparando agente automaticamente para mensagem recebida:', {
                agentId: agent.id,
                integrationId: integration.id,
                contactId,
                integrationUserEmail
              })

              await chatWithAgent(
                integrationUserEmail,
                agent.id,
                messageText,
                {
                  channel: 'whatsapp',
                  phone_number: remoteJid,
                  from: remoteJid,
                  to: webhookData.instance,
                  text: messageText,
                  input: messageText,
                  userMessage: messageText,
                  originalMessage: messageText,
                  whatsappMessage: messageText,
                  whatsapp_contact_id: contactId,
                  integrations_id: integration.id,
                  whatsapp_message_id: messageDbId,
                  request_started_at: requestStartedAt
                }
              )
            } catch (agentError: any) {
              logger.error('[receiveWhatsAppWebhook] Erro ao processar agente automaticamente:', {
                error: agentError?.message
              })
            }
          })()
        } else {
          logger.warn('[receiveWhatsAppWebhook] Nao foi possivel disparar o agente automaticamente:', {
            hasAgent: !!agent?.id,
            hasUserEmail: !!integrationUserEmail,
            hasContactId: !!contactId
          })
        }
        // Não adiciona mais à fila - agora enviamos diretamente para @lid
        // A fila só é usada se o envio falhar
        logger.log('[receiveWhatsAppWebhook] ℹ️ Mensagem recebida, agente encontrado:', {
          contactId,
          original: originalRemoteJid,
          hasAgent: !!agent,
          agentStatus: agent?.status_id
        })
      } catch (error: any) {
        logger.error('[receiveWhatsAppWebhook] ⚠️ Erro ao buscar agente (não bloqueia webhook):', {
          error: error?.message
        })
      }

      return res.json({ 
        received: true, 
        savedToRedis: redisResult.success,
        savedToDatabase: savedToDatabase,
        contact_id: contactId,
        original: originalRemoteJid,
        isLid,
        isRealNumber
      })
    }

    // PASSO 3: Handlers para eventos de chat (chats.upsert, chats.update)
    // Esses eventos contêm a relação entre LID e número real
    if ((webhookData.event === 'chats.upsert' || webhookData.event === 'chats.update') && webhookData.data) {
      const chatData = webhookData.data
      const instanceName = webhookData.instance
      
      logger.log('[receiveWhatsAppWebhook] 📋 Evento de chat recebido:', {
        event: webhookData.event,
        instance: instanceName,
        hasData: !!chatData
      })

      // Busca integração
      const { data: integration } = await supabase
        .from('tb_integrations')
        .select('id')
        .eq('phone_number', instanceName)
        .maybeSingle()

      if (!integration) {
        logger.warn('[receiveWhatsAppWebhook] ⚠️ Integração não encontrada para evento de chat')
        return res.json({ received: true, skipped: true, reason: 'integration_not_found' })
      }

      // Processa chats (pode ser array ou objeto único)
      const chats = Array.isArray(chatData) ? chatData : [chatData]
      
      for (const chat of chats) {
        const chatId = chat.id || chat.remoteJid || ''
        const chatLid = chat.lid || ''
        
        if (!chatId && !chatLid) continue

        // Se tem ambos (id = número real, lid = LID), atualiza pending_number nas mensagens
        if (chatId && chatLid && chatId.endsWith('@s.whatsapp.net') && chatLid.endsWith('@lid')) {
          logger.log('[receiveWhatsAppWebhook] 🔗 LID vinculado ao número real via evento de chat:', {
            lid: chatLid,
            phone_number: chatId
          })

          // Normaliza o número real para buscar no banco
          const normalizedLid = normalizePhoneNumberForDatabase(chatLid) // Mantém @lid completo
          const normalizedPhoneNumber = normalizePhoneNumberForDatabase(chatId) // Extrai apenas número
          
          // Atualiza todas as mensagens com este LID, preenchendo pending_number
          const { error: updateError } = await supabase
            .from('tb_whatsapp_messages')
            .update({ 
              pending_number: normalizedPhoneNumber // Atualiza com número real (sem @s.whatsapp.net)
            })
            .eq('phone_number', normalizedLid) // Busca mensagens com phone_number = @lid (normalizado)
            .eq('integrations_id', integration.id)
            .is('pending_number', null) // Só atualiza se ainda não tem pending_number
          
          // Busca count separadamente
          const { count } = await supabase
            .from('tb_whatsapp_messages')
            .select('*', { count: 'exact', head: true })
            .eq('phone_number', normalizedLid)
            .eq('integrations_id', integration.id)
            .eq('pending_number', normalizedPhoneNumber)

          if (updateError) {
            logger.error('[receiveWhatsAppWebhook] ❌ Erro ao atualizar pending_number:', {
              error: updateError.message
            })
          } else {
            logger.log('[receiveWhatsAppWebhook] ✅ pending_number atualizado:', {
              lid: normalizedLid,
              phone_number: normalizedPhoneNumber,
              updatedCount: count || 0
            })
          }
        } else if (chatId && chatId.endsWith('@s.whatsapp.net')) {
          // Se só tem número real, apenas log (mensagens já devem estar salvas com este número)
          logger.log('[receiveWhatsAppWebhook] 📱 Chat com número real:', {
            phone_number: chatId
          })
        } else if (chatLid && chatLid.endsWith('@lid')) {
          // Se só tem LID, apenas log (mensagens já devem estar salvas com este LID)
          logger.log('[receiveWhatsAppWebhook] 📱 Chat com LID:', {
            lid: chatLid
          })
        }
      }

      return res.json({ received: true, processed: true })
    }

    // PASSO 4: Handler para contacts.update - captura mapeamento LID → número real
    if (webhookData.event === 'contacts.update' && webhookData.data) {
      const contactsData = webhookData.data
      const instanceName = webhookData.instance
      
      console.log('\n' + '='.repeat(80))
      console.log('📞 [receiveWhatsAppWebhook] EVENTO contacts.update RECEBIDO:')
      console.log('='.repeat(80))
      console.log('Instance:', instanceName)
      console.log('Data completo:', JSON.stringify(contactsData, null, 2))
      console.log('='.repeat(80) + '\n')
      
      logger.log('[receiveWhatsAppWebhook] 📞 Evento contacts.update recebido:', {
        event: webhookData.event,
        instance: instanceName,
        hasData: !!contactsData,
        dataType: Array.isArray(contactsData) ? 'array' : typeof contactsData
      })

      // Busca integração
      const { data: integration } = await supabase
        .from('tb_integrations')
        .select('id')
        .eq('phone_number', instanceName)
        .maybeSingle()

      if (!integration) {
        logger.warn('[receiveWhatsAppWebhook] ⚠️ Integração não encontrada para contacts.update')
        return res.json({ received: true, skipped: true, reason: 'integration_not_found' })
      }

      // Processa contatos (pode ser array ou objeto único)
      const contacts = Array.isArray(contactsData) ? contactsData : [contactsData]
      
      for (const contact of contacts) {
        try {
          // Extrai LID e número real do contato
          // O evento contacts.update envia: { remoteJid: "xxx@lid", phoneNumber: "xxx" } ou similar
          const contactId = contact.remoteJid || contact.id || contact.jid || ''
          const phoneNumber = contact.phoneNumber || contact.phone || contact.number || ''
          
          console.log('\n' + '='.repeat(80))
          console.log('🔍 [receiveWhatsAppWebhook] PROCESSANDO CONTATO:')
          console.log('='.repeat(80))
          console.log('Contact completo:', JSON.stringify(contact, null, 2))
          console.log('Contact ID (LID):', contactId)
          console.log('Phone Number:', phoneNumber)
          console.log('='.repeat(80) + '\n')
          
          // Verifica se temos LID e número real
          if (contactId && contactId.endsWith('@lid') && phoneNumber) {
            // Normaliza o número real (garante formato correto)
            let normalizedPhoneNumber = phoneNumber
            if (!normalizedPhoneNumber.includes('@')) {
              normalizedPhoneNumber = `${normalizedPhoneNumber}@s.whatsapp.net`
            }
            
            console.log('\n' + '='.repeat(80))
            console.log('✅ [receiveWhatsAppWebhook] MAPEAMENTO LID → NÚMERO REAL ENCONTRADO:')
            console.log('='.repeat(80))
            console.log('LID:', contactId)
            console.log('Número Real:', phoneNumber)
            console.log('Número Real Normalizado:', normalizedPhoneNumber)
            console.log('='.repeat(80) + '\n')
            
            // Salva mapeamento no Redis
            const mappingResult = await saveLidToRealNumberMapping(contactId, normalizedPhoneNumber)
            
            if (mappingResult.success) {
              logger.log('[receiveWhatsAppWebhook] ✅ Mapeamento LID → número real salvo:', {
                lid: contactId,
                realNumber: normalizedPhoneNumber
              })
              
              // Atualiza mensagens pendentes no banco que usam este LID
              const normalizedLid = normalizePhoneNumberForDatabase(contactId)
              const normalizedRealNumber = normalizePhoneNumberForDatabase(normalizedPhoneNumber)
              
              const { count, error: updateError } = await supabase
                .from('tb_whatsapp_messages')
                .update({ 
                  pending_number: normalizedRealNumber,
                  phone_number: normalizedRealNumber // Atualiza também o phone_number principal
                })
                .eq('integrations_id', integration.id)
                .eq('phone_number', normalizedLid)
                .is('pending_number', null)

              if (updateError) {
                logger.error('[receiveWhatsAppWebhook] ❌ Erro ao atualizar mensagens com número real:', {
                  error: updateError.message
                })
              } else if (count && count > 0) {
                logger.log('[receiveWhatsAppWebhook] ✅ Mensagens atualizadas com número real:', {
                  lid: contactId,
                  realNumber: normalizedPhoneNumber,
                  updatedCount: count
                })
              }
            } else {
              logger.error('[receiveWhatsAppWebhook] ❌ Erro ao salvar mapeamento:', {
                error: mappingResult.error,
                lid: contactId
              })
            }
          } else {
            console.log('\n' + '='.repeat(80))
            console.log('⚠️ [receiveWhatsAppWebhook] CONTATO SEM MAPEAMENTO VÁLIDO:')
            console.log('='.repeat(80))
            console.log('Contact ID:', contactId)
            console.log('Phone Number:', phoneNumber)
            console.log('É LID?', contactId?.endsWith('@lid'))
            console.log('Tem Phone Number?', !!phoneNumber)
            console.log('='.repeat(80) + '\n')
            
            logger.log('[receiveWhatsAppWebhook] ⚠️ Contato sem mapeamento válido:', {
              contactId,
              phoneNumber,
              hasLid: contactId?.endsWith('@lid'),
              hasPhoneNumber: !!phoneNumber
            })
          }
        } catch (contactError: any) {
          logger.error('[receiveWhatsAppWebhook] ❌ Erro ao processar contato:', {
            error: contactError.message,
            contact: contact
          })
        }
      }

      return res.json({ received: true, processed: true, event: 'contacts.update' })
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

// Função removida: processPendingQueueForLidAsync
// Agora usamos apenas tb_whatsapp_messages com pending_number

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
 * Processa conversas pendentes manualmente
 * POST /whatsapp/process-pending?integration_id=xxx
 */
export async function processPendingWhatsAppConversations(req: Request, res: Response) {
  try {
    const { integration_id } = req.query
    const { processPendingConversations } = await import('../../services/integrations/whatsapp/whatsapp.worker')

    const result = await processPendingConversations(integration_id as string | undefined)

    if (result.success) {
      return res.json({
        success: true,
        processed: result.processed,
        message: `${result.processed} conversa(s) processada(s)`
      })
    } else {
      return res.status(500).json({
        success: false,
        error: result.error
      })
    }
  } catch (error: any) {
    logger.error('[processPendingWhatsAppConversations] ❌ Erro:', error)
    return res.status(500).json({
      error: 'Erro ao processar conversas pendentes',
      details: error.message
    })
  }
}

/**
 * Processa fila de respostas manualmente
 * POST /whatsapp/process-queue
 */
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
    logger.error('[processQueueManually] ❌ Erro:', error)
    return res.status(500).json({
      error: 'Erro ao processar fila',
      details: error.message
    })
  }
}

/**
 * Obtém estatísticas da fila
 * GET /whatsapp/queue-stats
 */
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
    logger.error('[getQueueStatsEndpoint] ❌ Erro:', error)
    return res.status(500).json({
      error: 'Erro ao obter estatísticas da fila',
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
    for (const conversationId of unreadNumbers) {
      const history = await getHistoryFromRedis(integration_id as string, conversationId)
      if (history.length > 0 && history[history.length - 1].role === 'user') {
        unreadMessages.push({
          phone_number: conversationId, // Salva ID da conversa completo
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
