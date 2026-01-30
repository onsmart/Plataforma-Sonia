/**
 * Script para recriar instância com o mesmo nome
 * Deleta a instância antiga e cria uma nova com o mesmo nome
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const axios = require('axios')

const apiUrl = process.env.EVOLUTION_API_URL || 'http://192.168.15.31:8081'
const apiKey = process.env.EVOLUTION_API_KEY || 'dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA=='
const instanceName = process.argv[2]

if (!instanceName) {
  console.error('\n❌ Erro: Nome da instância é obrigatório!')
  console.log('\n📋 Uso:')
  console.log('   node scripts/recriar-instancia-mesmo-nome.js NOME_DA_INSTANCIA')
  console.log('\n💡 Exemplo:')
  console.log('   node scripts/recriar-instancia-mesmo-nome.js 11943687794')
  console.log('   node scripts/recriar-instancia-mesmo-nome.js sonia_whatsapp_02')
  process.exit(1)
}

const headers = {
  'apikey': apiKey,
  'Content-Type': 'application/json'
}

async function recriarInstancia() {
  console.log(`\n🔄 Recriando instância: ${instanceName}\n`)

  try {
    // 1. Verificar se a instância existe
    console.log('📋 1. Verificando se a instância existe...')
    const checkResponse = await axios.get(
      `${apiUrl}/instance/fetchInstances`,
      { headers: { 'apikey': apiKey }, timeout: 10000 }
    )

    const instances = checkResponse.data?.value || checkResponse.data || []
    const existingInstance = instances.find(
      (inst) => (inst.instance?.instanceName || inst.name || inst.instanceName) === instanceName
    )

    if (existingInstance) {
      console.log(`✅ Instância encontrada. Status: ${existingInstance.connectionStatus || existingInstance.instance?.state || 'unknown'}`)
      
      // 2. Deletar instância existente
      console.log('\n🗑️  2. Deletando instância existente...')
      try {
        await axios.delete(
          `${apiUrl}/instance/delete/${instanceName}`,
          { headers: { 'apikey': apiKey }, timeout: 10000 }
        )
        console.log('✅ Instância deletada com sucesso')
        
        // Aguardar para garantir que foi deletada completamente
        console.log('⏳ Aguardando 3 segundos para garantir que a instância foi deletada...')
        await new Promise(resolve => setTimeout(resolve, 3000))
      } catch (deleteError) {
        if (deleteError.response?.status === 404) {
          console.log('⚠️  Instância já não existe (pode ter sido deletada anteriormente)')
        } else {
          console.error('❌ Erro ao deletar:', deleteError.response?.data || deleteError.message)
          throw deleteError
        }
      }
    } else {
      console.log('ℹ️  Instância não existe, criando nova...')
    }

    // 3. Criar nova instância com o mesmo nome
    console.log(`\n🆕 3. Criando nova instância: ${instanceName}...`)
    const createResponse = await axios.post(
      `${apiUrl}/instance/create`,
      {
        instanceName: instanceName,
        token: apiKey,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        // Configurações otimizadas para versão do WhatsApp
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

    console.log('✅ Instância criada com sucesso!')
    console.log('📋 Detalhes:', JSON.stringify(createResponse.data, null, 2))

    // 4. Aguardar inicialização
    console.log('\n⏳ 4. Aguardando inicialização da instância (5 segundos)...')
    await new Promise(resolve => setTimeout(resolve, 5000))

    // 5. Tentar obter QR Code
    console.log('\n📱 5. Tentando obter QR Code...')
    let qrCode = null
    let tentativas = 0
    const maxTentativas = 5

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
          console.log('💡 Ou acesse a interface web: http://192.168.15.31:8081/manager')
          console.log('')
          console.log('═══════════════════════════════════════════════════════════════')
          break
        } else {
          console.log(`   ⏳ QR Code ainda não disponível, aguardando...`)
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
      } catch (qrError) {
        console.log(`   ⚠️  Erro ao buscar QR Code: ${qrError.message}`)
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }

    if (!qrCode) {
      console.log('\n⚠️  QR Code não foi gerado automaticamente')
      console.log('💡 Mas a instância foi criada com sucesso!')
      console.log('💡 Acesse a interface web para ver o QR Code:')
      console.log('   http://192.168.15.31:8081/manager')
      console.log('')
      console.log('📋 Ou tente obter o QR Code novamente:')
      console.log(`   GET http://192.168.15.31:8081/instance/connect/${instanceName}`)
    }

    console.log('\n✅ Processo concluído!')
    console.log(`📱 Instância "${instanceName}" recriada com sucesso\n`)

  } catch (error) {
    console.error('\n❌ Erro ao recriar instância:', error.response?.data || error.message)
    if (error.response?.data) {
      console.error('📋 Detalhes:', JSON.stringify(error.response.data, null, 2))
    }
    process.exit(1)
  }
}

recriarInstancia()
