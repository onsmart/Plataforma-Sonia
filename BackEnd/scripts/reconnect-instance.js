/**
 * Script para forçar reconexão de instância que está "close"
 * Deleta e recria a instância para gerar novo QR Code
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const axios = require('axios')

const apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8081'
const apiKey = process.env.EVOLUTION_API_KEY || 'dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA=='
const instanceName = process.argv[2] || 'sonia-plataform'

async function reconnectInstance() {
  try {
    console.log(`🔄 Reconectando instância: ${instanceName}\n`)

    // 1. Deleta a instância existente
    console.log('1️⃣ Deletando instância existente...')
    try {
      await axios.delete(
        `${apiUrl}/instance/delete/${instanceName}`,
        {
          headers: { 'apikey': apiKey },
          timeout: 10000
        }
      )
      console.log('✅ Instância deletada\n')
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (delError) {
      if (delError.response?.status === 404) {
        console.log('⚠️ Instância não existe (pode já ter sido deletada)\n')
      } else {
        console.log('⚠️ Erro ao deletar:', delError.response?.data?.message || delError.message)
        console.log('   Continuando mesmo assim...\n')
      }
    }

    // 2. Recria a instância
    console.log('2️⃣ Recriando instância com QR Code...')
    const createResponse = await axios.post(
      `${apiUrl}/instance/create`,
      {
        instanceName: instanceName,
        token: apiKey,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      },
      {
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    )

    console.log('✅ Instância recriada')
    console.log(`📊 Status: ${createResponse.data?.instance?.status || 'unknown'}\n`)

    // 3. Faz polling para obter QR Code
    console.log('3️⃣ Aguardando geração do QR Code (fazendo polling)...\n')
    
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      console.log(`   Tentativa ${i + 1}/15...`)
      
      try {
        const qrResponse = await axios.get(
          `${apiUrl}/instance/connect/${instanceName}`,
          {
            headers: { 'apikey': apiKey },
            timeout: 10000
          }
        )
        
        // Verifica diferentes formatos de resposta
        let qrCode = null
        
        // Tenta diferentes caminhos na resposta
        if (qrResponse.data?.qrcode?.base64) {
          qrCode = qrResponse.data.qrcode.base64
        } else if (qrResponse.data?.base64) {
          qrCode = qrResponse.data.base64
        } else if (qrResponse.data?.qrcode?.code) {
          qrCode = `data:image/png;base64,${qrResponse.data.qrcode.code}`
        } else if (qrResponse.data?.qrcode && typeof qrResponse.data.qrcode === 'string') {
          qrCode = qrResponse.data.qrcode
        }
        
        // Verifica se não é apenas um objeto vazio ou count: 0
        if (qrCode && 
            qrCode !== '{"count":0}' && 
            !qrCode.includes('"count":0') &&
            qrCode.length > 50) {
          console.log('\n✅ QR Code obtido!\n')
          console.log('═══════════════════════════════════════════════════════════════')
          console.log('📱                    QR CODE BASE64                          📱')
          console.log('═══════════════════════════════════════════════════════════════')
          console.log('')
          console.log(qrCode)
          console.log('')
          console.log('═══════════════════════════════════════════════════════════════')
          console.log('')
          console.log('📋 INSTRUÇÕES:')
          console.log('   1. Converta o base64 acima em imagem:')
          console.log('      https://base64.guru/converter/decode/image')
          console.log('   2. Abra o WhatsApp no celular')
          console.log('   3. Vá em Configurações > Aparelhos conectados > Conectar um aparelho')
          console.log('   4. Escaneie o QR Code')
          console.log('')
          return
        }
      } catch (err) {
        // Continua tentando
      }
    }
    
    console.log('\n⚠️ QR Code não foi gerado após 30 segundos')
    console.log('💡 Tente:')
    console.log('   1. Verificar logs da Evolution API: docker logs -f evolution-api')
    console.log('   2. Acessar interface web: http://localhost:8081/manager')
    console.log('   3. Verificar se Redis está conectado corretamente\n')

  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message)
    if (error.response) {
      console.log('\n📋 Resposta da API:', JSON.stringify(error.response.data, null, 2))
    }
  }
}

reconnectInstance()
