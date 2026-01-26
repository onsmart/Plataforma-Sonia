/**
 * Script para obter QR Code do WhatsApp em base64
 * 
 * Uso: node scripts/get-whatsapp-qrcode.js <integration_id>
 * 
 * Exemplo: node scripts/get-whatsapp-qrcode.js f8ee004a-d979-4e4d-9619-14af6e53d4d3
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const axios = require('axios')

const integrationId = process.argv[2]

if (!integrationId) {
  console.error('❌ Erro: integration_id é obrigatório')
  console.log('\n📋 Uso:')
  console.log('   node scripts/get-whatsapp-qrcode.js <integration_id>')
  console.log('\n💡 Exemplo:')
  console.log('   node scripts/get-whatsapp-qrcode.js f8ee004a-d979-4e4d-9619-14af6e53d4d3')
  process.exit(1)
}

async function getQRCode() {
  try {
    const apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8081'
    const apiKey = process.env.EVOLUTION_API_KEY || 'dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA=='

    console.log('\n🔍 Buscando informações da integração...')
    console.log(`📋 Integration ID: ${integrationId}`)
    console.log(`🔗 Evolution API URL: ${apiUrl}\n`)

    // Busca o phone_number do banco usando Supabase
    const { createClient } = require('@supabase/supabase-js')
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY

    let phoneNumber = null
    if (supabaseUrl && supabaseKey) {
      try {
        console.log('🔍 Buscando phone_number do banco de dados...\n')
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { data, error } = await supabase
          .from('tb_integrations')
          .select('phone_number')
          .eq('id', integrationId)
          .single()

        if (!error && data && data.phone_number) {
          phoneNumber = data.phone_number
          console.log(`✅ Phone number encontrado: ${phoneNumber}\n`)
        } else {
          console.log('⚠️ Phone number não encontrado no banco. Tentando usar instâncias existentes...\n')
        }
      } catch (err) {
        console.log('⚠️ Erro ao buscar do banco:', err.message)
        console.log('   Continuando com busca direta...\n')
      }
    } else {
      console.log('⚠️ Variáveis do Supabase não configuradas. Tentando buscar instâncias existentes...\n')
    }

    // Tenta buscar instâncias existentes
    console.log('🔍 Verificando instâncias existentes...\n')
    
    try {
      const instancesResponse = await axios.get(
        `${apiUrl}/instance/fetchInstances`,
        {
          headers: {
            'apikey': apiKey
          },
          timeout: 10000
        }
      )

      const instances = instancesResponse.data || []
      console.log(`✅ Encontradas ${instances.length} instância(s)\n`)

      // Procura por instâncias que possam estar relacionadas
      let instanceName = phoneNumber // Prioriza o phone_number do banco
      
      // Se não tem phone_number, tenta encontrar nas instâncias
      if (!instanceName) {
        for (const inst of instances) {
          const instName = inst.instance?.instanceName || inst.instanceName || inst.name
          if (instName) {
            console.log(`   - Instância encontrada: ${instName} (Status: ${inst.instance?.state || inst.state || 'unknown'})`)
            
            // Se encontrou uma instância válida, usa ela
            if (!instanceName) {
              instanceName = instName
              console.log(`   ✅ Usando instância: ${instanceName}\n`)
              break
            }
          }
        }
      } else {
        console.log(`   ✅ Usando phone_number como instanceName: ${instanceName}\n`)
      }

      // Se ainda não tem, tenta usar o primeiro disponível
      if (!instanceName && instances.length > 0) {
        const firstInst = instances[0]
        instanceName = firstInst.instance?.instanceName || firstInst.instanceName || firstInst.name
        if (instanceName) {
          console.log(`   ⚠️ Usando primeira instância disponível: ${instanceName}\n`)
        }
      }

      // Se ainda não tem, usa o número conhecido do erro (11943687794)
      if (!instanceName) {
        instanceName = '11943687794' // Número conhecido do erro
        console.log(`   ⚠️ Usando número conhecido do erro: ${instanceName}\n`)
      }

      // Agora tenta obter o QR Code
      // Primeiro, tenta com o instanceName encontrado
      if (instanceName) {
        console.log(`📱 Buscando QR Code para instância: ${instanceName}\n`)
        
        try {
          // Tenta primeiro com GET /instance/connect/{instanceName}
          let qrResponse
          try {
            qrResponse = await axios.get(
              `${apiUrl}/instance/connect/${instanceName}`,
              {
                headers: {
                  'apikey': apiKey
                },
                timeout: 10000
              }
            )
          } catch (getError) {
            // Se GET falhar, tenta POST para forçar geração do QR Code
            console.log('   ⚠️ GET falhou, tentando POST para gerar QR Code...\n')
            qrResponse = await axios.post(
              `${apiUrl}/instance/connect/${instanceName}`,
              {},
              {
                headers: {
                  'apikey': apiKey,
                  'Content-Type': 'application/json'
                },
                timeout: 10000
              }
            )
          }

          const qrCode = qrResponse.data?.qrcode?.base64 || 
                        qrResponse.data?.base64 || 
                        qrResponse.data?.qrcode || 
                        qrResponse.data?.data?.qrcode?.base64 ||
                        qrResponse.data?.data?.base64 ||
                        null

          if (qrCode) {
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
            return
          } else {
            console.log('⚠️ QR Code não encontrado na resposta')
            console.log('📋 Resposta:', JSON.stringify(qrResponse.data, null, 2))
          }
        } catch (qrError) {
          console.error('❌ Erro ao buscar QR Code:', qrError.response?.data || qrError.message)
        }
      }

      // Se chegou aqui, tenta listar todas as instâncias e seus status
      console.log('\n📋 Todas as instâncias disponíveis:')
      instances.forEach((inst, index) => {
        const name = inst.instance?.instanceName || inst.instanceName
        const state = inst.instance?.state || 'unknown'
        console.log(`   ${index + 1}. ${name} - Status: ${state}`)
      })
      console.log('')

    } catch (error) {
      console.error('❌ Erro ao buscar instâncias:', error.response?.data || error.message)
      console.log('\n💡 Verifique se:')
      console.log('   1. A Evolution API está rodando em', apiUrl)
      console.log('   2. A API Key está correta no .env')
      console.log('   3. A Evolution API está acessível\n')
    }

  } catch (error) {
    console.error('❌ Erro:', error.message)
    if (error.response) {
      console.error('📋 Resposta da API:', error.response.data)
    }
  }
}

getQRCode()
