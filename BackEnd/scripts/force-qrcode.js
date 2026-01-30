/**
 * Script para forçar geração de QR Code
 * Desconecta a instância se necessário e gera novo QR Code
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const axios = require('axios')

const apiUrl = process.env.EVOLUTION_API_URL || 'http://192.168.15.31:8081'
const apiKey = process.env.EVOLUTION_API_KEY || 'dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA=='
const instanceName = '11943687794'

async function forceQRCode() {
  try {
    console.log(`🔍 Verificando status da instância: ${instanceName}\n`)

    // 1. Verifica status
    const instancesResponse = await axios.get(
      `${apiUrl}/instance/fetchInstances`,
      {
        headers: { 'apikey': apiKey },
        timeout: 10000
      }
    )

    const instances = instancesResponse.data || []
    console.log(`📋 Total de instâncias: ${instances.length}`)
    instances.forEach((inst, i) => {
      const name = inst.instance?.instanceName || inst.instanceName || inst.name || 'unknown'
      const state = inst.instance?.state || inst.state || 'unknown'
      console.log(`   ${i + 1}. ${name} - Status: ${state}`)
    })
    console.log('')

    const instance = instances.find(inst => {
      const name = inst.instance?.instanceName || inst.instanceName || inst.name
      return name === instanceName
    })

    if (instance) {
      const state = instance.instance?.state || instance.state || 'unknown'
      console.log(`📊 Status atual: ${state}\n`)

      // 2. Se status for "unknown" ou não conectada, deleta e recria
      if (state === 'unknown' || state === 'disconnected' || state !== 'connected') {
        console.log(`⚠️ Status é "${state}". Deletando instância para recriar...\n`)
        try {
          await axios.delete(
            `${apiUrl}/instance/delete/${instanceName}`,
            {
              headers: { 'apikey': apiKey },
              timeout: 10000
            }
          )
          console.log('✅ Instância deletada\n')
          // Aguarda um pouco
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          // Recria a instância
          console.log('🔄 Recriando instância com QR Code...\n')
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
          console.log('📋 Resposta:', JSON.stringify(createResponse.data, null, 2))
          console.log('')
          
          // Tenta obter QR Code da resposta de criação
          const qrCodeFromCreate = createResponse.data?.qrcode?.base64 || 
                                   createResponse.data?.base64 || 
                                   createResponse.data?.qrcode || 
                                   null
          
          if (qrCodeFromCreate) {
            console.log('═══════════════════════════════════════════════════════════════')
            console.log('📱                    QR CODE BASE64                          📱')
            console.log('═══════════════════════════════════════════════════════════════')
            console.log('')
            console.log(qrCodeFromCreate)
            console.log('')
            console.log('═══════════════════════════════════════════════════════════════')
            return
          }
          
          // Se não veio na criação, faz polling para buscar QR Code
          console.log('⏳ Fazendo polling para obter QR Code (pode levar alguns segundos)...\n')
          
          for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000))
            console.log(`   Tentativa ${i + 1}/10...`)
            
            try {
              const qrResponse = await axios.get(
                `${apiUrl}/instance/connect/${instanceName}`,
                {
                  headers: { 'apikey': apiKey },
                  timeout: 10000
                }
              )
              
              const qrCode = qrResponse.data?.qrcode?.base64 || 
                             qrResponse.data?.base64 || 
                             qrResponse.data?.qrcode || 
                             (qrResponse.data?.qrcode?.code && `data:image/png;base64,${qrResponse.data.qrcode.code}`) ||
                             null
              
              if (qrCode && qrCode !== '{"count":0}' && !qrCode.includes('count')) {
                console.log('\n✅ QR Code obtido!\n')
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
              // Continua tentando
            }
          }
          
          console.log('\n⚠️ QR Code não foi gerado após 20 segundos')
          console.log('💡 Tente verificar os logs da Evolution API ou aguarde mais tempo\n')
          
        } catch (delError) {
          console.log('⚠️ Erro ao deletar/recriar:', delError.response?.data || delError.message)
          console.log('   Tentando buscar QR Code mesmo assim...\n')
        }
      } else if (state === 'connected' || state === 'open') {
        console.log('⚠️ Instância está conectada. Desconectando...\n')
        try {
          await axios.delete(
            `${apiUrl}/instance/delete/${instanceName}`,
            {
              headers: { 'apikey': apiKey },
              timeout: 10000
            }
          )
          console.log('✅ Instância desconectada\n')
          await new Promise(resolve => setTimeout(resolve, 2000))
        } catch (delError) {
          console.log('⚠️ Erro ao desconectar:', delError.response?.data?.message || delError.message)
        }
      }

      // 3. Reconecta para gerar QR Code
      console.log('🔄 Reconectando para gerar QR Code...\n')
      try {
        const connectResponse = await axios.get(
          `${apiUrl}/instance/connect/${instanceName}`,
          {
            headers: { 'apikey': apiKey },
            timeout: 15000
          }
        )

        const qrCode = connectResponse.data?.qrcode?.base64 || 
                       connectResponse.data?.base64 || 
                       connectResponse.data?.qrcode || 
                       null

        if (qrCode) {
          console.log('═══════════════════════════════════════════════════════════════')
          console.log('📱                    QR CODE BASE64                          📱')
          console.log('═══════════════════════════════════════════════════════════════')
          console.log('')
          console.log(qrCode)
          console.log('')
          console.log('═══════════════════════════════════════════════════════════════')
          return
        } else {
          console.log('⚠️ QR Code não retornado. Resposta:', JSON.stringify(connectResponse.data, null, 2))
        }
      } catch (connectError) {
        console.error('❌ Erro ao conectar:', connectError.response?.data || connectError.message)
      }
    } else {
      console.log('⚠️ Instância não encontrada na lista, mas pode existir.')
      console.log('🔄 Tentando desconectar diretamente...\n')
      
      // Tenta desconectar mesmo sem encontrar na lista
      try {
        await axios.delete(
          `${apiUrl}/instance/delete/${instanceName}`,
          {
            headers: { 'apikey': apiKey },
            timeout: 10000
          }
        )
        console.log('✅ Instância deletada/desconectada\n')
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (delError) {
        console.log('⚠️ Erro ao deletar:', delError.response?.data?.message || delError.message)
        console.log('   Continuando para tentar gerar QR Code...\n')
      }

      // Tenta gerar QR Code mesmo assim
      console.log('🔄 Tentando gerar QR Code...\n')
      try {
        const connectResponse = await axios.get(
          `${apiUrl}/instance/connect/${instanceName}`,
          {
            headers: { 'apikey': apiKey },
            timeout: 15000
          }
        )

        console.log('📋 Resposta:', JSON.stringify(connectResponse.data, null, 2))
        console.log('')

        const qrCode = connectResponse.data?.qrcode?.base64 || 
                       connectResponse.data?.base64 || 
                       connectResponse.data?.qrcode || 
                       null

        if (qrCode) {
          console.log('═══════════════════════════════════════════════════════════════')
          console.log('📱                    QR CODE BASE64                          📱')
          console.log('═══════════════════════════════════════════════════════════════')
          console.log('')
          console.log(qrCode)
          console.log('')
          console.log('═══════════════════════════════════════════════════════════════')
        } else {
          console.log('❌ QR Code não encontrado na resposta')
          console.log('\n💡 A instância pode precisar ser recriada completamente.')
        }
      } catch (connectError) {
        console.error('❌ Erro ao conectar:', connectError.response?.data || connectError.message)
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message)
  }
}

forceQRCode()
