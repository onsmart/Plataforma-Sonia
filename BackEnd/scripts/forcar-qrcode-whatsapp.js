/**
 * Script para forçar geração de QR Code - deleta e recria instância
 * Resolve problemas de versão do WhatsApp Web
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const axios = require('axios')

const apiUrl = process.env.EVOLUTION_API_URL || 'http://192.168.15.31:8081'
const apiKey = process.env.EVOLUTION_API_KEY || 'dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA=='
const instanceName = process.argv[2] || '11943687794'

const headers = {
  'apikey': apiKey,
  'Content-Type': 'application/json'
}

async function forcarQRCode() {
  console.log(`\n🔧 Forçando geração de QR Code para: ${instanceName}\n`)

  try {
    // 1. Verificar se a instância existe
    console.log('📋 1. Verificando instância existente...')
    const checkResponse = await axios.get(
      `${apiUrl}/instance/fetchInstances`,
      { headers: { 'apikey': apiKey }, timeout: 10000 }
    )

    const instances = checkResponse.data || []
    const existingInstance = instances.find(
      (inst) => (inst.instance?.instanceName || inst.instanceName) === instanceName
    )

    if (existingInstance) {
      console.log(`✅ Instância encontrada. Status: ${existingInstance.instance?.state || 'unknown'}`)
      
      // 2. Deletar instância existente
      console.log('\n🗑️  2. Deletando instância existente...')
      try {
        await axios.delete(
          `${apiUrl}/instance/delete/${instanceName}`,
          { headers: { 'apikey': apiKey }, timeout: 10000 }
        )
        console.log('✅ Instância deletada com sucesso')
        // Aguardar um pouco para garantir que foi deletada
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (deleteError) {
        if (deleteError.response?.status === 404) {
          console.log('⚠️  Instância já não existe')
        } else {
          throw deleteError
        }
      }
    } else {
      console.log('ℹ️  Instância não existe, criando nova...')
    }

    // 3. Criar nova instância com configurações específicas
    console.log('\n🆕 3. Criando nova instância com configurações otimizadas...')
    const createResponse = await axios.post(
      `${apiUrl}/instance/create`,
      {
        instanceName: instanceName,
        token: apiKey,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        // Configurações específicas para versão do WhatsApp
        config: {
          session: {
            phone: {
              client: 'Chrome',
              name: 'Evolution API',
              version: '2.2413.51'
            }
          }
        }
      },
      { headers, timeout: 15000 }
    )

    console.log('✅ Instância criada:', JSON.stringify(createResponse.data, null, 2))

    // 4. Aguardar um pouco para a instância inicializar
    console.log('\n⏳ 4. Aguardando inicialização da instância...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // 5. Tentar obter QR Code várias vezes (pode demorar)
    console.log('\n📱 5. Tentando obter QR Code...')
    let qrCode = null
    let tentativas = 0
    const maxTentativas = 10

    while (!qrCode && tentativas < maxTentativas) {
      tentativas++
      console.log(`   Tentativa ${tentativas}/${maxTentativas}...`)

      try {
        const qrResponse = await axios.get(
          `${apiUrl}/instance/connect/${instanceName}`,
          { headers: { 'apikey': apiKey }, timeout: 10000 }
        )

        qrCode = qrResponse.data?.qrcode?.base64 || 
                 qrResponse.data?.base64 || 
                 qrResponse.data?.qrcode || 
                 null

        if (qrCode) {
          console.log('\n✅ QR CODE GERADO COM SUCESSO!\n')
          console.log('═══════════════════════════════════════════════════════════════')
          console.log('📱                    QR CODE DO WHATSAPP                     📱')
          console.log('═══════════════════════════════════════════════════════════════')
          console.log('')
          console.log('CÓDIGO BASE64:')
          console.log('───────────────────────────────────────────────────────────────')
          console.log(qrCode)
          console.log('───────────────────────────────────────────────────────────────')
          console.log('')
          console.log('💡 Converter em imagem: https://base64.guru/converter/decode/image')
          console.log('')
          console.log('═══════════════════════════════════════════════════════════════')
          break
        } else {
          console.log(`   ⏳ QR Code ainda não disponível, aguardando...`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      } catch (qrError) {
        console.log(`   ⚠️  Erro ao buscar QR Code: ${qrError.message}`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    if (!qrCode) {
      console.log('\n⚠️  QR Code não foi gerado após várias tentativas')
      console.log('💡 Tente acessar a interface web: http://192.168.15.31:8081/manager')
      console.log('💡 Ou verifique os logs: docker logs evolution-api')
    }

  } catch (error) {
    console.error('\n❌ Erro:', error.response?.data || error.message)
    if (error.response?.data) {
      console.error('📋 Detalhes:', JSON.stringify(error.response.data, null, 2))
    }
    process.exit(1)
  }
}

forcarQRCode()
