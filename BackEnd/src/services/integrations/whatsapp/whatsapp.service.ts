import { supabase } from '../../../lib/supabase'
import logger from '../../../lib/logger'
import axios from 'axios'

export interface WhatsAppMessage {
  id?: string
  whatsapp_contact_id: string // ID do contato em tb_whatsapp_contacts
  message: string
  message_id?: string
  direction: 'inbound' | 'outbound'
  integrations_id: string
  agent_id?: string
  is_read?: boolean
  created_at?: string
}

export interface SendWhatsAppInput {
  to: string // Número de telefone do destinatário (formato: 5511999999999)
  message: string // Mensagem a ser enviada
  agentId?: string // ID do agente (opcional, para salvar no histórico)
}

export interface EvolutionAPIConfig {
  apiUrl: string // URL da Evolution API (ex: http://192.168.15.31:8081)
  apiKey: string // API Key da Evolution API
  instanceName: string // Nome da instância (phone_number ou integrationsId)
}

export interface ResolvedConversationId {
  originalId: string // ID original recebido (pode ser @lid ou @s.whatsapp.net)
  resolvedId: string // ID resolvido (sempre @s.whatsapp.net quando possível)
  isRealNumber: boolean // true se é número real, false se é LID
  source: 'direct' | 'cache' | 'api' | 'webhook' // De onde veio a resolução
}

/**
 * Resolve um ID de conversa (LID ou número real) para o melhor identificador possível
 * Prioriza sempre números reais (@s.whatsapp.net) sobre LIDs (@lid)
 * 
 * @param remoteJid - ID da conversa (pode ser @lid ou @s.whatsapp.net)
 * @param payload - Payload completo do webhook (pode conter dados adicionais)
 * @param instanceName - Nome da instância da Evolution API
 * @param apiUrl - URL da Evolution API
 * @param apiKey - API Key da Evolution API
 * @returns ResolvedConversationId com o melhor ID possível
 */
export async function resolveConversationId(
  remoteJid: string,
  payload: any,
  instanceName: string,
  apiUrl: string,
  apiKey: string
): Promise<ResolvedConversationId> {
  try {
    // Se já é um número real (@s.whatsapp.net), retorna direto
    if (remoteJid.endsWith('@s.whatsapp.net')) {
      logger.log('[resolveConversationId] ✅ Número real detectado:', {
        remoteJid,
        source: 'direct'
      })
      return {
        originalId: remoteJid,
        resolvedId: remoteJid,
        isRealNumber: true,
        source: 'direct'
      }
    }

    // Se é LID, tenta resolver
    if (remoteJid.endsWith('@lid')) {
      logger.log('[resolveConversationId] 🔍 LID detectado, tentando resolver:', {
        remoteJid
      })

      // 1. Tenta buscar no cache Redis primeiro
      try {
        const { getRedisClient } = await import('../../../lib/redis')
        const redis = await getRedisClient()
        const cacheKey = `whatsapp:lid:${instanceName}:${remoteJid}`
        const cached = await redis.get(cacheKey)
        
        if (cached) {
          logger.log('[resolveConversationId] ✅ Número real encontrado no cache:', {
            lid: remoteJid,
            realNumber: cached,
            source: 'cache'
          })
          return {
            originalId: remoteJid,
            resolvedId: cached,
            isRealNumber: true,
            source: 'cache'
          }
        }
      } catch (cacheError: any) {
        logger.warn('[resolveConversationId] ⚠️ Erro ao buscar cache:', {
          error: cacheError?.message
        })
      }

      // 2. Tenta buscar no payload do webhook (chats.upsert, contacts, etc)
      if (payload) {
        // Verifica se há dados de chat no payload
        if (payload.data?.chats) {
          const chats = Array.isArray(payload.data.chats) ? payload.data.chats : [payload.data.chats]
          for (const chat of chats) {
            if (chat.id === remoteJid || chat.jid === remoteJid) {
              const realJid = chat.id?.endsWith('@s.whatsapp.net') ? chat.id : 
                            chat.jid?.endsWith('@s.whatsapp.net') ? chat.jid : null
              if (realJid) {
                logger.log('[resolveConversationId] ✅ Número real encontrado no webhook (chats):', {
                  lid: remoteJid,
                  realNumber: realJid,
                  source: 'webhook'
                })
                // Salva no cache
                await saveLidMapping(instanceName, remoteJid, realJid)
                return {
                  originalId: remoteJid,
                  resolvedId: realJid,
                  isRealNumber: true,
                  source: 'webhook'
                }
              }
            }
          }
        }

        // Verifica se há dados de contatos no payload
        if (payload.data?.contacts) {
          const contacts = Array.isArray(payload.data.contacts) ? payload.data.contacts : [payload.data.contacts]
          for (const contact of contacts) {
            if (contact.id === remoteJid || contact.jid === remoteJid) {
              const realJid = contact.id?.endsWith('@s.whatsapp.net') ? contact.id : 
                            contact.jid?.endsWith('@s.whatsapp.net') ? contact.jid : null
              if (realJid) {
                logger.log('[resolveConversationId] ✅ Número real encontrado no webhook (contacts):', {
                  lid: remoteJid,
                  realNumber: realJid,
                  source: 'webhook'
                })
                // Salva no cache
                await saveLidMapping(instanceName, remoteJid, realJid)
                return {
                  originalId: remoteJid,
                  resolvedId: realJid,
                  isRealNumber: true,
                  source: 'webhook'
                }
              }
            }
          }
        }
      }

      // 3. Tenta buscar na Evolution API
      try {
        const cleanId = remoteJid.replace('@lid', '')
        
        // Tenta buscar com @s.whatsapp.net
        try {
          const response = await axios.get(
            `${apiUrl}/contact/fetchStatus/${instanceName}`,
            {
              headers: {
                'apikey': apiKey,
                'Content-Type': 'application/json'
              },
              params: {
                remoteJid: `${cleanId}@s.whatsapp.net`
              },
              timeout: 5000
            }
          )

          if (response.data?.number) {
            const number = String(response.data.number).replace(/\D/g, '')
            if (number.length >= 10 && number.length <= 15 && !number.startsWith('14') && !number.startsWith('17')) {
              const realJid = `${number}@s.whatsapp.net`
              logger.log('[resolveConversationId] ✅ Número real encontrado na API:', {
                lid: remoteJid,
                realNumber: realJid,
                source: 'api'
              })
              // Salva no cache
              await saveLidMapping(instanceName, remoteJid, realJid)
              return {
                originalId: remoteJid,
                resolvedId: realJid,
                isRealNumber: true,
                source: 'api'
              }
            }
          }
        } catch (apiError: any) {
          // Continua para outras tentativas
        }

        // Tenta buscar nos chats
        try {
          const chatResponse = await axios.get(
            `${apiUrl}/chat/fetchChats/${instanceName}`,
            {
              headers: {
                'apikey': apiKey,
                'Content-Type': 'application/json'
              },
              timeout: 5000
            }
          )

          if (chatResponse.data && Array.isArray(chatResponse.data)) {
            const chat = chatResponse.data.find((c: any) => {
              const chatJid = String(c.remoteJid || c.id || '')
              return chatJid === remoteJid || chatJid.replace('@s.whatsapp.net', '@lid') === remoteJid
            })

            if (chat?.remoteJid?.endsWith('@s.whatsapp.net')) {
              logger.log('[resolveConversationId] ✅ Número real encontrado nos chats:', {
                lid: remoteJid,
                realNumber: chat.remoteJid,
                source: 'api'
              })
              // Salva no cache
              await saveLidMapping(instanceName, remoteJid, chat.remoteJid)
              return {
                originalId: remoteJid,
                resolvedId: chat.remoteJid,
                isRealNumber: true,
                source: 'api'
              }
            }
          }
        } catch (chatError: any) {
          // Continua
        }
      } catch (apiError: any) {
        logger.warn('[resolveConversationId] ⚠️ Erro ao buscar na API:', {
          error: apiError?.message
        })
      }

      // 4. Se não conseguiu resolver, retorna o LID original
      logger.warn('[resolveConversationId] ⚠️ Não foi possível resolver LID, usando original:', {
        lid: remoteJid
      })
      return {
        originalId: remoteJid,
        resolvedId: remoteJid,
        isRealNumber: false,
        source: 'direct'
      }
    }

    // Se não tem sufixo conhecido, assume que é número e adiciona @s.whatsapp.net
    const cleanNumber = remoteJid.replace(/@.*$/, '').replace(/\D/g, '')
    if (cleanNumber.length >= 10 && cleanNumber.length <= 15) {
      const realJid = `${cleanNumber}@s.whatsapp.net`
      logger.log('[resolveConversationId] ✅ Número sem sufixo, normalizado:', {
        original: remoteJid,
        normalized: realJid,
        source: 'direct'
      })
      return {
        originalId: remoteJid,
        resolvedId: realJid,
        isRealNumber: true,
        source: 'direct'
      }
    }

    // Fallback: retorna o original
    return {
      originalId: remoteJid,
      resolvedId: remoteJid,
      isRealNumber: false,
      source: 'direct'
    }
  } catch (error: any) {
    logger.error('[resolveConversationId] ❌ Erro ao resolver ID:', {
      remoteJid,
      error: error?.message
    })
    return {
      originalId: remoteJid,
      resolvedId: remoteJid,
      isRealNumber: false,
      source: 'direct'
    }
  }
}

/**
 * Salva o mapeamento LID -> número real no Redis
 */
async function saveLidMapping(instanceName: string, lid: string, realJid: string): Promise<void> {
  try {
    const { getRedisClient } = await import('../../../lib/redis')
    const redis = await getRedisClient()
    const cacheKey = `whatsapp:lid:${instanceName}:${lid}`
    // Cache por 7 dias
    await redis.setEx(cacheKey, 7 * 24 * 60 * 60, realJid)
    logger.log('[saveLidMapping] ✅ Mapeamento salvo no cache:', {
      lid,
      realJid
    })
  } catch (error: any) {
    logger.warn('[saveLidMapping] ⚠️ Erro ao salvar cache:', {
      error: error?.message
    })
  }
}

/**
 * Busca as credenciais da Evolution API
 * phone_number vem do banco (tb_integrations), resto vem do .env com valores padrão
 */
async function getEvolutionAPICredentials(integrationsId: string): Promise<EvolutionAPIConfig | null> {
  try {
    // Valores padrão básicos (podem ser sobrescritos pelo .env)
    const apiUrl = process.env.EVOLUTION_API_URL || 'http://192.168.15.31:8081'
    const apiKey = process.env.EVOLUTION_API_KEY || 'dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA=='

    logger.log('[getEvolutionAPICredentials] Configurações:', {
      apiUrl,
      apiKey: apiKey.substring(0, 10) + '...', // Log parcial da API key por segurança
      integrationsId
    })

    // Busca apenas o phone_number do banco (cada integração tem seu número)
    const { data, error } = await supabase
      .from('tb_integrations')
      .select('id, phone_number')
      .eq('id', integrationsId)
      .single()

    if (error || !data) {
      logger.error('[getEvolutionAPICredentials] Erro ao buscar integração:', {
        integrationsId,
        error: error?.message || error
      })
      return null
    }

    // Usa phone_number se disponível, senão usa integrationsId como instanceName
    const instanceName = data.phone_number || integrationsId

    if (!instanceName) {
      logger.error('[getEvolutionAPICredentials] instanceName não encontrado:', {
        integrationsId,
        phone_number: data.phone_number
      })
      return null
    }

    // phone_number do banco, configurações do .env (ou padrão)
    return {
      apiUrl: apiUrl,
      apiKey: apiKey,
      instanceName: instanceName
    }
  } catch (error: any) {
    logger.error('[getEvolutionAPICredentials] Erro:', {
      message: error?.message,
      stack: error?.stack
    })
    return null
  }
}

/**
 * Verifica se a EvolutionAPI está acessível
 * @throws Error se a API não estiver rodando
 */
async function checkEvolutionAPIHealth(config: EvolutionAPIConfig): Promise<void> {
  try {
    logger.log('[checkEvolutionAPIHealth] Verificando saúde da EvolutionAPI...', {
      apiUrl: config.apiUrl
    })

    const response = await axios.get(
      `${config.apiUrl}`,
      {
        headers: {
          'apikey': config.apiKey
        },
        timeout: 5000 // 5 segundos de timeout
      }
    )

    logger.log('[checkEvolutionAPIHealth] ✅ EvolutionAPI está acessível')
  } catch (error: any) {
    const errorDetails = {
      message: error?.message || 'Erro desconhecido',
      code: error?.code || null,
      response: error?.response?.data || null,
      status: error?.response?.status || null,
      url: error?.config?.url || config.apiUrl
    }

    logger.error('[checkEvolutionAPIHealth] ❌ EvolutionAPI não está acessível:', errorDetails)

    if (error?.code === 'ECONNREFUSED') {
      throw new Error(
        `❌ EvolutionAPI não está rodando ou não está acessível em ${config.apiUrl}.\n\n` +
        `📋 Verifique:\n` +
        `1. A EvolutionAPI está rodando? (docker-compose up ou similar)\n` +
        `2. A URL está correta no arquivo BackEnd/.env? (atual: ${config.apiUrl})\n` +
        `3. A porta está aberta e acessível?\n\n` +
        `💡 Para iniciar a EvolutionAPI, consulte: BackEnd/EVOLUTION_API_SETUP.md`
      )
    }

    throw new Error(`EvolutionAPI não está acessível: ${errorDetails.message}`)
  }
}

/**
 * Cria ou obtém uma instância do WhatsApp na Evolution API
 * NÃO recria se já existir - valida antes de criar
 */
async function createOrGetInstance(config: EvolutionAPIConfig): Promise<string> {
  try {
    logger.log('[createOrGetInstance] Verificando se instância existe...', {
      instanceName: config.instanceName,
      apiUrl: config.apiUrl
    })

    // Verifica se a instância já existe
    try {
      const checkResponse = await axios.get(
        `${config.apiUrl}/instance/fetchInstances`,
        {
          headers: {
            'apikey': config.apiKey
          },
          timeout: 10000 // 10 segundos de timeout
        }
      )

      const instances = checkResponse.data || []
      
      // Busca a instância em diferentes formatos de resposta
      const existingInstance = instances.find((inst: any) => {
        const instanceName = inst.instance?.instanceName || 
                           inst.instanceName || 
                           inst.name ||
                           inst.instance?.name
        return instanceName === config.instanceName
      })

      if (existingInstance) {
        const state = existingInstance.instance?.state || 
                     existingInstance.state || 
                     'unknown'
        logger.log(`[createOrGetInstance] ✅ Instância ${config.instanceName} já existe`, {
          state: state
        })
        return config.instanceName
      }
    } catch (checkError: any) {
      // Se der erro ao verificar, continua e tenta criar (pode ser que a API não esteja respondendo corretamente)
      logger.warn('[createOrGetInstance] ⚠️ Erro ao verificar instâncias existentes, tentando criar...', {
        error: checkError?.message
      })
    }

    // Cria nova instância apenas se não existir
    logger.log(`[createOrGetInstance] Criando nova instância: ${config.instanceName}`)

    try {
      const createResponse = await axios.post(
        `${config.apiUrl}/instance/create`,
        {
          instanceName: config.instanceName,
          token: config.apiKey,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        },
        {
          headers: {
            'apikey': config.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 segundos de timeout
        }
      )

      logger.log(`[createOrGetInstance] ✅ Instância ${config.instanceName} criada com sucesso`, {
        response: createResponse.data
      })

      return config.instanceName
    } catch (createError: any) {
      // Se der erro 403 (Forbidden) ou 400/409, significa que a instância já existe
      const status = createError?.response?.status
      const errorMessage = createError?.response?.data?.response?.message || 
                          createError?.response?.data?.message || 
                          createError?.message || ''

      // Verifica se o erro indica que a instância já existe
      const instanceAlreadyExists = 
        status === 403 || 
        status === 400 || 
        status === 409 ||
        (typeof errorMessage === 'string' && (
          errorMessage.toLowerCase().includes('already in use') ||
          errorMessage.toLowerCase().includes('already exists') ||
          errorMessage.toLowerCase().includes('duplicate') ||
          errorMessage.toLowerCase().includes('forbidden')
        )) ||
        (Array.isArray(errorMessage) && errorMessage.some((msg: string) => 
          msg.toLowerCase().includes('already in use') ||
          msg.toLowerCase().includes('already exists')
        ))

      if (instanceAlreadyExists) {
        logger.log(`[createOrGetInstance] ✅ Instância ${config.instanceName} já existe (erro ${status}), usando a existente`, {
          errorMessage: errorMessage
        })
        return config.instanceName
      }

      // Se não for erro de "já existe", propaga o erro
      throw createError
    }
  } catch (error: any) {
    const errorDetails = {
      message: error?.message || 'Erro desconhecido',
      code: error?.code || null,
      response: error?.response?.data || null,
      status: error?.response?.status || null,
      url: error?.config?.url || null,
      method: error?.config?.method || null
    }

    logger.error('[createOrGetInstance] ❌ Erro detalhado:', errorDetails)
    logger.error('[createOrGetInstance] ❌ Erro completo:', error)

    // Se for erro de conexão, lança erro mais claro
    if (error?.code === 'ECONNREFUSED') {
      throw new Error(
        `❌ EvolutionAPI não está rodando ou não está acessível em ${config.apiUrl}.\n\n` +
        `📋 Verifique:\n` +
        `1. A EvolutionAPI está rodando?\n` +
        `2. A URL está correta no arquivo BackEnd/.env? (atual: ${config.apiUrl})\n` +
        `3. A porta está aberta e acessível?\n\n` +
        `💡 Para iniciar a EvolutionAPI, consulte: BackEnd/EVOLUTION_API_SETUP.md`
      )
    }

    // Última tentativa: se for erro 403/400/409, assume que existe e retorna
    if (error?.response?.status === 403 || 
        error?.response?.status === 400 || 
        error?.response?.status === 409) {
      logger.warn('[createOrGetInstance] ⚠️ Erro indica que instância pode já existir, usando a existente...')
      return config.instanceName
    }

    throw new Error(
      `Erro ao criar/obter instância: ${errorDetails.message}${errorDetails.response ? ` - ${JSON.stringify(errorDetails.response)}` : ''}`
    )
  }
}

/**
 * Verifica o status da conexão da instância
 * Retorna 'connected' se status for 'open' ou 'connected'
 */
export async function checkConnectionStatus(integrationsId: string): Promise<'connected' | 'disconnected' | 'connecting'> {
  try {
    const config = await getEvolutionAPICredentials(integrationsId)
    if (!config) {
      throw new Error('Credenciais não encontradas')
    }

    const response = await axios.get(
      `${config.apiUrl}/instance/fetchInstances`,
      {
        headers: {
          'apikey': config.apiKey
        },
        timeout: 10000
      }
    )

    const instances = response.data || []
    
    // Busca a instância em diferentes formatos de resposta
    const instance = instances.find((inst: any) => {
      const instanceName = inst.instance?.instanceName || 
                          inst.instanceName || 
                          inst.name ||
                          inst.instance?.name ||
                          String(inst.instance?.instanceName || inst.instanceName || inst.name || '')
      return instanceName === config.instanceName || 
             String(instanceName) === String(config.instanceName)
    })

    if (!instance) {
      logger.warn('[checkConnectionStatus] Instância não encontrada:', {
        instanceName: config.instanceName,
        availableInstances: instances.map((inst: any) => ({
          name: inst.instance?.instanceName || inst.instanceName || inst.name,
          state: inst.instance?.state || inst.state
        }))
      })
      return 'disconnected'
    }

    // Obtém o status em diferentes formatos
    const state = instance.instance?.state || 
                 instance.state || 
                 instance.instance?.status ||
                 instance.status ||
                 instance.instance?.connectionState ||
                 'disconnected'
    
    // Normaliza o status: "open" também significa "connected"
    let normalizedState: 'connected' | 'disconnected' | 'connecting' = 'disconnected'
    
    if (state === 'open' || state === 'connected') {
      normalizedState = 'connected'
    } else if (state === 'connecting' || state === 'close') {
      normalizedState = state === 'connecting' ? 'connecting' : 'disconnected'
    } else {
      normalizedState = state as 'connected' | 'disconnected' | 'connecting'
    }

    logger.log('[checkConnectionStatus] Status da instância:', {
      instanceName: config.instanceName,
      state: state,
      normalizedState: normalizedState
    })

    return normalizedState
  } catch (error: any) {
    const errorDetails = {
      message: error?.message || 'Erro desconhecido',
      response: error?.response?.data || null,
      status: error?.response?.status || null
    }
    logger.error('[checkConnectionStatus] ❌ Erro:', errorDetails)
    return 'disconnected'
  }
}

/**
 * Obtém o QR Code da instância em base64
 * Apenas se a instância não estiver conectada
 * Retorna objeto com qrCode e se está conectada
 */
export async function getQRCode(integrationsId: string): Promise<{ qrCode: string | null; isConnected: boolean }> {
  try {
    const config = await getEvolutionAPICredentials(integrationsId)
    if (!config) {
      throw new Error('Credenciais não encontradas')
    }

    // Verifica status antes de buscar QR Code
    const status = await checkConnectionStatus(integrationsId)
    if (status === 'connected') {
      logger.log('[getQRCode] ✅ Instância já está conectada (status: connected/open), QR Code não necessário')
      console.log(`\n✅ [getQRCode] Instância ${config.instanceName} já está conectada. QR Code não necessário.\n`)
      return { qrCode: null, isConnected: true }
    }

    // NÃO tenta criar a instância se já existir (evita erro 403)
    // Apenas verifica se existe e busca o QR Code diretamente
    try {
      // Tenta verificar se a instância existe sem criar
      const checkResponse = await axios.get(
        `${config.apiUrl}/instance/fetchInstances`,
        {
          headers: {
            'apikey': config.apiKey
          },
          timeout: 10000
        }
      )

      const instances = checkResponse.data || []
      const existingInstance = instances.find(
        (inst: any) => (inst.instance?.instanceName || inst.instanceName) === config.instanceName
      )

      if (!existingInstance) {
        // Só cria se não existir
        logger.log('[getQRCode] Instância não existe, criando...')
        await createOrGetInstance(config)
      } else {
        logger.log('[getQRCode] Instância já existe, pulando criação')
      }
    } catch (error: any) {
      // Se der erro ao verificar, tenta criar mesmo assim
      logger.warn('[getQRCode] Erro ao verificar instância, tentando criar...', error.message)
      try {
        await createOrGetInstance(config)
      } catch (createError: any) {
        // Se der erro 403 (já existe), continua mesmo assim
        if (createError?.response?.status === 403) {
          logger.log('[getQRCode] Instância já existe (erro 403), continuando...')
        } else {
          throw createError
        }
      }
    }

    // Busca o QR Code
    logger.log('[getQRCode] Buscando QR Code...', {
      instanceName: config.instanceName,
      apiUrl: config.apiUrl
    })
    console.log(`\n🔍 [getQRCode] Buscando QR Code para instância: ${config.instanceName}`)
    console.log(`🔗 URL: ${config.apiUrl}/instance/connect/${config.instanceName}`)

    const response = await axios.get(
      `${config.apiUrl}/instance/connect/${config.instanceName}`,
      {
        headers: {
          'apikey': config.apiKey
        },
        timeout: 10000
      }
    )
    
    console.log(`✅ [getQRCode] Resposta recebida da Evolution API`)
    logger.log('[getQRCode] Resposta da Evolution API:', {
      status: response.status,
      dataKeys: Object.keys(response.data || {})
    })

    // Verifica se a instância está conectada (open/connected) na resposta
    const responseState = response.data?.instance?.state || 
                         response.data?.state || 
                         response.data?.instance?.status ||
                         response.data?.status

    if (responseState === 'open' || responseState === 'connected') {
      logger.log(`[getQRCode] ✅ Instância está ${responseState} (conectada), QR Code não necessário`)
      console.log(`\n✅ [getQRCode] Instância ${config.instanceName} está ${responseState} (conectada). QR Code não necessário.\n`)
      return { qrCode: null, isConnected: true }
    }

    const qrCode = response.data?.qrcode?.base64 || response.data?.base64 || response.data?.qrcode || null

    if (qrCode) {
      // Exibe o QR Code de forma destacada no terminal
      console.log('\n')
      console.log('═══════════════════════════════════════════════════════════════')
      console.log('📱                    QR CODE DO WHATSAPP                     📱')
      console.log('═══════════════════════════════════════════════════════════════')
      console.log('')
      console.log('📋 INSTRUÇÕES:')
      console.log('   1. Abra o WhatsApp no seu celular')
      console.log('   2. Vá em Configurações > Aparelhos conectados > Conectar um aparelho')
      console.log('   3. Escaneie o QR Code abaixo (ou use o código base64)')
      console.log('')
      console.log('═══════════════════════════════════════════════════════════════')
      console.log('')
      console.log('CÓDIGO BASE64 DO QR CODE:')
      console.log('───────────────────────────────────────────────────────────────')
      console.log(qrCode)
      console.log('───────────────────────────────────────────────────────────────')
      console.log('')
      console.log('💡 DICA: Você pode converter este base64 em imagem usando:')
      console.log('   https://base64.guru/converter/decode/image')
      console.log('')
      console.log('═══════════════════════════════════════════════════════════════')
      console.log('')
      logger.log('[getQRCode] ✅ QR Code gerado e exibido com sucesso')
      return { qrCode: qrCode, isConnected: false }
    } else {
      logger.warn('[getQRCode] ⚠️ QR Code não encontrado na resposta:', {
        responseData: response.data,
        responseKeys: Object.keys(response.data || {})
      })
      console.log('\n⚠️ [getQRCode] QR Code não encontrado na resposta da Evolution API')
      console.log('📋 Resposta recebida:', JSON.stringify(response.data, null, 2))
      console.log('')
      return { qrCode: null, isConnected: false }
    }
  } catch (error: any) {
    const errorDetails = {
      message: error?.message || 'Erro desconhecido',
      response: error?.response?.data || null,
      status: error?.response?.status || null,
      url: error?.config?.url || null,
      code: error?.code || null
    }
    logger.error('[getQRCode] ❌ Erro ao obter QR Code:', errorDetails)
    logger.error('[getQRCode] ❌ Erro completo:', error)
    return { qrCode: null, isConnected: false }
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
 * Envia mensagem via WhatsApp usando Evolution API
 * Fluxo: Verificar API → Criar instância → Verificar conexão → Enviar
 */
export async function sendWhatsApp(
  integrationsId: string,
  data: SendWhatsAppInput
): Promise<{ success: boolean; messageId?: string; error?: string; qrCode?: string; history?: any[]; queued?: boolean; message?: string }> {
  try {
    // 1️⃣ Busca credenciais
    const config = await getEvolutionAPICredentials(integrationsId)
    if (!config) {
      return {
        success: false,
        error: 'Integração WhatsApp não encontrada ou phone_number não configurado. Verifique se a integração existe e tem phone_number preenchido na tabela tb_integrations.'
      }
    }

    // Valida campos obrigatórios
    if (!config.apiKey) {
      return {
        success: false,
        error: 'API Key não configurada. Configure EVOLUTION_API_KEY no arquivo .env.'
      }
    }

    if (!config.instanceName) {
      return {
        success: false,
        error: 'Número de telefone não configurado. Configure o campo phone_number na integração.'
      }
    }

    // 2️⃣ Verifica se a EvolutionAPI está acessível
    try {
      await checkEvolutionAPIHealth(config)
    } catch (healthError: any) {
      logger.error('[sendWhatsApp] ❌ EvolutionAPI não está acessível:', {
        error: healthError.message
      })
      return {
        success: false,
        error: healthError.message || 'EvolutionAPI não está acessível'
      }
    }

    // 3️⃣ Garante que a instância existe (não recria se já existir)
    let instanceName: string
    try {
      instanceName = await createOrGetInstance(config)
    } catch (instanceError: any) {
      logger.error('[sendWhatsApp] ❌ Erro ao criar/obter instância:', {
        error: instanceError.message,
        details: instanceError
      })
      return {
        success: false,
        error: instanceError.message || 'Erro ao criar ou obter instância'
      }
    }

    // 4️⃣ Verifica se está conectado
    let status = await checkConnectionStatus(integrationsId)
    
    if (status !== 'connected') {
      logger.warn(`[sendWhatsApp] ⚠️ Instância não está conectada. Status: ${status}`)

      // Busca QR Code apenas se não estiver conectada
      // getQRCode já verifica internamente se está conectada e retorna isConnected: true se estiver
      let qrCodeResult: { qrCode: string | null; isConnected: boolean } | null = null
      try {
        console.log('\n🔍 [sendWhatsApp] Tentando obter QR Code...')
        qrCodeResult = await getQRCode(integrationsId)
        
        // Se getQRCode detectou que está conectada, confia nisso e prossegue
        if (qrCodeResult.isConnected) {
          logger.log('[sendWhatsApp] ✅ Instância está conectada (detectado por getQRCode), prosseguindo com envio')
          console.log(`\n✅ [sendWhatsApp] Instância ${instanceName} está conectada. Prosseguindo com envio...\n`)
          status = 'connected' // Atualiza status para prosseguir
          // Continua para enviar a mensagem (não retorna erro)
        } else if (qrCodeResult.qrCode) {
          // QR Code foi retornado, mas ainda não está conectada
          console.log('\n✅ [sendWhatsApp] QR Code obtido com sucesso!')
          console.log('📱 O QR Code foi exibido acima. Escaneie com o WhatsApp para conectar.\n')
          
          // Revalida o status após obter QR Code
          status = await checkConnectionStatus(integrationsId)
          if (status !== 'connected') {
            return {
              success: false,
              error: `WhatsApp não está conectado. Status: ${status}. QR Code exibido no terminal acima. Escaneie para conectar.`,
              qrCode: qrCodeResult.qrCode
            }
          }
          // Se conectou após obter QR Code, continua para enviar
          logger.log('[sendWhatsApp] ✅ Instância conectou após obter QR Code, prosseguindo com envio...')
        } else {
          // QR Code não foi retornado e não está conectada
          console.log('\n⚠️ [sendWhatsApp] QR Code não foi retornado pela Evolution API')
          console.log('💡 Tente acessar: GET /whatsapp/qrcode?integration_id=' + integrationsId + '\n')
          return {
            success: false,
            error: `WhatsApp não está conectado. Status: ${status}. Tente acessar GET /whatsapp/qrcode?integration_id=${integrationsId} para obter o QR Code.`,
            qrCode: undefined
          }
        }
      } catch (qrError: any) {
        logger.error('[sendWhatsApp] ⚠️ Erro ao obter QR Code:', {
          error: qrError.message
        })
        console.error('\n❌ [sendWhatsApp] Erro ao obter QR Code:', qrError.message)
        console.log('💡 Tente acessar manualmente: GET /whatsapp/qrcode?integration_id=' + integrationsId + '\n')
        
        // Revalida o status mesmo após erro
        status = await checkConnectionStatus(integrationsId)
        if (status !== 'connected') {
          return {
            success: false,
            error: `WhatsApp não está conectado. Status: ${status}. Tente acessar GET /whatsapp/qrcode?integration_id=${integrationsId} para obter o QR Code.`,
            qrCode: undefined
          }
        }
        // Se conectou mesmo após erro, continua
        logger.log('[sendWhatsApp] ✅ Instância conectou, prosseguindo com envio...')
      }
    } else {
      logger.log('[sendWhatsApp] ✅ Instância está conectada, prosseguindo com envio...')
    }

    // Se chegou aqui e status é 'connected', prossegue para enviar mensagem
    if (status !== 'connected') {
      return {
        success: false,
        error: `WhatsApp não está conectado. Status: ${status}.`,
        qrCode: undefined
      }
    }

    // 5️⃣ Busca histórico do Redis antes de enviar (para contexto da IA)
    logger.log('[sendWhatsApp] 📚 Buscando histórico do Redis...', {
      conversationId: data.to,
      integrationsId
    })

    const { getHistoryFromRedis } = await import('./whatsapp.redis')
    const history = await getHistoryFromRedis(
      integrationsId,
      data.to, // Usa ID da conversa completo
      10 // últimas 10 mensagens
    )
    logger.log('[sendWhatsApp] Histórico encontrado no Redis:', {
      count: history.length
    })

    // 6️⃣ Envia a mensagem (somente se conectado)
    logger.log('[sendWhatsApp] 📤 Enviando mensagem...', {
      instanceName,
      to: data.to,
      messageLength: data.message.length,
      hasHistory: history.length > 0
    })

    // Valida se data.to existe
    if (!data.to || data.to.trim() === '') {
      logger.error('[sendWhatsApp] ❌ data.to está vazio ou undefined:', {
        data: data
      })
      return {
        success: false,
        error: 'Número de telefone ou ID do contato não fornecido. O campo "to" é obrigatório.'
      }
    }

    // Usa o ID EXATAMENTE como recebido do WhatsApp para envio
    const originalConversationId = data.to.trim()
    logger.log('[sendWhatsApp] 📱 ID da conversa recebido (usando exatamente como veio):', {
      original: originalConversationId
    })
    
    // SEMPRE busca o número do contato no banco de dados
    // Não aceita números inventados - DEVE vir do banco
    let conversationIdForSending = originalConversationId
    
    console.log('\n' + '='.repeat(80))
    console.log('🔍 [sendWhatsApp] BUSCANDO NÚMERO DO CONTATO NO BANCO:')
    console.log('='.repeat(80))
    console.log('ID Recebido:', originalConversationId)
    console.log('É UUID?', originalConversationId.includes('-') && originalConversationId.length === 36)
    console.log('É LID?', originalConversationId.endsWith('@lid'))
    console.log('É número real?', originalConversationId.endsWith('@s.whatsapp.net'))
    console.log('='.repeat(80) + '\n')
    
    // Tenta buscar número do contato no banco
    const contactNumberResult = await getContactNumberForSending(originalConversationId, integrationsId)
    
    if (contactNumberResult.success && contactNumberResult.number) {
      conversationIdForSending = contactNumberResult.number
      console.log('\n' + '='.repeat(80))
      console.log('✅ [sendWhatsApp] NÚMERO DO CONTATO ENCONTRADO NO BANCO:')
      console.log('='.repeat(80))
      console.log('ID Original:', originalConversationId)
      console.log('Número Encontrado:', conversationIdForSending)
      console.log('='.repeat(80) + '\n')
      
      logger.log('[sendWhatsApp] ✅ Número do contato encontrado no banco:', {
        contactId: originalConversationId,
        number: conversationIdForSending
      })
    } else {
      console.log('\n' + '='.repeat(80))
      console.log('❌ [sendWhatsApp] ERRO: CONTATO NÃO ENCONTRADO NO BANCO:')
      console.log('='.repeat(80))
      console.log('ID Original:', originalConversationId)
      console.log('Erro:', contactNumberResult.error)
      console.log('='.repeat(80) + '\n')
      
      logger.error('[sendWhatsApp] ❌ Erro ao buscar número do contato no banco:', {
        contactId: originalConversationId,
        error: contactNumberResult.error
      })
      return {
        success: false,
        error: `Contato não encontrado no banco de dados. ${contactNumberResult.error || 'Erro desconhecido'}. Verifique se o contato existe em tb_whatsapp_contacts.`
      }
    }

    // PRIORIDADE: Tenta buscar número real no Redis primeiro (mais rápido)
    const { getRealNumberFromLid } = await import('./whatsapp.redis')
    
    if (conversationIdForSending.endsWith('@lid')) {
      console.log('\n' + '='.repeat(80))
      console.log('🔍 [sendWhatsApp] LID DETECTADO, BUSCANDO NÚMERO REAL NO REDIS:')
      console.log('='.repeat(80))
      console.log('LID Original:', originalConversationId)
      console.log('='.repeat(80) + '\n')
      
      const realNumber = await getRealNumberFromLid(originalConversationId)
      
      if (realNumber) {
        console.log('\n' + '='.repeat(80))
        console.log('✅ [sendWhatsApp] NÚMERO REAL ENCONTRADO NO REDIS:')
        console.log('='.repeat(80))
        console.log('LID Original:', conversationIdForSending)
        console.log('Número Real Encontrado:', realNumber)
        console.log('USANDO NÚMERO REAL PARA ENVIO (prioridade)')
        console.log('='.repeat(80) + '\n')
        
        logger.log('[sendWhatsApp] ✅ Número real encontrado no Redis, usando para envio:', {
          lid: conversationIdForSending,
          realNumber: realNumber
        })
        
        // USA O NÚMERO REAL PARA ENVIO (prioridade)
        conversationIdForSending = realNumber
      } else {
        console.log('\n' + '='.repeat(80))
        console.log('⚠️ [sendWhatsApp] NÚMERO REAL NÃO ENCONTRADO NO REDIS:')
        console.log('='.repeat(80))
        console.log('LID:', conversationIdForSending)
        console.log('Tentando resolver via resolveConversationId...')
        console.log('='.repeat(80) + '\n')
        
        // Se não encontrou no Redis, tenta resolver via resolveConversationId
        const resolved = await resolveConversationId(
          conversationIdForSending,
          null,
          instanceName,
          config.apiUrl,
          config.apiKey
        )
        
        if (resolved.isRealNumber && resolved.resolvedId !== conversationIdForSending) {
          console.log('\n' + '='.repeat(80))
          console.log('✅ [sendWhatsApp] NÚMERO REAL RESOLVIDO VIA resolveConversationId:')
          console.log('='.repeat(80))
          console.log('LID Original:', conversationIdForSending)
          console.log('Número Real Resolvido:', resolved.resolvedId)
          console.log('USANDO NÚMERO REAL PARA ENVIO')
          console.log('='.repeat(80) + '\n')
          
          conversationIdForSending = resolved.resolvedId
        } else {
          console.log('\n' + '='.repeat(80))
          console.log('⚠️ [sendWhatsApp] NÃO FOI POSSÍVEL RESOLVER NÚMERO REAL:')
          console.log('='.repeat(80))
          console.log('LID:', conversationIdForSending)
          console.log('Tentando enviar com LID (pode falhar)')
          console.log('='.repeat(80) + '\n')
          
          // Mantém o LID original (pode falhar, mas tenta)
        }
      }
    }

    // Resolve APENAS para salvar no banco/Redis (para ter número real quando disponível)
    const resolved = await resolveConversationId(
      originalConversationId,
      null, // Não temos payload do webhook aqui
      instanceName,
      config.apiUrl,
      config.apiKey
    )
    const isLid = conversationIdForSending.endsWith('@lid')
    const isRealNumber = conversationIdForSending.endsWith('@s.whatsapp.net')
    const hasSuffix = /@(lid|s\.whatsapp\.net|c\.us|g\.us)/i.test(conversationIdForSending)

    logger.log('[sendWhatsApp] 📤 Preparando envio:', {
      idOriginal: originalConversationId,
      idParaEnvio: conversationIdForSending,
      isLid,
      isRealNumber,
      temSufixo: hasSuffix,
      resolvidoParaBanco: resolved.resolvedId,
      isRealNumberResolved: resolved.isRealNumber
    })

    // PERMITE ENVIO DIRETO PARA @lid (conforme documentação do WhatsApp)
    // Segundo a documentação: "Sim, o endpoint de envio aceita o identificador no campo to mesmo quando é um LID"
    // Fonte: https://www.z-api.io/blog/lid-no-whatsapp-e-como-funciona/
    
    if (isLid) {
      logger.log('[sendWhatsApp] 📤 Enviando mensagem para @lid (suportado pela Evolution API):', {
        lid: conversationIdForSending,
        messageLength: data.message.length
      })
      // Continua o fluxo normalmente para enviar para @lid
    } else if (!isRealNumber) {
      // Se não é @lid nem número real, pode ser um formato inválido
      logger.warn('[sendWhatsApp] ⚠️ ID com formato desconhecido:', {
        id: conversationIdForSending,
        isLid,
        isRealNumber
      })
      // Tenta enviar mesmo assim (pode ser um formato válido que não reconhecemos)
    }

    // Prepara o payload baseado no formato do ID
    const payload: any = {
      text: data.message
    }

    if (isLid) {
      // Para @lid, tenta usar apenas "phone" com o @lid completo (sem number)
      // Formato: { "phone": "999999999999999@lid", "message": "..." }
      payload.phone = conversationIdForSending
      logger.log('[sendWhatsApp] 📤 Enviando para @lid usando campo "phone":', {
        phone: conversationIdForSending,
        messageLength: data.message.length,
        note: 'Tentando formato alternativo sem campo "number"'
      })
    } else if (hasSuffix && isRealNumber) {
      // Tem sufixo @s.whatsapp.net - usa remoteJid + number
      // A Evolution API exige ambos: number (dígitos) e remoteJid (com sufixo)
      const cleanNumber = conversationIdForSending.replace(/@.*$/, '').replace(/\D/g, '')
      payload.number = cleanNumber
      payload.remoteJid = conversationIdForSending
      logger.log('[sendWhatsApp] 📤 Enviando com remoteJid + number:', {
        remoteJid: conversationIdForSending,
        number: cleanNumber,
        messageLength: data.message.length
      })
    } else {
      // Sem sufixo - usa apenas number (apenas dígitos)
      const cleanNumber = conversationIdForSending.replace(/@.*$/, '').replace(/\D/g, '')
      payload.number = cleanNumber
      logger.log('[sendWhatsApp] 📤 Enviando com number (sem sufixo):', {
        number: cleanNumber,
        original: conversationIdForSending,
        messageLength: data.message.length
      })
    }

    // Log completo do payload que será enviado
    console.log('\n' + '='.repeat(80))
    console.log('📤 [sendWhatsApp] PAYLOAD COMPLETO ENVIADO PARA EVOLUTION API:')
    console.log('='.repeat(80))
    console.log('URL:', `${config.apiUrl}/message/sendText/${instanceName}`)
    console.log('Headers:', {
      'apikey': config.apiKey.substring(0, 20) + '...',
      'Content-Type': 'application/json'
    })
    console.log('Payload (JSON):', JSON.stringify(payload, null, 2))
    console.log('Payload (objeto):', payload)
    console.log('='.repeat(80) + '\n')

    let response: any
    try {
      response = await axios.post(
        `${config.apiUrl}/message/sendText/${instanceName}`,
        payload,
        {
          headers: {
            'apikey': config.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 segundos para envio de mensagem
        }
      )

      // Log completo da resposta recebida
      console.log('\n' + '='.repeat(80))
      console.log('📥 [sendWhatsApp] RESPOSTA COMPLETA DA EVOLUTION API:')
      console.log('='.repeat(80))
      console.log('Status:', response.status)
      console.log('Status Text:', response.statusText)
      console.log('Headers:', JSON.stringify(response.headers, null, 2))
      console.log('Data (JSON):', JSON.stringify(response.data, null, 2))
      console.log('Data (objeto):', response.data)
      console.log('='.repeat(80) + '\n')
    } catch (error: any) {
      // Log completo do erro com payload e resposta
      const errorResponse = error?.response?.data || {}
      const errorHeaders = error?.response?.headers || {}
      
      console.error('\n' + '='.repeat(80))
      console.error('❌ [sendWhatsApp] ERRO COMPLETO AO ENVIAR PARA EVOLUTION API:')
      console.error('='.repeat(80))
      console.error('📤 PAYLOAD ENVIADO:')
      console.error(JSON.stringify(payload, null, 2))
      console.error('\n📥 RESPOSTA DA API:')
      console.error('Status:', error?.response?.status)
      console.error('Status Text:', error?.response?.statusText)
      console.error('Headers:', JSON.stringify(errorHeaders, null, 2))
      console.error('Data:', JSON.stringify(errorResponse, null, 2))
      console.error('\n🔗 INFORMAÇÕES DA REQUISIÇÃO:')
      console.error('URL:', `${config.apiUrl}/message/sendText/${instanceName}`)
      console.error('Method: POST')
      console.error('ID enviado:', conversationIdForSending)
      console.error('Tem sufixo:', hasSuffix)
      console.error('É LID:', isLid)
      console.error('É número real:', isRealNumber)
      console.error('\n💥 DETALHES DO ERRO:')
      console.error('Mensagem:', error?.message)
      console.error('Code:', error?.code)
      console.error('Stack:', error?.stack)
      console.error('='.repeat(80) + '\n')
      
      // Log também no logger estruturado
      logger.error('[sendWhatsApp] ❌ Erro ao enviar mensagem:', {
        conversationIdForSending,
        payload: JSON.stringify(payload, null, 2),
        payloadKeys: Object.keys(payload),
        errorStatus: error?.response?.status,
        errorData: JSON.stringify(errorResponse, null, 2),
        errorMessage: error?.message,
        errorResponseKeys: Object.keys(errorResponse),
        url: `${config.apiUrl}/message/sendText/${instanceName}`
      })
      
      // Tratamento específico para timeout
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        logger.error('[sendWhatsApp] ❌ Timeout ao enviar mensagem:', {
          conversationIdForSending,
          timeout: '30s',
          apiUrl: config.apiUrl
        })
        throw new Error('Timeout: A Evolution API não respondeu em 30 segundos. Verifique se a API está acessível e rodando.')
      }
      
      // Verifica se o erro é "exists: false" (contato não encontrado)
      const errorResponseData = error?.response?.data?.response || error?.response?.data
      const isContactNotFound = Array.isArray(errorResponseData) && 
        errorResponseData.some((msg: any) => msg.exists === false)
      
      if (isContactNotFound || (error?.response?.status === 400 && isLid)) {
        logger.warn('[sendWhatsApp] ⚠️ Contato não encontrado ou @lid não suportado, salvando na fila:', {
          conversationId: conversationIdForSending,
          isLid,
          error: errorResponseData
        })

        // Tenta salvar na fila para processar depois quando número real aparecer
        try {
          const { enqueueResponse } = await import('./whatsapp.queue')
          
          const { data: integration } = await supabase
            .from('tb_integrations')
            .select(`
              id,
              user_id,
              tb_users!inner(email)
            `)
            .eq('id', integrationsId)
            .maybeSingle()

          const { data: agent } = await supabase
            .from('tb_agents')
            .select('id')
            .eq('integrations_id', integrationsId)
            .maybeSingle()

          if (integration && agent) {
            const userEmail = (integration.tb_users as any)?.email

            if (userEmail) {
              const queueResult = await enqueueResponse({
                conversationId: conversationIdForSending,
                integrationsId: integrationsId,
                message: data.message,
                agentId: agent.id,
                userEmail: userEmail
              })

              if (queueResult.success) {
                logger.log('[sendWhatsApp] ✅ Mensagem salva na fila (contato não encontrado):', {
                  queueId: queueResult.queueId,
                  conversationId: conversationIdForSending
                })

                return {
                  success: true,
                  messageId: queueResult.queueId,
                  queued: true,
                  message: 'Mensagem salva na fila. Será enviada automaticamente quando o contato estiver disponível.'
                }
              }
            }
          }
        } catch (queueError: any) {
          logger.error('[sendWhatsApp] ⚠️ Erro ao adicionar à fila:', {
            error: queueError?.message
          })
        }

        // Se não conseguiu salvar na fila, retorna erro
        return {
          success: false,
          error: 'Contato não encontrado no WhatsApp. A mensagem será processada quando o número real estiver disponível.'
        }
      }

      // Se tentou com "phone" e @lid e deu Bad Request, tenta outros formatos
      if (isLid && error?.response?.status === 400 && payload.phone) {
        logger.warn('[sendWhatsApp] ⚠️ Bad Request com formato "phone" + @lid, tentando outros formatos...')
        
        // Tentativa 1: Tenta com remoteJid + number (formato tradicional)
        try {
          const cleanNumber = conversationIdForSending.replace('@lid', '').replace(/\D/g, '')
          if (cleanNumber.length >= 10 && cleanNumber.length <= 15) {
            const retryPayload1 = {
              number: cleanNumber,
              remoteJid: conversationIdForSending,
              text: data.message
            }
            
            console.log('\n' + '='.repeat(80))
            console.log('🔄 [sendWhatsApp] TENTATIVA 1 - RETRY COM remoteJid + number:')
            console.log('='.repeat(80))
            console.log('Payload:', JSON.stringify(retryPayload1, null, 2))
            console.log('='.repeat(80) + '\n')
            
            logger.log('[sendWhatsApp] 🔄 Tentativa 1: remoteJid + number:', {
              remoteJid: conversationIdForSending,
              number: cleanNumber
            })
            
            response = await axios.post(
              `${config.apiUrl}/message/sendText/${instanceName}`,
              retryPayload1,
              {
                headers: {
                  'apikey': config.apiKey,
                  'Content-Type': 'application/json'
                },
                timeout: 30000
              }
            )
            
            console.log('\n' + '='.repeat(80))
            console.log('✅ [sendWhatsApp] SUCESSO NA TENTATIVA 1:')
            console.log('='.repeat(80))
            console.log('Status:', response.status)
            console.log('Data:', JSON.stringify(response.data, null, 2))
            console.log('='.repeat(80) + '\n')
            
            logger.log('[sendWhatsApp] ✅ Sucesso na tentativa 1 (remoteJid + number)')
          }
        } catch (retryError1: any) {
          logger.warn('[sendWhatsApp] ⚠️ Tentativa 1 falhou, tentando formato @s.whatsapp.net...')
          
          // Tentativa 2: Tenta extrair número e usar @s.whatsapp.net
          try {
            const cleanNumber = conversationIdForSending.replace('@lid', '').replace(/\D/g, '')
            if (cleanNumber.length >= 10 && cleanNumber.length <= 15) {
              const retryRemoteJid = `${cleanNumber}@s.whatsapp.net`
              
              const retryPayload2 = {
                number: cleanNumber,
                remoteJid: retryRemoteJid,
                text: data.message
              }
              
              logger.log('[sendWhatsApp] 🔄 Tentativa 2: número extraído com @s.whatsapp.net:', {
                remoteJid: retryRemoteJid,
                number: cleanNumber
              })
              
              console.log('\n' + '='.repeat(80))
              console.log('🔄 [sendWhatsApp] TENTATIVA 2 - RETRY COM @s.whatsapp.net:')
              console.log('='.repeat(80))
              console.log('Payload:', JSON.stringify(retryPayload2, null, 2))
              console.log('='.repeat(80) + '\n')
              
              response = await axios.post(
                `${config.apiUrl}/message/sendText/${instanceName}`,
                retryPayload2,
                {
                  headers: {
                    'apikey': config.apiKey,
                    'Content-Type': 'application/json'
                  },
                  timeout: 30000
                }
              )
              
              console.log('\n' + '='.repeat(80))
              console.log('✅ [sendWhatsApp] SUCESSO NA TENTATIVA 2:')
              console.log('='.repeat(80))
              console.log('Status:', response.status)
              console.log('Data:', JSON.stringify(response.data, null, 2))
              console.log('='.repeat(80) + '\n')
              
              logger.log('[sendWhatsApp] ✅ Sucesso na tentativa 2 (@s.whatsapp.net)')
            } else {
              throw error // Se não conseguir extrair número válido, lança erro original
            }
          } catch (retryError2: any) {
            const retryPayload2ForLog = {
              number: conversationIdForSending.replace('@lid', '').replace(/\D/g, ''),
              remoteJid: `${conversationIdForSending.replace('@lid', '').replace(/\D/g, '')}@s.whatsapp.net`,
              text: data.message
            }
            
            console.error('\n' + '='.repeat(80))
            console.error('❌ [sendWhatsApp] TENTATIVA 2 FALHOU:')
            console.error('='.repeat(80))
            console.error('Payload tentado:', JSON.stringify(retryPayload2ForLog, null, 2))
            console.error('Erro:', JSON.stringify(retryError2?.response?.data || retryError2?.message, null, 2))
            console.error('='.repeat(80) + '\n')
            
            logger.error('[sendWhatsApp] ❌ Todas as tentativas falharam, salvando na fila:', {
              conversationIdForSending,
              errorStatus: retryError2?.response?.status,
              errorData: retryError2?.response?.data
            })
            throw retryError2
          }
        }
      } else if (!hasSuffix && error?.response?.status === 400) {
        // Se não tem sufixo e deu Bad Request, tenta com remoteJid adicionando @s.whatsapp.net
        logger.warn('[sendWhatsApp] ⚠️ Bad Request com number, tentando com remoteJid...')
        try {
          const cleanNumber = conversationIdForSending.replace(/@.*$/, '').replace(/\D/g, '')
          const retryRemoteJid = `${cleanNumber}@s.whatsapp.net`
          
          const retryPayload = {
            number: cleanNumber, // Incluir number também
            remoteJid: retryRemoteJid,
            text: data.message
          }
          
          logger.log('[sendWhatsApp] 🔄 Tentando retry com remoteJid:', {
            original: conversationIdForSending,
            retryRemoteJid
          })
          
          response = await axios.post(
            `${config.apiUrl}/message/sendText/${instanceName}`,
            retryPayload,
            {
              headers: {
                'apikey': config.apiKey,
                'Content-Type': 'application/json'
              },
              timeout: 30000
            }
          )
          
          logger.log('[sendWhatsApp] ✅ Sucesso ao tentar com remoteJid:', {
            remoteJid: retryRemoteJid
          })
        } catch (retryError: any) {
          logger.error('[sendWhatsApp] ❌ Erro também ao tentar com remoteJid:', {
            conversationIdForSending,
            errorStatus: retryError?.response?.status,
            errorData: retryError?.response?.data
          })
          throw retryError
        }
      } else {
        // Se tem sufixo (não @lid) ou não é Bad Request, lança o erro original
        throw error
      }
    }

    const messageId = response.data?.key?.id || response.data?.id || undefined

    logger.log(`[sendWhatsApp] ✅ Mensagem enviada com sucesso para ${conversationIdForSending}`, {
      messageId,
      response: response.data
    })

    // Para salvar no banco/Redis: usa número real quando disponível
    // Isso mantém consistência no banco, mas o envio foi feito com o ID original
    const conversationIdForDb = resolved.isRealNumber ? resolved.resolvedId : originalConversationId
    
    logger.log('[sendWhatsApp] 💾 ID para salvar no banco/Redis:', {
      idEnviado: conversationIdForSending,
      idSalvoNoBanco: conversationIdForDb,
      isRealNumber: resolved.isRealNumber,
      note: resolved.isRealNumber ? 'Salvando número real no banco' : 'Salvando ID original no banco (número real não disponível)'
    })

    // 7️⃣ Salva a mensagem enviada no Redis (histórico temporário)
    // Usa sempre o número real quando disponível para manter consistência
    try {
      const { saveMessageToHistory } = await import('./whatsapp.redis')
      await saveMessageToHistory(
        integrationsId,
        conversationIdForDb, // Usa número real quando disponível
        'assistant',
        data.message
      )
      logger.log('[sendWhatsApp] ✅ Mensagem salva no Redis')
    } catch (saveError: any) {
      // Não bloqueia o envio se falhar ao salvar
      logger.error('[sendWhatsApp] ⚠️ Erro ao salvar mensagem no Redis:', {
        error: saveError?.message
      })
    }

    // 8️⃣ Busca ou cria contato e salva a mensagem enviada no banco de dados
    let contactId: string | null = null // Declarado fora do try para ser usado depois
    
    try {
      // Busca contato pelo LID ou número real
      const { getContactByLid, getContactByPhoneNumber, createOrUpdateContact } = await import('./whatsapp.contacts')
      const isLidForContact = conversationIdForSending.endsWith('@lid')
      const isRealNumberForContact = conversationIdForSending.endsWith('@s.whatsapp.net')
      
      if (isLidForContact) {
        // Busca contato pelo LID
        const contactResult = await getContactByLid(conversationIdForSending)
        if (contactResult.success && contactResult.contact) {
          contactId = contactResult.contact.id
        } else {
          // Cria contato se não existir
          const createResult = await createOrUpdateContact({
            lid: conversationIdForSending,
            status: 'awaiting_phone'
          })
          if (createResult.success && createResult.contact) {
            contactId = createResult.contact.id
          }
        }
      } else if (isRealNumberForContact) {
        // Busca contato pelo número real
        const normalizedPhone = conversationIdForSending.replace(/@s\.whatsapp\.net$/, '').trim()
        const contactResult = await getContactByPhoneNumber(normalizedPhone)
        if (contactResult.success && contactResult.contact) {
          contactId = contactResult.contact.id
        } else {
          // Cria contato se não existir
          const createResult = await createOrUpdateContact({
            lid: normalizedPhone,
            phone_number: normalizedPhone,
            status: 'active'
          })
          if (createResult.success && createResult.contact) {
            contactId = createResult.contact.id
          }
        }
      }
      
      if (contactId) {
        const dbResult = await saveWhatsAppMessage({
          whatsapp_contact_id: contactId,
          message: data.message,
          message_id: messageId,
          direction: 'outbound',
          integrations_id: integrationsId,
          agent_id: data.agentId
        })
        
        if (dbResult.success) {
          logger.log('[sendWhatsApp] ✅ Mensagem salva no banco de dados:', {
            messageId: dbResult.id,
            whatsapp_contact_id: contactId,
            conversationId: conversationIdForSending
          })
        } else {
          logger.error('[sendWhatsApp] ⚠️ Erro ao salvar no banco:', {
            error: dbResult.error,
            conversationId: conversationIdForSending
          })
        }
      } else {
        logger.warn('[sendWhatsApp] ⚠️ Não foi possível obter contactId, mensagem não será salva no banco:', {
          conversationId: conversationIdForSending
        })
      }
    } catch (dbError: any) {
      // Não bloqueia o envio se falhar ao salvar
      logger.error('[sendWhatsApp] ⚠️ Erro ao salvar mensagem no banco (não bloqueia envio):', {
        error: dbError?.message
      })
    }

    // 9️⃣ Marca mensagens não lidas como lidas quando uma resposta é enviada
    // IMPORTANTE: Precisa usar o contactId (UUID), não o conversationId
    try {
      // Busca o contactId (UUID) do contato
      let contactIdForMarking: string | null = null
      
      // Se já temos o contactId da mensagem salva, usa ele
      if (contactId) {
        contactIdForMarking = contactId
        logger.log('[sendWhatsApp] ✅ Usando contactId da mensagem salva para marcar como lida:', {
          contactId: contactIdForMarking
        })
      } else {
        // Se não temos, tenta buscar pelo conversationId
        logger.log('[sendWhatsApp] 🔍 Buscando contactId para marcar mensagens como lidas...', {
          conversationId: conversationIdForDb
        })
        
        // Tenta buscar contato pelo LID ou número
        const { getContactByLid, getContactByPhoneNumber } = await import('./whatsapp.contacts')
        
        if (conversationIdForDb.endsWith('@lid')) {
          const contactResult = await getContactByLid(conversationIdForDb)
          if (contactResult.success && contactResult.contact) {
            contactIdForMarking = contactResult.contact.id
          }
        } else {
          // Remove sufixos para normalizar
          const normalizedNumber = conversationIdForDb.replace(/@s\.whatsapp\.net$/, '').trim()
          const contactResult = await getContactByPhoneNumber(normalizedNumber)
          if (contactResult.success && contactResult.contact) {
            contactIdForMarking = contactResult.contact.id
          }
        }
        
        if (contactIdForMarking) {
          logger.log('[sendWhatsApp] ✅ ContactId encontrado para marcar mensagens como lidas:', {
            contactId: contactIdForMarking,
            conversationId: conversationIdForDb
          })
        } else {
          logger.warn('[sendWhatsApp] ⚠️ Não foi possível encontrar contactId para marcar mensagens como lidas:', {
            conversationId: conversationIdForDb
          })
        }
      }
      
      // Marca mensagens como lidas usando o contactId (UUID)
      if (contactIdForMarking) {
        const markResult = await markMessagesAsRead(contactIdForMarking, integrationsId)
        
        if (markResult.success) {
          logger.log('[sendWhatsApp] ✅ Mensagens não lidas marcadas como lidas:', {
            contactId: contactIdForMarking,
            conversationId: conversationIdForDb
          })
          
          // Log adicional para debug
          console.log('\n' + '='.repeat(80))
          console.log('✅ [sendWhatsApp] MENSAGENS MARCADAS COMO LIDAS:')
          console.log('='.repeat(80))
          console.log('Contact ID (UUID):', contactIdForMarking)
          console.log('Conversation ID:', conversationIdForDb)
          console.log('Integrations ID:', integrationsId)
          console.log('='.repeat(80) + '\n')
        } else {
          logger.error('[sendWhatsApp] ⚠️ Erro ao marcar mensagens como lidas:', {
            error: markResult.error,
            contactId: contactIdForMarking,
            conversationId: conversationIdForDb
          })
        }
      } else {
        logger.warn('[sendWhatsApp] ⚠️ Não foi possível marcar mensagens como lidas: contactId não encontrado', {
          conversationId: conversationIdForDb
        })
      }
    } catch (markError: any) {
      // Não bloqueia o envio se falhar ao marcar
      logger.error('[sendWhatsApp] ⚠️ Erro ao marcar mensagens como lidas (não bloqueia envio):', {
        error: markError?.message,
        stack: markError?.stack
      })
    }

    return {
      success: true,
      messageId: messageId,
      history: history // Retorna histórico para uso na IA
    }
  } catch (error: any) {
    const errorDetails = {
      message: error?.message || 'Erro desconhecido',
      code: error?.code || null,
      response: error?.response?.data || null,
      status: error?.response?.status || null,
      url: error?.config?.url || null,
      method: error?.config?.method || null
    }

    logger.error('[sendWhatsApp] ❌ Erro detalhado ao enviar mensagem:', errorDetails)
    logger.error('[sendWhatsApp] ❌ Erro completo:', error)

    // Se for erro de conexão, retorna mensagem clara
    if (error?.code === 'ECONNREFUSED') {
      const apiUrl = process.env.EVOLUTION_API_URL || 'http://192.168.15.31:8081'
      return {
        success: false,
        error: `❌ EvolutionAPI não está rodando ou não está acessível em ${apiUrl}.\n\n` +
          `📋 Verifique:\n` +
          `1. A EvolutionAPI está rodando?\n` +
          `2. A URL está correta no arquivo BackEnd/.env? (atual: ${apiUrl})\n` +
          `3. A porta está aberta e acessível?\n\n` +
          `💡 Para iniciar a EvolutionAPI, consulte: BackEnd/EVOLUTION_API_SETUP.md`
      }
    }

    // Tenta obter QR Code se der erro (pode ser que não esteja conectado)
    let qrCode: string | null = null
    let isConnected = false
    try {
      const qrResult = await getQRCode(integrationsId)
      qrCode = qrResult.qrCode
      isConnected = qrResult.isConnected
      
      // Se estiver conectada, não precisa retornar erro
      if (isConnected) {
        logger.log('[sendWhatsApp] ✅ Instância está conectada, tentando enviar novamente...')
        // Pode tentar enviar novamente ou retornar sucesso
      }
    } catch (qrError: any) {
      logger.error('[sendWhatsApp] ⚠️ Erro ao obter QR Code após falha:', {
        error: qrError.message
      })
    }

    const errorMessage = errorDetails.response?.message ||
                        errorDetails.response?.error ||
                        errorDetails.message ||
                        'Erro desconhecido'

    return {
      success: false,
      error: errorMessage,
      qrCode: qrCode || undefined
    }
  }
}

/**
 * Busca mensagens diretamente da Evolution API
 * Útil para sincronizar mensagens que o webhook não capturou
 */
export async function fetchMessagesFromEvolutionAPI(
  integrationsId: string,
  limit: number = 50
): Promise<{ success: boolean; messages?: any[]; error?: string }> {
  try {
    const config = await getEvolutionAPICredentials(integrationsId)
    if (!config) {
      return { success: false, error: 'Credenciais não encontradas' }
    }
    const instanceName = await createOrGetInstance(config)

    logger.log('[fetchMessagesFromEvolutionAPI] Buscando mensagens da Evolution API...', {
      instanceName,
      limit
    })

    // Evolution API endpoint para buscar mensagens
    // Nota: A Evolution API pode não ter endpoint direto para buscar mensagens
    // Este é um placeholder - pode precisar usar webhooks ou outra abordagem
    const response = await axios.get(
      `${config.apiUrl}/chat/fetchMessages/${instanceName}`,
      {
        headers: {
          'apikey': config.apiKey,
          'Content-Type': 'application/json'
        },
        params: {
          limit: limit
        },
        timeout: 30000
      }
    ).catch(async (error) => {
      // Se o endpoint não existir, tenta buscar via chat
      logger.warn('[fetchMessagesFromEvolutionAPI] Endpoint fetchMessages não disponível, tentando chat...')
      
      // Tenta buscar via endpoint de chat (se disponível)
      try {
        const chatResponse = await axios.get(
          `${config.apiUrl}/chat/fetchChats/${instanceName}`,
          {
            headers: {
              'apikey': config.apiKey,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        )
        return chatResponse
      } catch (chatError: any) {
        logger.error('[fetchMessagesFromEvolutionAPI] ❌ Erro ao buscar mensagens:', {
          error: chatError.message,
          status: chatError.response?.status
        })
        throw chatError
      }
    })

    logger.log('[fetchMessagesFromEvolutionAPI] ✅ Mensagens buscadas:', {
      count: response.data?.length || 0
    })

    return {
      success: true,
      messages: response.data || []
    }
  } catch (error: any) {
    logger.error('[fetchMessagesFromEvolutionAPI] ❌ Erro:', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data
    })
    return {
      success: false,
      error: error?.message || 'Erro ao buscar mensagens da Evolution API'
    }
  }
}

/**
 * Salva uma mensagem do WhatsApp no banco de dados
 */
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

export async function saveWhatsAppMessage(data: {
  whatsapp_contact_id: string // ID do contato em tb_whatsapp_contacts
  message: string
  message_id?: string
  direction: 'inbound' | 'outbound'
  integrations_id: string
  agent_id?: string
}): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    logger.log('[saveWhatsAppMessage] Salvando mensagem...', {
      whatsapp_contact_id: data.whatsapp_contact_id,
      direction: data.direction,
      messageLength: data.message.length
    })

    // Mensagens outbound (enviadas) são sempre marcadas como lidas
    // Mensagens inbound (recebidas) começam como não lidas
    const isRead = data.direction === 'outbound'
    
    logger.log('[saveWhatsAppMessage] Definindo is_read:', {
      direction: data.direction,
      is_read: isRead
    })

    const { data: savedData, error } = await supabase
      .from('tb_whatsapp_messages')
      .insert({
        whatsapp_contact_id: data.whatsapp_contact_id,
        message: data.message,
        message_id: data.message_id,
        direction: data.direction,
        integrations_id: data.integrations_id,
        agent_id: data.agent_id,
        is_read: isRead // true para outbound, false para inbound
      })
      .select('id')
      .single()

    if (error) {
      logger.error('[saveWhatsAppMessage] ❌ Erro ao salvar mensagem:', {
        error: error.message,
        details: error
      })
      return {
        success: false,
        error: error.message
      }
    }

    logger.log('[saveWhatsAppMessage] ✅ Mensagem salva com sucesso', {
      id: savedData?.id,
      direction: data.direction,
      is_read: isRead,
      whatsapp_contact_id: data.whatsapp_contact_id
    })
    
    // Log adicional para debug
    console.log('\n' + '='.repeat(80))
    console.log('💾 [saveWhatsAppMessage] MENSAGEM SALVA NO BANCO:')
    console.log('='.repeat(80))
    console.log('ID:', savedData?.id)
    console.log('Direction:', data.direction)
    console.log('is_read:', isRead)
    console.log('whatsapp_contact_id:', data.whatsapp_contact_id)
    console.log('='.repeat(80) + '\n')

    return {
      success: true,
      id: savedData?.id
    }
  } catch (error: any) {
    logger.error('[saveWhatsAppMessage] ❌ Erro:', {
      message: error?.message,
      stack: error?.stack
    })
    return {
      success: false,
      error: error?.message || 'Erro desconhecido ao salvar mensagem'
    }
  }
}

/**
 * Busca histórico de mensagens de um contato
 * Retorna as últimas N mensagens ordenadas por data (mais antigas primeiro)
 * 
 * @param contactId - ID do contato em tb_whatsapp_contacts (ou LID para buscar contato)
 * @param integrationsId - ID da integração
 * @param limit - Quantidade de mensagens (padrão: 10)
 * @param agentId - ID do agente (opcional, para filtrar por agente)
 * @param sinceTimestamp - Buscar apenas mensagens após este timestamp (opcional, para não lidas)
 */
export async function getWhatsAppHistory(
  contactIdOrLid: string,
  integrationsId: string,
  limit: number = 10,
  agentId?: string,
  sinceTimestamp?: string
): Promise<WhatsAppMessage[]> {
  try {
    logger.log('[getWhatsAppHistory] Buscando histórico...', {
      contactIdOrLid,
      integrations_id: integrationsId,
      limit,
      agent_id: agentId,
      since_timestamp: sinceTimestamp
    })

    // Tenta buscar contato se for LID
    let contactId = contactIdOrLid
    if (contactIdOrLid.endsWith('@lid') || !contactIdOrLid.includes('-')) {
      // Pode ser LID ou UUID, tenta buscar contato
      const { getContactByLid } = await import('./whatsapp.contacts')
      const contactResult = await getContactByLid(contactIdOrLid)
      if (contactResult.success && contactResult.contact) {
        contactId = contactResult.contact.id
      }
    }

    let query = supabase
      .from('tb_whatsapp_messages')
      .select('*')
      .eq('whatsapp_contact_id', contactId)
      .eq('integrations_id', integrationsId)

    // Filtro opcional por agente
    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    // Filtro opcional por timestamp (mensagens não lidas após uma data)
    if (sinceTimestamp) {
      query = query.gte('created_at', sinceTimestamp)
    }

    query = query
      .order('created_at', { ascending: true }) // Mais antigas primeiro (para contexto cronológico)
      .limit(limit)

    const { data, error } = await query

    if (error) {
      logger.error('[getWhatsAppHistory] ❌ Erro ao buscar histórico:', {
        error: error.message
      })
      return []
    }

    logger.log('[getWhatsAppHistory] ✅ Histórico encontrado', {
      count: data?.length || 0
    })

    return (data || []) as WhatsAppMessage[]
  } catch (error: any) {
    logger.error('[getWhatsAppHistory] ❌ Erro:', {
      message: error?.message,
      stack: error?.stack
    })
    return []
  }
}

/**
 * Busca mensagens não lidas usando timestamp
 * Retorna mensagens recebidas após um timestamp específico
 * 
 * @param phoneNumber - Número de telefone
 * @param integrationsId - ID da integração
 * @param sinceTimestamp - Timestamp para buscar mensagens após esta data
 * @param agentId - ID do agente (opcional)
 */
export async function getUnreadMessages(
  contactIdOrLid: string,
  integrationsId: string,
  sinceTimestamp: string,
  agentId?: string
): Promise<WhatsAppMessage[]> {
  try {
    logger.log('[getUnreadMessages] Buscando mensagens não lidas...', {
      contactIdOrLid,
      integrations_id: integrationsId,
      since_timestamp: sinceTimestamp,
      agent_id: agentId
    })

    // Tenta buscar contato se for LID
    let contactId = contactIdOrLid
    if (contactIdOrLid.endsWith('@lid') || !contactIdOrLid.includes('-')) {
      const { getContactByLid } = await import('./whatsapp.contacts')
      const contactResult = await getContactByLid(contactIdOrLid)
      if (contactResult.success && contactResult.contact) {
        contactId = contactResult.contact.id
      }
    }

    let query = supabase
      .from('tb_whatsapp_messages')
      .select('*')
      .eq('whatsapp_contact_id', contactId)
      .eq('integrations_id', integrationsId)
      .eq('is_read', false)
      .gte('created_at', sinceTimestamp) // Mensagens após o timestamp

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    query = query.order('created_at', { ascending: true })

    const { data, error } = await query

    if (error) {
      logger.error('[getUnreadMessages] ❌ Erro:', {
        error: error.message
      })
      return []
    }

    logger.log('[getUnreadMessages] ✅ Mensagens não lidas encontradas', {
      count: data?.length || 0
    })

    return (data || []) as WhatsAppMessage[]
  } catch (error: any) {
    logger.error('[getUnreadMessages] ❌ Erro:', {
      message: error?.message,
      stack: error?.stack
    })
    return []
  }
}

/**
 * Busca mensagens diretamente da Evolution API usando o endpoint de chats
 * Retorna conversas com mensagens recentes
 */
export async function fetchChatsFromEvolutionAPI(
  integrationsId: string
): Promise<{ success: boolean; chats?: any[]; error?: string }> {
  try {
    const config = await getEvolutionAPICredentials(integrationsId)
    if (!config) {
      return { success: false, error: 'Credenciais não encontradas' }
    }
    const instanceName = await createOrGetInstance(config)

    logger.log('[fetchChatsFromEvolutionAPI] Buscando chats da Evolution API...', {
      instanceName
    })

    // Evolution API endpoint: GET /chat/fetchChats/{instanceName}
    const response = await axios.get(
      `${config.apiUrl}/chat/fetchChats/${instanceName}`,
      {
        headers: {
          'apikey': config.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    )

    logger.log('[fetchChatsFromEvolutionAPI] ✅ Chats encontrados:', {
      count: response.data?.length || 0
    })

    return {
      success: true,
      chats: response.data || []
    }
  } catch (error: any) {
    logger.error('[fetchChatsFromEvolutionAPI] ❌ Erro:', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data
    })
    return {
      success: false,
      error: error?.message || 'Erro ao buscar chats da Evolution API'
    }
  }
}

/**
 * Busca mensagens de um chat específico da Evolution API
 */
export async function fetchMessagesFromChat(
  integrationsId: string,
  remoteJid: string,
  limit: number = 50
): Promise<{ success: boolean; messages?: any[]; error?: string }> {
  try {
    const config = await getEvolutionAPICredentials(integrationsId)
    if (!config) {
      return { success: false, error: 'Credenciais não encontradas' }
    }
    const instanceName = await createOrGetInstance(config)

    logger.log('[fetchMessagesFromChat] Buscando mensagens do chat...', {
      instanceName,
      remoteJid,
      limit
    })

    // Evolution API endpoint: GET /chat/fetchMessages/{instanceName}
    const response = await axios.get(
      `${config.apiUrl}/chat/fetchMessages/${instanceName}`,
      {
        headers: {
          'apikey': config.apiKey,
          'Content-Type': 'application/json'
        },
        params: {
          where: JSON.stringify({ remoteJid }),
          limit: limit
        },
        timeout: 30000
      }
    )

    logger.log('[fetchMessagesFromChat] ✅ Mensagens encontradas:', {
      count: response.data?.length || 0
    })

    return {
      success: true,
      messages: response.data || []
    }
  } catch (error: any) {
    logger.error('[fetchMessagesFromChat] ❌ Erro:', {
      message: error?.message,
      status: error?.response?.status
    })
    return {
      success: false,
      error: error?.message || 'Erro ao buscar mensagens do chat'
    }
  }
}

/**
 * Busca todas as mensagens não lidas de uma integração
 * IMPORTANTE: A Evolution API NÃO tem endpoint para buscar mensagens.
 * As mensagens DEVEM vir via webhook e serem salvas no banco.
 * Se não houver mensagens no banco, significa que o webhook não está funcionando.
 */
export async function getAllUnreadMessages(
  integrationsId: string,
  agentId?: string
): Promise<WhatsAppMessage[]> {
  try {
    logger.log('[getAllUnreadMessages] Buscando todas as mensagens não lidas...', {
      integrations_id: integrationsId,
      agent_id: agentId
    })

    // Busca do banco de dados (única fonte de mensagens)
    // Busca mensagens não lidas, agrupadas por contato, pegando apenas a última de cada contato
    // NOTA: Usa join manual ao invés de relacionamento automático para evitar problemas de cache
    let query = supabase
      .from('tb_whatsapp_messages')
      .select('*')
      .eq('integrations_id', integrationsId)
      .eq('is_read', false)
      .eq('direction', 'inbound') // Apenas mensagens recebidas

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    // Ordena por data (mais recente primeiro) para pegar a última de cada contato
    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      logger.error('[getAllUnreadMessages] ❌ Erro ao buscar do banco:', {
        error: error.message
      })
      return []
    }

    const messagesFromDB = (data || []) as any[]

    if (messagesFromDB.length === 0) {
      logger.warn('[getAllUnreadMessages] ⚠️ NENHUMA mensagem não lida encontrada no banco!', {
        hint: 'Isso significa que o webhook não está salvando mensagens. Verifique:',
        checklist: [
          '1. Webhook configurado no docker-compose.yml?',
          '2. Evolution API reiniciado após configurar webhook?',
          '3. Backend acessível em http://host.docker.internal:3333/whatsapp/webhook?',
          '4. InstanceName da Evolution API = phone_number no banco?',
          '5. Verifique logs do backend para erros do webhook'
        ]
      })
      return []
    }

    // Busca os contatos separadamente (join manual para evitar problemas de cache)
    const contactIds = [...new Set(messagesFromDB.map((msg: any) => msg.whatsapp_contact_id).filter(Boolean))]
    
    let contactsMap = new Map<string, any>()
    if (contactIds.length > 0) {
      const { data: contacts, error: contactsError } = await supabase
        .from('tb_whatsapp_contacts')
        .select('id, lid, phone_number, status')
        .in('id', contactIds)
      
      if (!contactsError && contacts) {
        for (const contact of contacts) {
          contactsMap.set(contact.id, contact)
        }
      }
    }

    // Adiciona dados do contato a cada mensagem
    const messagesWithContacts = messagesFromDB.map((msg: any) => {
      const contact = contactsMap.get(msg.whatsapp_contact_id)
      return {
        ...msg,
        contact: contact || null
      }
    })

    // Agrupa por contato e pega apenas a última mensagem de cada contato
    const messagesByContact = new Map<string, any>()
    
    for (const msg of messagesWithContacts) {
      const contactId = msg.whatsapp_contact_id
      if (!messagesByContact.has(contactId)) {
        messagesByContact.set(contactId, msg)
      }
    }

    const lastMessages = Array.from(messagesByContact.values())
    
    // Ordena novamente por data (mais recente primeiro)
    lastMessages.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return dateB - dateA
    })

    logger.log('[getAllUnreadMessages] ✅ Últimas mensagens não lidas encontradas (uma por contato):', {
      totalMessages: messagesFromDB.length,
      uniqueContacts: lastMessages.length
    })

    return lastMessages as WhatsAppMessage[]
  } catch (error: any) {
    logger.error('[getAllUnreadMessages] ❌ Erro:', {
      message: error?.message,
      stack: error?.stack
    })
    return []
  }
}

/**
 * Busca o número do contato para envio de mensagem
 * Se receber um contactId (UUID), busca o contato e retorna o número real ou LID
 */
export async function getContactNumberForSending(
  contactIdOrLid: string,
  integrationsId: string
): Promise<{ success: boolean; number?: string; error?: string }> {
  try {
    console.log('\n' + '='.repeat(80))
    console.log('🔍 [getContactNumberForSending] BUSCANDO CONTATO NO BANCO:')
    console.log('='.repeat(80))
    console.log('ID/LID Recebido:', contactIdOrLid)
    console.log('É UUID?', contactIdOrLid.includes('-') && contactIdOrLid.length === 36)
    console.log('É LID?', contactIdOrLid.endsWith('@lid'))
    console.log('É número real?', contactIdOrLid.endsWith('@s.whatsapp.net'))
    console.log('='.repeat(80) + '\n')
    
    const { getContactByLid, getContactByPhoneNumber } = await import('./whatsapp.contacts')
    
    // Se for UUID (tem hífens), busca contato pelo ID
    if (contactIdOrLid.includes('-') && contactIdOrLid.length === 36) {
      console.log('\n' + '='.repeat(80))
      console.log('📊 [getContactNumberForSending] EXECUTANDO SELECT NO BANCO:')
      console.log('='.repeat(80))
      console.log('Tabela: tb_whatsapp_contacts')
      console.log('SELECT: id, lid, phone_number, status')
      console.log('WHERE: id =', contactIdOrLid)
      console.log('='.repeat(80) + '\n')
      
      const { data: contact, error } = await supabase
        .from('tb_whatsapp_contacts')
        .select('id, lid, phone_number, status')
        .eq('id', contactIdOrLid)
        .maybeSingle()
      
      console.log('\n' + '='.repeat(80))
      console.log('📊 [getContactNumberForSending] RESULTADO DO SELECT:')
      console.log('='.repeat(80))
      console.log('Contato encontrado?', !!contact)
      console.log('Erro?', error?.message || 'Nenhum')
      if (contact) {
        console.log('ID:', contact.id)
        console.log('LID:', contact.lid)
        console.log('Phone Number:', contact.phone_number)
        console.log('Status:', contact.status)
      }
      console.log('='.repeat(80) + '\n')
      
      if (error) {
        logger.error('[getContactNumberForSending] ❌ Erro ao buscar contato:', {
          error: error.message
        })
        return { success: false, error: error.message }
      }
      
      if (!contact) {
        return { success: false, error: 'Contato não encontrado' }
      }
      
      // Prioriza número real, senão usa LID
      if (contact.phone_number && contact.status === 'active') {
        // Retorna número real com @s.whatsapp.net
        return { 
          success: true, 
          number: `${contact.phone_number}@s.whatsapp.net` 
        }
      } else if (contact.lid) {
        // Retorna LID
        return { 
          success: true, 
          number: contact.lid.endsWith('@lid') ? contact.lid : `${contact.lid}@lid`
        }
      }
      
      return { success: false, error: 'Contato não tem número nem LID' }
    }
    
    // Se for LID, busca contato pelo LID E pelo número (caso o contato tenha sido atualizado)
    if (contactIdOrLid.endsWith('@lid')) {
      const normalizedLid = contactIdOrLid.replace(/@lid$/, '').trim()
      
      // Tenta buscar pelo LID primeiro
      let contactResult = await getContactByLid(contactIdOrLid)
      
      // Se não encontrou pelo LID, tenta buscar pelo número (caso o LID tenha sido convertido para número)
      if (!contactResult.success || !contactResult.contact) {
        logger.log('[getContactNumberForSending] 🔍 LID não encontrado, tentando buscar pelo número...', {
          lid: contactIdOrLid,
          normalizedLid: normalizedLid
        })
        
        // Tenta buscar pelo número (pode ser que o LID tenha sido atualizado para número)
        contactResult = await getContactByPhoneNumber(normalizedLid)
      }
      
      if (contactResult.success && contactResult.contact) {
        // Prioriza número real
        if (contactResult.contact.phone_number && contactResult.contact.status === 'active') {
          logger.log('[getContactNumberForSending] ✅ Contato encontrado (LID → número real):', {
            lid: contactIdOrLid,
            phone_number: contactResult.contact.phone_number,
            foundBy: contactResult.contact.lid === normalizedLid ? 'LID' : 'phone_number'
          })
          return { 
            success: true, 
            number: `${contactResult.contact.phone_number}@s.whatsapp.net` 
          }
        }
        // Se não tem número real, retorna erro (não pode enviar só com LID se não tiver número)
        logger.warn('[getContactNumberForSending] ⚠️ Contato encontrado mas sem número real:', {
          lid: contactIdOrLid,
          status: contactResult.contact.status
        })
        return { 
          success: false, 
          error: `Contato encontrado mas sem número real. Status: ${contactResult.contact.status}. Aguarde o número ser resolvido.` 
        }
      } else {
        // LID e número não encontrados no banco
        logger.error('[getContactNumberForSending] ❌ LID e número não encontrados no banco:', {
          lid: contactIdOrLid,
          normalizedLid: normalizedLid
        })
        return { 
          success: false, 
          error: `LID não encontrado no banco de dados: ${contactIdOrLid}. Verifique se o contato existe em tb_whatsapp_contacts.` 
        }
      }
    }
    
    // Se for número direto (sem @), tenta buscar contato pelo número
    if (!contactIdOrLid.includes('@')) {
      // Remove @s.whatsapp.net se tiver (normaliza)
      const normalizedNumber = contactIdOrLid.replace(/@s\.whatsapp\.net$/, '').trim()
      const contactResult = await getContactByPhoneNumber(normalizedNumber)
      
      if (contactResult.success && contactResult.contact) {
        // Contato encontrado, retorna número formatado
        logger.log('[getContactNumberForSending] ✅ Contato encontrado pelo número:', {
          number: normalizedNumber,
          contactId: contactResult.contact.id
        })
        return { 
          success: true, 
          number: `${contactResult.contact.phone_number || normalizedNumber}@s.whatsapp.net` 
        }
      } else {
        // Número não encontrado no banco
        logger.error('[getContactNumberForSending] ❌ Número não encontrado no banco:', {
          number: normalizedNumber
        })
        return { 
          success: false, 
          error: `Número não encontrado no banco de dados: ${normalizedNumber}. Verifique se o contato existe em tb_whatsapp_contacts.` 
        }
      }
    }
    
    // Se já tem sufixo @s.whatsapp.net, busca pelo número E pelo LID (caso o contato tenha sido criado com LID)
    if (contactIdOrLid.endsWith('@s.whatsapp.net')) {
      const normalizedNumber = contactIdOrLid.replace(/@s\.whatsapp\.net$/, '').trim()
      
      // Tenta buscar pelo número primeiro
      let contactResult = await getContactByPhoneNumber(normalizedNumber)
      
      // Se não encontrou pelo número, tenta buscar pelo LID (caso o número tenha sido o LID original)
      if (!contactResult.success || !contactResult.contact) {
        logger.log('[getContactNumberForSending] 🔍 Número não encontrado, tentando buscar pelo LID...', {
          number: contactIdOrLid,
          normalizedNumber: normalizedNumber
        })
        
        // Tenta buscar pelo LID (pode ser que o número seja o LID original)
        contactResult = await getContactByLid(normalizedNumber)
      }
      
      if (contactResult.success && contactResult.contact) {
        // Contato encontrado, retorna como está
        logger.log('[getContactNumberForSending] ✅ Contato encontrado (número real):', {
          number: contactIdOrLid,
          contactId: contactResult.contact.id,
          foundBy: contactResult.contact.phone_number === normalizedNumber ? 'phone_number' : 'LID'
        })
        return { 
          success: true, 
          number: contactIdOrLid 
        }
      } else {
        // Número e LID não encontrados no banco
        logger.error('[getContactNumberForSending] ❌ Número real e LID não encontrados no banco:', {
          number: contactIdOrLid,
          normalizedNumber: normalizedNumber
        })
        return { 
          success: false, 
          error: `Número não encontrado no banco de dados: ${contactIdOrLid}. Verifique se o contato existe em tb_whatsapp_contacts.` 
        }
      }
    }
    
    // Se chegou aqui, formato não reconhecido
    logger.error('[getContactNumberForSending] ❌ Formato não reconhecido:', {
      contactIdOrLid
    })
    return { 
      success: false, 
      error: `Formato não reconhecido: ${contactIdOrLid}. Deve ser UUID, LID (@lid) ou número real (@s.whatsapp.net).` 
    }
  } catch (error: any) {
    logger.error('[getContactNumberForSending] ❌ Erro:', {
      message: error?.message
    })
    return { 
      success: false, 
      error: error?.message || 'Erro ao buscar número do contato' 
    }
  }
}

/**
 * Marca mensagens como lidas
 */
export async function markMessagesAsRead(
  contactId: string,
  integrationsId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('tb_whatsapp_messages')
      .update({ is_read: true })
      .eq('whatsapp_contact_id', contactId)
      .eq('integrations_id', integrationsId)
      .eq('is_read', false)

    if (error) {
      logger.error('[markMessagesAsRead] ❌ Erro:', {
        error: error.message
      })
      return {
        success: false,
        error: error.message
      }
    }

    return { success: true }
  } catch (error: any) {
    logger.error('[markMessagesAsRead] ❌ Erro:', {
      message: error?.message
    })
    return {
      success: false,
      error: error?.message || 'Erro desconhecido'
    }
  }
}
