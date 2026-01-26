/**
 * Script simples para obter QR Code - retorna apenas o base64
 * Uso: node scripts/get-qrcode-simple.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const axios = require('axios')

const apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8081'
const apiKey = process.env.EVOLUTION_API_KEY || 'dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA=='
const instanceName = '11943687794' // Número conhecido do erro

async function getQRCode() {
  try {
    console.log(`🔗 Buscando QR Code para: ${instanceName}\n`)

    // Tenta vários endpoints possíveis
    const endpoints = [
      `${apiUrl}/instance/connect/${instanceName}`,
      `${apiUrl}/instance/${instanceName}/connect`,
      `${apiUrl}/instance/${instanceName}/qrcode`,
      `${apiUrl}/instance/connect/${instanceName}?qrcode=true`
    ]

    let qrCode = null
    let lastError = null

    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Tentando: ${endpoint}`)
        const response = await axios.get(endpoint, {
          headers: {
            'apikey': apiKey
          },
          timeout: 10000
        })

        console.log(`✅ Resposta recebida (status: ${response.status})`)
        console.log(`📋 Dados:`, JSON.stringify(response.data, null, 2))
        console.log('')

        qrCode = response.data?.qrcode?.base64 || 
                 response.data?.base64 || 
                 response.data?.qrcode || 
                 response.data?.data?.qrcode?.base64 ||
                 response.data?.data?.base64 ||
                 null

        if (qrCode) {
          console.log(`✅ QR Code encontrado no endpoint: ${endpoint}\n`)
          break
        }
      } catch (err) {
        lastError = err
        console.log(`❌ Falhou: ${err.response?.status || err.message}\n`)
        continue
      }
    }

    if (qrCode) {
      console.log('═══════════════════════════════════════════════════════════════')
      console.log('📱                    QR CODE BASE64                          📱')
      console.log('═══════════════════════════════════════════════════════════════')
      console.log('')
      console.log(qrCode)
      console.log('')
      console.log('═══════════════════════════════════════════════════════════════')
    } else {
      console.log('❌ QR Code não encontrado em nenhum endpoint testado')
      if (lastError) {
        console.log('\n📋 Último erro:', lastError.response?.data || lastError.message)
      }
      console.log('\n💡 Tente:')
      console.log('   1. Verificar se a instância está desconectada')
      console.log('   2. Desconectar a instância primeiro via Evolution API')
      console.log('   3. Verificar logs da Evolution API')
      console.log('   4. A instância pode já estar conectada')
    }
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message)
    if (error.response) {
      console.log('\n📋 Resposta da API:', JSON.stringify(error.response.data, null, 2))
    }
  }
}

getQRCode()
