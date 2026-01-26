/**
 * Script final para obter QR Code - tenta múltiplos métodos
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const axios = require('axios')

const apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8081'
const apiKey = process.env.EVOLUTION_API_KEY || 'dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA=='
const instanceName = process.argv[2] || 'sonia_whatsapp_02'

async function getQRCodeFinal() {
  console.log(`\n🔍 Buscando QR Code para: ${instanceName}\n`)

  // Método 1: Endpoint /instance/connect/{instanceName}
  console.log('📱 Método 1: /instance/connect/{instanceName}')
  try {
    const response1 = await axios.get(
      `${apiUrl}/instance/connect/${instanceName}`,
      {
        headers: { 'apikey': apiKey },
        timeout: 15000
      }
    )
    
    console.log('✅ Resposta recebida')
    console.log('📋 Dados:', JSON.stringify(response1.data, null, 2))
    
    let qrCode = response1.data?.qrcode?.base64 || 
                 response1.data?.base64 || 
                 response1.data?.qrcode ||
                 (response1.data?.qrcode?.code && `data:image/png;base64,${response1.data.qrcode.code}`) ||
                 null
    
    if (qrCode && qrCode.length > 50 && !qrCode.includes('count')) {
      console.log('\n✅ QR CODE ENCONTRADO!\n')
      console.log('═══════════════════════════════════════════════════════════════')
      console.log('📱                    QR CODE BASE64                          📱')
      console.log('═══════════════════════════════════════════════════════════════')
      console.log('')
      console.log(qrCode)
      console.log('')
      console.log('═══════════════════════════════════════════════════════════════')
      return
    }
  } catch (err) {
    console.log(`❌ Erro: ${err.response?.status || err.message}\n`)
  }

  // Método 2: Endpoint /instance/qrcode/{instanceName}
  console.log('📱 Método 2: /instance/qrcode/{instanceName}')
  try {
    const response2 = await axios.get(
      `${apiUrl}/instance/qrcode/${instanceName}`,
      {
        headers: { 'apikey': apiKey },
        timeout: 15000
      }
    )
    
    console.log('✅ Resposta recebida')
    console.log('📋 Dados:', JSON.stringify(response2.data, null, 2))
    
    let qrCode = response2.data?.qrcode?.base64 || 
                 response2.data?.base64 || 
                 response2.data?.qrcode ||
                 null
    
    if (qrCode && qrCode.length > 50 && !qrCode.includes('count')) {
      console.log('\n✅ QR CODE ENCONTRADO!\n')
      console.log('═══════════════════════════════════════════════════════════════')
      console.log('📱                    QR CODE BASE64                          📱')
      console.log('═══════════════════════════════════════════════════════════════')
      console.log('')
      console.log(qrCode)
      console.log('')
      console.log('═══════════════════════════════════════════════════════════════')
      return
    }
  } catch (err) {
    console.log(`❌ Erro: ${err.response?.status || err.message}\n`)
  }

  // Método 3: Verificar status e tentar forçar reconexão
  console.log('📱 Método 3: Verificando status da instância...')
  try {
    const statusResponse = await axios.get(
      `${apiUrl}/instance/fetchInstances`,
      {
        headers: { 'apikey': apiKey },
        timeout: 10000
      }
    )
    
    const instances = statusResponse.data || []
    const instance = instances.find(inst => {
      const name = inst.instance?.instanceName || inst.instanceName || inst.name
      return name === instanceName
    })
    
    if (instance) {
      const state = instance.instance?.state || instance.state || 'unknown'
      console.log(`📊 Status da instância: ${state}`)
      
      if (state === 'close' || state === 'disconnected') {
        console.log('\n⚠️ Instância está desconectada. O QR Code só é gerado quando está "connecting".')
        console.log('💡 Tente deletar e recriar a instância.\n')
      }
    }
  } catch (err) {
    console.log(`❌ Erro: ${err.message}\n`)
  }

  console.log('\n❌ QR Code não foi encontrado em nenhum método.')
  console.log('\n💡 SOLUÇÕES:')
  console.log('   1. Acesse a interface web: http://localhost:8081/manager')
  console.log('   2. Verifique os logs: docker logs -f evolution-api')
  console.log('   3. Tente deletar e recriar a instância')
  console.log('   4. Verifique se a instância está com status "connecting"\n')
}

getQRCodeFinal()
