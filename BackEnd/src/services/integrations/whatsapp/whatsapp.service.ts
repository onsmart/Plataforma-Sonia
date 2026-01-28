import { supabase } from '../../../lib/supabase'
import logger from '../../../lib/logger'
import axios from 'axios'

export interface WhatsAppMessage {
  id?: string
  phone_number: string
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
  apiUrl: string // URL da Evolution API (ex: http://localhost:8081)
  apiKey: string // API Key da Evolution API
  instanceName: string // Nome da instância (phone_number ou integrationsId)
}

/**
 * Busca as credenciais da Evolution API
 * phone_number vem do banco (tb_integrations), resto vem do .env com valores padrão
 */
async function getEvolutionAPICredentials(integrationsId: string): Promise<EvolutionAPIConfig | null> {
  try {
    // Valores padrão básicos (podem ser sobrescritos pelo .env)
    const apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8081'
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
 * Envia mensagem via WhatsApp usando Evolution API
 * Fluxo: Verificar API → Criar instância → Verificar conexão → Enviar
 */
export async function sendWhatsApp(
  integrationsId: string,
  data: SendWhatsAppInput
): Promise<{ success: boolean; messageId?: string; error?: string; qrCode?: string; history?: any[] }> {
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
      phoneNumber: data.to,
      integrationsId
    })

    const { getHistoryFromRedis } = await import('./whatsapp.redis')
    const history = await getHistoryFromRedis(
      integrationsId,
      data.to,
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

    // Formata o número de telefone (remove sufixos do WhatsApp e caracteres especiais)
    // Remove @s.whatsapp.net, @c.us, @lid, @g.us, etc.
    let phoneNumber = data.to
      .replace(/@s\.whatsapp\.net/gi, '')
      .replace(/@c\.us/gi, '')
      .replace(/@lid/gi, '')
      .replace(/@g\.us/gi, '')
      .replace(/\D/g, '') // Remove todos os caracteres não numéricos
    
    // Valida se o número não ficou vazio após normalização
    if (!phoneNumber || phoneNumber.length === 0) {
      logger.error('[sendWhatsApp] ❌ Número ficou vazio após normalização:', {
        original: data.to
      })
      return {
        success: false,
        error: 'Número de telefone inválido após normalização. Verifique o número fornecido.'
      }
    }

    // Valida se o número tem pelo menos 10 dígitos (número mínimo válido)
    if (phoneNumber.length < 10) {
      logger.error('[sendWhatsApp] ❌ Número muito curto:', {
        original: data.to,
        normalized: phoneNumber,
        length: phoneNumber.length
      })
      return {
        success: false,
        error: `Número de telefone muito curto (${phoneNumber.length} dígitos). Mínimo: 10 dígitos. Número original: ${data.to}`
      }
    }
    
    // Valida se o número não é um ID muito longo (IDs de grupo/participante geralmente têm mais de 15 dígitos)
    if (phoneNumber.length > 15) {
      logger.warn('[sendWhatsApp] ⚠️ Número parece ser um ID inválido (muito longo):', {
        original: data.to,
        normalized: phoneNumber,
        length: phoneNumber.length
      })
      // Se for um ID muito longo, tenta extrair apenas os últimos 15 dígitos (pode ser um número válido no final)
      // Mas isso é um fallback - o ideal é que o número venha correto do contexto
      if (phoneNumber.length > 15) {
        logger.warn('[sendWhatsApp] ⚠️ Tentando usar últimos 15 dígitos como fallback')
        phoneNumber = phoneNumber.slice(-15)
      }
    }
    
    logger.log('[sendWhatsApp] 📱 Número normalizado:', {
      original: data.to,
      normalized: phoneNumber
    })

    const response = await axios.post(
      `${config.apiUrl}/message/sendText/${instanceName}`,
      {
        number: phoneNumber,
        text: data.message
      },
      {
        headers: {
          'apikey': config.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 segundos para envio de mensagem
      }
    ).catch((error: any) => {
      // Tratamento específico para timeout
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        logger.error('[sendWhatsApp] ❌ Timeout ao enviar mensagem:', {
          phoneNumber,
          timeout: '30s',
          apiUrl: config.apiUrl
        })
        throw new Error('Timeout: A Evolution API não respondeu em 30 segundos. Verifique se a API está acessível e rodando.')
      }
      throw error
    })

    const messageId = response.data?.key?.id || response.data?.id || undefined

    logger.log(`[sendWhatsApp] ✅ Mensagem enviada com sucesso para ${phoneNumber}`, {
      messageId,
      response: response.data
    })

    // 7️⃣ Salva a mensagem enviada no Redis (histórico temporário)
    try {
      const { saveMessageToHistory } = await import('./whatsapp.redis')
      await saveMessageToHistory(
        integrationsId,
        phoneNumber,
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
      const apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8081'
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
export async function saveWhatsAppMessage(data: {
  phone_number: string
  message: string
  message_id?: string
  direction: 'inbound' | 'outbound'
  integrations_id: string
  agent_id?: string
}): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    logger.log('[saveWhatsAppMessage] Salvando mensagem...', {
      phone_number: data.phone_number,
      direction: data.direction,
      messageLength: data.message.length
    })

    const { data: savedData, error } = await supabase
      .from('tb_whatsapp_messages')
      .insert({
        phone_number: data.phone_number,
        message: data.message,
        message_id: data.message_id,
        direction: data.direction,
        integrations_id: data.integrations_id,
        agent_id: data.agent_id,
        is_read: data.direction === 'outbound' // Mensagens enviadas são consideradas "lidas"
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
      id: savedData?.id
    })

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
 * Busca histórico de mensagens de um número de telefone
 * Retorna as últimas N mensagens ordenadas por data (mais antigas primeiro)
 * 
 * @param phoneNumber - Número de telefone
 * @param integrationsId - ID da integração
 * @param limit - Quantidade de mensagens (padrão: 10)
 * @param agentId - ID do agente (opcional, para filtrar por agente)
 * @param sinceTimestamp - Buscar apenas mensagens após este timestamp (opcional, para não lidas)
 */
export async function getWhatsAppHistory(
  phoneNumber: string,
  integrationsId: string,
  limit: number = 10,
  agentId?: string,
  sinceTimestamp?: string
): Promise<WhatsAppMessage[]> {
  try {
    logger.log('[getWhatsAppHistory] Buscando histórico...', {
      phone_number: phoneNumber,
      integrations_id: integrationsId,
      limit,
      agent_id: agentId,
      since_timestamp: sinceTimestamp
    })

    // Remove caracteres não numéricos para normalizar
    const normalizedPhone = phoneNumber.replace(/\D/g, '')

    let query = supabase
      .from('tb_whatsapp_messages')
      .select('*')
      .eq('phone_number', normalizedPhone)
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
  phoneNumber: string,
  integrationsId: string,
  sinceTimestamp: string,
  agentId?: string
): Promise<WhatsAppMessage[]> {
  try {
    logger.log('[getUnreadMessages] Buscando mensagens não lidas...', {
      phone_number: phoneNumber,
      integrations_id: integrationsId,
      since_timestamp: sinceTimestamp,
      agent_id: agentId
    })

    const normalizedPhone = phoneNumber.replace(/\D/g, '')

    let query = supabase
      .from('tb_whatsapp_messages')
      .select('*')
      .eq('phone_number', normalizedPhone)
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
    let query = supabase
      .from('tb_whatsapp_messages')
      .select('*')
      .eq('integrations_id', integrationsId)
      .eq('is_read', false)
      .eq('direction', 'inbound') // Apenas mensagens recebidas

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    query = query.order('created_at', { ascending: true })

    const { data, error } = await query

    if (error) {
      logger.error('[getAllUnreadMessages] ❌ Erro ao buscar do banco:', {
        error: error.message
      })
      return []
    }

    const messagesFromDB = (data || []) as WhatsAppMessage[]

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
    } else {
      logger.log('[getAllUnreadMessages] ✅ Mensagens não lidas encontradas:', {
        count: messagesFromDB.length
      })
    }

    return messagesFromDB
  } catch (error: any) {
    logger.error('[getAllUnreadMessages] ❌ Erro:', {
      message: error?.message,
      stack: error?.stack
    })
    return []
  }
}

/**
 * Marca mensagens como lidas
 */
export async function markMessagesAsRead(
  phoneNumber: string,
  integrationsId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedPhone = phoneNumber.replace(/\D/g, '')

    const { error } = await supabase
      .from('tb_whatsapp_messages')
      .update({ is_read: true })
      .eq('phone_number', normalizedPhone)
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
