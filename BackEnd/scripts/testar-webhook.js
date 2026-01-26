/**
 * Script para testar se o webhook está funcionando
 * 
 * Este script:
 * 1. Testa se o endpoint do webhook está acessível
 * 2. Envia uma mensagem de teste para o webhook
 * 3. Verifica se foi salva no banco
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const axios = require('axios')
const { createClient } = require('@supabase/supabase-js')

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3333'
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY

async function testarWebhook() {
  console.log('🧪 TESTE DO WEBHOOK WHATSAPP\n')
  console.log('='.repeat(60))

  // 1. Testar se o endpoint está acessível
  console.log('\n1️⃣ Testando se o endpoint está acessível...')
  try {
    const response = await axios.get(`${BACKEND_URL}/whatsapp/webhook`, {
      timeout: 5000,
      validateStatus: () => true // Aceita qualquer status
    })
    console.log(`✅ Endpoint acessível (status: ${response.status})`)
    console.log(`   URL: ${BACKEND_URL}/whatsapp/webhook`)
  } catch (error) {
    console.log(`❌ Endpoint NÃO está acessível: ${error.message}`)
    console.log(`   Verifique se o backend está rodando em ${BACKEND_URL}`)
    return
  }

  // 2. Buscar integração no banco para pegar o instanceName
  console.log('\n2️⃣ Buscando integração WhatsApp no banco...')
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('⚠️ Variáveis SUPABASE_URL ou SUPABASE_KEY não configuradas')
    console.log('   Usando instanceName padrão: 11943687794')
    var instanceName = '11943687794'
  } else {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
      const { data: integration, error } = await supabase
        .from('tb_integrations')
        .select('id, phone_number, provider')
        .eq('provider', 'whatsapp')
        .single()

      if (error || !integration) {
        console.log('⚠️ Integração não encontrada, usando instanceName padrão')
        var instanceName = '11943687794'
      } else {
        var instanceName = integration.phone_number || '11943687794'
        console.log(`✅ Integração encontrada:`)
        console.log(`   ID: ${integration.id}`)
        console.log(`   Phone Number: ${integration.phone_number}`)
        console.log(`   InstanceName (usado no teste): ${instanceName}`)
      }
    } catch (error) {
      console.log(`⚠️ Erro ao buscar integração: ${error.message}`)
      console.log('   Usando instanceName padrão: 11943687794')
      var instanceName = '11943687794'
    }
  }

  // 3. Enviar mensagem de teste para o webhook
  console.log('\n3️⃣ Enviando mensagem de teste para o webhook...')
  const testMessage = {
    event: 'messages.upsert',
    instance: instanceName,
    data: {
      key: {
        remoteJid: '5511999999999@s.whatsapp.net',
        id: `test-${Date.now()}`
      },
      message: {
        conversation: 'Mensagem de teste do webhook - ' + new Date().toISOString()
      }
    }
  }

  try {
    const webhookResponse = await axios.post(
      `${BACKEND_URL}/whatsapp/webhook`,
      testMessage,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    )

    console.log('✅ Webhook respondeu:', {
      status: webhookResponse.status,
      data: webhookResponse.data
    })
  } catch (error) {
    console.log('❌ Erro ao enviar para webhook:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    })
    return
  }

  // 4. Verificar se foi salva no banco
  console.log('\n4️⃣ Verificando se a mensagem foi salva no banco...')
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('⚠️ Variáveis não configuradas, não é possível verificar no banco')
  } else {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
      
      // Aguarda 2 segundos para dar tempo de salvar
      await new Promise(resolve => setTimeout(resolve, 2000))

      const { data: messages, error } = await supabase
        .from('tb_whatsapp_messages')
        .select('*')
        .eq('phone_number', '5511999999999')
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {
        console.log(`❌ Erro ao buscar mensagens: ${error.message}`)
      } else {
        const testMessageFound = messages?.find(msg => 
          msg.message.includes('Mensagem de teste do webhook')
        )

        if (testMessageFound) {
          console.log('✅ Mensagem de teste encontrada no banco!')
          console.log(`   ID: ${testMessageFound.id}`)
          console.log(`   Mensagem: ${testMessageFound.message}`)
          console.log(`   Criada em: ${testMessageFound.created_at}`)
        } else {
          console.log('⚠️ Mensagem de teste NÃO encontrada no banco')
          console.log(`   Total de mensagens do número: ${messages?.length || 0}`)
          if (messages && messages.length > 0) {
            console.log('   Últimas mensagens:')
            messages.forEach((msg, i) => {
              console.log(`   ${i + 1}. [${msg.created_at}] ${msg.message.substring(0, 50)}...`)
            })
          }
        }
      }
    } catch (error) {
      console.log(`❌ Erro ao verificar no banco: ${error.message}`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n💡 PRÓXIMOS PASSOS:')
  console.log('   1. Verifique os logs do backend para ver se o webhook foi processado')
  console.log('   2. Se a mensagem não foi salva, verifique:')
  console.log('      - Se o instanceName corresponde ao phone_number no banco')
  console.log('      - Se há erros nos logs do backend')
  console.log('      - Se o webhook está configurado no docker-compose.yml')
  console.log('   3. Envie uma mensagem real para o WhatsApp e verifique os logs\n')
}

testarWebhook().catch(console.error)
