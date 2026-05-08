require('dotenv').config()

const axios = require('axios')

function digits(value) {
  return String(value || '').replace(/\D/g, '')
}

async function main() {
  const baseUrl = process.env.TEST_BACKEND_URL || 'http://127.0.0.1:3333'
  const businessNumber = digits(process.argv[2] || process.env.WHATSAPP_META_BUSINESS_NUMBER || '15558991881')
  const senderNumber = digits(process.argv[3] || process.env.WHATSAPP_META_TEST_SENDER || '5511999999999')
  const messageText = process.argv.slice(4).join(' ') || 'Teste local via webhook oficial da Meta'

  if (!businessNumber || !senderNumber) {
    throw new Error('Informe o número oficial da Meta e o número do remetente.')
  }

  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: businessNumber,
                phone_number_id: process.env.WHATSAPP_META_PHONE_NUMBER_ID || 'local-test-phone-number-id'
              },
              contacts: [
                {
                  wa_id: senderNumber,
                  profile: {
                    name: 'Teste Local Meta'
                  }
                }
              ],
              messages: [
                {
                  from: senderNumber,
                  id: `wamid.local.${Date.now()}`,
                  timestamp: `${Math.floor(Date.now() / 1000)}`,
                  type: 'text',
                  text: {
                    body: messageText
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  }

  const response = await axios.post(`${baseUrl}/whatsapp/webhook`, payload, {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 30000
  })

  console.log('Webhook local enviado com sucesso:')
  console.log(JSON.stringify(response.data, null, 2))
}

main().catch((error) => {
  console.error('Erro ao simular webhook da Meta:')
  console.error(error.response?.data || error.message)
  process.exit(1)
})
