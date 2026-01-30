/**
 * Script de Diagnóstico - Webhook WhatsApp
 * 
 * Verifica:
 * 1. Qual é o instanceName na Evolution API
 * 2. Qual é o phone_number no banco
 * 3. Se eles correspondem
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const axios = require('axios')
const { createClient } = require('@supabase/supabase-js')

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://192.168.15.31:8081'
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA=='
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY

async function diagnosticar() {
  console.log('🔍 DIAGNÓSTICO DO WEBHOOK WHATSAPP\n')
  console.log('=' .repeat(60))

  // 1. Buscar instâncias da Evolution API
  console.log('\n1️⃣ Buscando instâncias na Evolution API...')
  try {
    const response = await axios.get(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      headers: {
        'apikey': EVOLUTION_API_KEY
      },
      timeout: 10000
    })

    const instances = response.data || []
    console.log(`✅ Encontradas ${instances.length} instância(s):\n`)

    instances.forEach((inst, index) => {
      const instanceName = inst.instance?.instanceName || inst.instanceName || inst.name || 'N/A'
      const state = inst.instance?.state || inst.state || 'N/A'
      console.log(`   ${index + 1}. Nome: "${instanceName}" | Status: ${state}`)
    })

    if (instances.length === 0) {
      console.log('   ⚠️ Nenhuma instância encontrada!')
    }
  } catch (error) {
    console.log(`   ❌ Erro ao buscar instâncias: ${error.message}`)
  }

  // 2. Buscar integrações no banco
  console.log('\n2️⃣ Buscando integrações WhatsApp no banco...')
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('   ⚠️ Variáveis SUPABASE_URL ou SUPABASE_KEY não configuradas')
  } else {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
      const { data: integrations, error } = await supabase
        .from('tb_integrations')
        .select('id, phone_number, provider, created_at')
        .eq('provider', 'whatsapp')

      if (error) {
        console.log(`   ❌ Erro ao buscar integrações: ${error.message}`)
      } else {
        console.log(`✅ Encontradas ${integrations?.length || 0} integração(ões):\n`)
        
        if (integrations && integrations.length > 0) {
          integrations.forEach((integration, index) => {
            console.log(`   ${index + 1}. ID: ${integration.id}`)
            console.log(`      Phone Number: "${integration.phone_number || 'N/A'}"`)
            console.log(`      Criada em: ${integration.created_at || 'N/A'}\n`)
          })
        } else {
          console.log('   ⚠️ Nenhuma integração WhatsApp encontrada!')
        }
      }
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`)
    }
  }

  // 3. Comparar
  console.log('\n3️⃣ Comparação:\n')
  console.log('   ⚠️ IMPORTANTE: O "instanceName" da Evolution API deve ser IGUAL ao "phone_number" no banco!')
  console.log('   ⚠️ Se forem diferentes, o webhook não vai encontrar a integração e não vai salvar mensagens.\n')

  // 4. Verificar mensagens no banco
  console.log('4️⃣ Verificando mensagens salvas no banco...')
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('   ⚠️ Variáveis não configuradas')
  } else {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
      const { data: messages, error } = await supabase
        .from('tb_whatsapp_messages')
        .select('id, phone_number, message, direction, is_read, created_at')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.log(`   ❌ Erro: ${error.message}`)
      } else {
        console.log(`✅ Últimas ${messages?.length || 0} mensagem(ns) no banco:\n`)
        
        if (messages && messages.length > 0) {
          messages.forEach((msg, index) => {
            const date = new Date(msg.created_at).toLocaleString('pt-BR')
            console.log(`   ${index + 1}. [${date}] ${msg.direction === 'inbound' ? '📥' : '📤'} ${msg.phone_number}`)
            console.log(`      "${msg.message.substring(0, 50)}${msg.message.length > 50 ? '...' : ''}"`)
            console.log(`      Lida: ${msg.is_read ? '✅' : '❌'}\n`)
          })
        } else {
          console.log('   ⚠️ Nenhuma mensagem encontrada no banco!')
          console.log('   ⚠️ Isso significa que o webhook não está salvando mensagens.\n')
        }
      }
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`)
    }
  }

  // 5. Verificar webhook configurado
  console.log('5️⃣ Verificando configuração do webhook...')
  console.log(`   URL do webhook: ${process.env.WEBHOOK_GLOBAL_URL || 'NÃO CONFIGURADO'}`)
  console.log(`   Backend esperado: http://host.docker.internal:3333/whatsapp/webhook`)
  console.log(`   Ou: http://localhost:3333/whatsapp/webhook (se Evolution API estiver na mesma máquina)\n`)

  console.log('=' .repeat(60))
  console.log('\n💡 PRÓXIMOS PASSOS:')
  console.log('   1. Verifique se o instanceName da Evolution API é igual ao phone_number no banco')
  console.log('   2. Se forem diferentes, atualize o phone_number no banco para corresponder')
  console.log('   3. Verifique se o webhook está configurado no docker-compose.yml')
  console.log('   4. Reinicie o Evolution API após configurar o webhook')
  console.log('   5. Envie uma mensagem de teste e verifique os logs do backend\n')
}

diagnosticar().catch(console.error)
