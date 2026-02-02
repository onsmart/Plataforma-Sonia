import { chatText } from '../llm/openai'
import { getAgentsByEmail } from './index'
import { getAgentFromCache } from './getagentfromcache'
import { sendEmail } from '../integrations/email/email.service'
import { readEmailsWithAgent } from './readEmailsWithAgent'
import { markMessagesAsRead, sendWhatsApp } from '../integrations/whatsapp/whatsapp.service'
import { 
  getHistoryFromRedis, 
  getUnreadConversations,
  saveMessageToHistory,
  ConversationMessage
} from '../integrations/whatsapp/whatsapp.redis'

// Função auxiliar para extrair texto de mensagem, removendo JSON aninhado
function extractMessageText(msg: any): string {
  // Se for string, tenta fazer parse
  if (typeof msg === 'string') {
    // Se começar com {, tenta fazer parse
    if (msg.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(msg)
        // Se tiver campo message, extrai recursivamente
        if (parsed.message) {
          return extractMessageText(parsed.message)
        }
        // Se for um objeto send_whatsapp completo, extrai o message
        if (parsed.action === 'send_whatsapp' && parsed.message) {
          return extractMessageText(parsed.message)
        }
        // Se não tiver campo message válido, retorna string vazia (evita enviar JSON)
        return ''
      } catch (e) {
        // Não é JSON válido, retorna a string original
        return msg
      }
    }
    return msg
  }
  // Se for objeto, procura campo message
  if (typeof msg === 'object' && msg !== null) {
    if (msg.message && typeof msg.message === 'string') {
      return extractMessageText(msg.message)
    }
    if (msg.action === 'send_whatsapp' && msg.message) {
      return extractMessageText(msg.message)
    }
    // Se for objeto sem campo message válido, retorna string vazia
    return ''
  }
  // Se não conseguir extrair, converte para string
  return String(msg)
}

const DEFAULT_MESSAGE = 'Olá! Como posso te ajudar hoje? 😊'

export async function chatWithAgent(
  email: string,
  agentId: string,
  message?: string,
  context?: Record<string, any> // Contexto para substituição de templates
) {
  // 1️⃣ Carrega agentes do usuário
  const agents = await getAgentsByEmail(email)
  const agent = getAgentFromCache(agents, agentId)

  // Busca credenciais da integração para logs
  let creds: any = null
  if (agent.integrations_id) {
    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase
      .from('tb_integrations')
      .select('email, provider')
      .eq('id', agent.integrations_id)
      .single()
    creds = data
  }

  // 2️⃣ Mensagem vazia
  if (!message || message.trim() === '') {
    return DEFAULT_MESSAGE
  }

  // Contexto para armazenar emails lidos durante a conversa
  let lastEmails: any[] = []

  // 3️⃣ Primeira chamada ao LLM
  console.log('[chatWithAgent] 📤 Enviando mensagem para o agente:', {
    agentId,
    agentName: agent.nome,
    messageLength: message?.length || 0,
    messagePreview: message?.substring(0, 200) || '',
    hasContext: !!context,
    contextKeys: context ? Object.keys(context) : []
  })
  
  let llmResponse = await chatText({
    system: agent.system_instructions,
    user: message,
    model: agent.provider_model,
    temperature: agent.temperature,
    maxTokens: agent.max_tokens,
    apiKey: agent.api_key,
  })

  console.log('🧠 Resposta bruta do agente (primeira chamada):', llmResponse)

  // 4️⃣ Limpa a resposta (remove markdown code blocks se houver)
  let cleanedResponse = llmResponse.trim()
  
  // Remove blocos de código markdown (```json ... ``` ou ``` ... ```)
  cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*\n?/i, '') // Remove início
  cleanedResponse = cleanedResponse.replace(/\n?```\s*$/i, '') // Remove fim
  cleanedResponse = cleanedResponse.trim()

  // 4️⃣ Parse do JSON
  let parsed: any = null
  let isPlainText = false
  try {
    parsed = JSON.parse(cleanedResponse)
    console.log('✅ JSON parseado:', parsed)
    
    // Validação imediata: Se o parsed.message contiver JSON completo, extrai apenas o texto
    if (parsed.message && typeof parsed.message === 'string' && parsed.message.trim().startsWith('{')) {
      try {
        const nestedJson = JSON.parse(parsed.message)
        if (nestedJson.message && typeof nestedJson.message === 'string') {
          parsed.message = nestedJson.message
          console.log('[chatWithAgent] ✅ Extraído message de JSON aninhado no parse inicial')
        } else if (nestedJson.action === 'send_whatsapp' && nestedJson.message) {
          parsed.message = nestedJson.message
          console.log('[chatWithAgent] ✅ Extraído message de send_whatsapp aninhado no parse inicial')
        }
      } catch (e) {
        // Não é JSON válido, mantém como está
      }
    }
  } catch (err) {
    // Se não for JSON válido, trata como texto simples
    console.log('📝 Resposta não é JSON, tratando como texto simples')
    isPlainText = true
    parsed = {
      action: null,
      message: cleanedResponse
    }
  }

  // 5️⃣ Ação: ler emails
  if (parsed.action === 'read_emails') {
    try {
      const emails = await readEmailsWithAgent(
        email,
        agentId,
        parsed.provider || 'outlook',
        parsed.limit || 5
      )

      if (!emails || emails.length === 0) {
        return '📭 Nenhum email encontrado na caixa de entrada.'
      }

      // Armazena os emails no contexto
      lastEmails = emails

      // Formata emails para exibição
      const emailsFormatted = emails.map((email, index) => {
        const date = email.receivedAt 
          ? new Date(email.receivedAt).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : 'Data não disponível'

        return `\n${index + 1}. 📧 ${email.subject || '(Sem assunto)'}\n   De: ${email.from || 'Remetente desconhecido'}\n   Data: ${date}\n   ${email.preview ? `Preview: ${email.preview.substring(0, 100)}${email.preview.length > 100 ? '...' : ''}` : ''}`
      }).join('\n\n')

      // Se a mensagem original pediu para ler E responder, continua o fluxo
      const messageLower = message.toLowerCase()
      const shouldReply = messageLower.includes('responda') || 
                         messageLower.includes('responder') || 
                         messageLower.includes('reply') ||
                         parsed.action === 'read_and_reply'

      if (shouldReply && lastEmails.length > 0) {
        // Prepara contexto do último email para o LLM gerar resposta
        const lastEmail = lastEmails[0]
        const contextForReply = `
Emails carregados com sucesso. Agora você precisa responder ao último email:

De: ${lastEmail.from || 'Remetente desconhecido'}
Assunto: ${lastEmail.subject || '(Sem assunto)'}
Conteúdo: ${lastEmail.preview || 'Sem preview disponível'}
Data: ${lastEmail.receivedAt ? new Date(lastEmail.receivedAt).toLocaleString('pt-BR') : 'Data não disponível'}

Por favor, gere uma resposta apropriada para este email.
`

        // Segunda chamada ao LLM para gerar a resposta
        llmResponse = await chatText({
          system: agent.system_instructions,
          user: contextForReply,
          model: agent.provider_model,
          temperature: agent.temperature,
          maxTokens: agent.max_tokens,
          apiKey: agent.api_key,
        })

        console.log('🧠 Resposta bruta do agente (segunda chamada para resposta):', llmResponse)

        // Limpa a resposta (remove markdown code blocks se houver)
        let cleanedResponse2 = llmResponse.trim()
        cleanedResponse2 = cleanedResponse2.replace(/^```(?:json)?\s*\n?/i, '')
        cleanedResponse2 = cleanedResponse2.replace(/\n?```\s*$/i, '')
        cleanedResponse2 = cleanedResponse2.trim()

        try {
          parsed = JSON.parse(cleanedResponse2)
          console.log('✅ JSON parseado (resposta):', parsed)
        } catch (err) {
          console.warn('⚠️ Resposta não é JSON válido na segunda chamada')
          // Retorna apenas a lista de emails se não conseguir gerar resposta
          return `📬 Encontrei ${emails.length} email(s) na sua caixa de entrada:\n${emailsFormatted}\n\n⚠️ Não foi possível gerar uma resposta automática.`
        }

        // Se a segunda resposta for send_email ou reply (com dados de envio), envia
        const shouldSendEmail = parsed.action === 'send_email' || 
                               (parsed.action === 'reply' && (parsed.to || parsed.body))
        
        if (shouldSendEmail) {
          try {
            // Função para substituir templates {{variavel}} usando o contexto
            const replaceTemplates = (text: string): string => {
              if (!text || typeof text !== 'string' || !context) return text
              return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                let value = context[key]
                if (value === undefined) {
                  for (const [contextKey, contextValue] of Object.entries(context)) {
                    if (typeof contextValue === 'object' && contextValue !== null && !Array.isArray(contextValue)) {
                      if (contextValue[key] !== undefined) {
                        value = contextValue[key]
                        break
                      }
                    }
                  }
                }
                return value !== undefined ? String(value) : match
              })
            }

            let emailTo = parsed.to || lastEmail.from
            let emailSubject = parsed.subject || `Re: ${lastEmail.subject || 'Sem assunto'}`
            let emailBody = parsed.body || parsed.message || 'Resposta gerada automaticamente.'

            // Substitui templates se houver contexto
            if (context) {
              emailTo = replaceTemplates(emailTo)
              emailSubject = replaceTemplates(emailSubject)
              emailBody = replaceTemplates(emailBody)
            }

            console.log('[chatWithAgent] 📧 Preparando para enviar email:', {
              from: creds?.email || 'desconhecido',
              to: emailTo,
              subject: emailSubject,
              bodyLength: emailBody.length,
              integrationsId: agent.integrations_id
            })

            await sendEmail(agent.integrations_id, {
              to: emailTo,
              subject: emailSubject,
              text: emailBody,
              visual_style: parsed.visual_style,
            })

            console.log('[chatWithAgent] ✅ Email enviado com sucesso!', {
              from: creds?.email || 'desconhecido',
              to: emailTo,
              subject: emailSubject
            })

            return `✅ Email lido e respondido com sucesso!\n\n📧 De: ${creds?.email || 'você'}\n📧 Para: ${emailTo}\n📋 Assunto: ${emailSubject}\n\n📬 Lista de emails:\n${emailsFormatted}`
          } catch (err: any) {
            console.error('[chatWithAgent] ❌ Erro ao enviar resposta:', err)
            return `📬 Encontrei ${emails.length} email(s) na sua caixa de entrada:\n${emailsFormatted}\n\n❌ Erro ao enviar resposta: ${err.message || 'Erro desconhecido'}`
          }
        } else {
          console.warn('[chatWithAgent] ⚠️ Agente não retornou ação de envio. Ação:', parsed.action)
        }
      }

      // Se não pediu para responder, apenas retorna a lista
      return `📬 Encontrei ${emails.length} email(s) na sua caixa de entrada:\n${emailsFormatted}`
    } catch (err: any) {
      console.error('❌ Erro ao ler emails:', err)
      return `❌ Erro ao ler emails: ${err.message || 'Erro desconhecido'}`
    }
  }

  // 6️⃣ Ação: enviar email (resposta direta)
  if (parsed.action === 'send_email') {
    try {
      // Função para substituir templates {{variavel}} usando o contexto
      const replaceTemplates = (text: string): string => {
        if (!text || typeof text !== 'string' || !context) return text
        return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
          // Busca a chave no contexto (pode estar em vários níveis)
          let value = context[key]
          
          // Se não encontrar direto, busca em objetos aninhados
          if (value === undefined) {
            for (const [contextKey, contextValue] of Object.entries(context)) {
              if (typeof contextValue === 'object' && contextValue !== null && !Array.isArray(contextValue)) {
                if (contextValue[key] !== undefined) {
                  value = contextValue[key]
                  break
                }
              }
            }
          }
          
          return value !== undefined ? String(value) : match // Se não encontrar, mantém o template
        })
      }

      // Se não tem lastEmails, tenta usar os dados do parsed
      let toEmail = parsed.to || (lastEmails[0]?.from)
      let subject = parsed.subject || (lastEmails[0] ? `Re: ${lastEmails[0].subject}` : 'Sem assunto')
      let body = parsed.body || parsed.message || 'Resposta gerada automaticamente.'

      // Substitui templates se houver contexto
      if (context) {
        console.log('[chatWithAgent] Contexto disponível para substituição:', {
          contextKeys: Object.keys(context),
          contextData: context
        })
        console.log('[chatWithAgent] Antes da substituição:', { toEmail, subject, body: body.substring(0, 100) })
        
        toEmail = replaceTemplates(toEmail)
        subject = replaceTemplates(subject)
        body = replaceTemplates(body)
        
        console.log('[chatWithAgent] Templates substituídos:', { toEmail, subject, body: body.substring(0, 100) })
      } else {
        console.warn('[chatWithAgent] ⚠️ Nenhum contexto fornecido para substituição de templates')
      }

      if (!toEmail) {
        return '❌ Não foi possível determinar o destinatário do email.'
      }

      await sendEmail(agent.integrations_id, {
        to: toEmail,
        subject: subject,
        text: body,
        visual_style: parsed.visual_style,
      })

      return `📧 Email enviado com sucesso para: ${toEmail}`
    } catch (err: any) {
      console.error('❌ Erro ao enviar email:', err)
      return `❌ Não foi possível enviar o email: ${err.message || 'Erro desconhecido'}`
    }
  }

  // 6️⃣ Ação: ler mensagens do WhatsApp (do Redis)
  if (parsed.action === 'read_whatsapp' || parsed.action === 'read_whatsapp_messages') {
    try {
      if (!agent.integrations_id) {
        return '❌ Agente não possui integração WhatsApp configurada.'
      }

      // Busca todas as conversas não lidas do Redis
      const unreadNumbers = await getUnreadConversations(agent.integrations_id)

      if (!unreadNumbers || unreadNumbers.length === 0) {
        return '📭 Nenhuma mensagem não lida encontrada no WhatsApp.'
      }

      // Busca histórico de cada conversa não lida
      const messagesByPhone: Record<string, ConversationMessage[]> = {}
      for (const phoneNumber of unreadNumbers) {
        const history = await getHistoryFromRedis(agent.integrations_id, phoneNumber)
        if (history.length > 0 && history[history.length - 1].role === 'user') {
          messagesByPhone[phoneNumber] = history
        }
      }

      // Formata mensagens para exibição
      const totalUnread = Object.values(messagesByPhone).reduce((sum, msgs) => {
        return sum + msgs.filter(m => m.role === 'user').length
      }, 0)

      let formattedMessages = `📱 Encontrei ${totalUnread} mensagem(ns) não lida(s) de ${Object.keys(messagesByPhone).length} contato(s):\n\n`
      
      for (const [phoneNumber, messages] of Object.entries(messagesByPhone)) {
        const unreadCount = messages.filter(m => m.role === 'user').length
        formattedMessages += `📞 ${phoneNumber} (${unreadCount} mensagem${unreadCount > 1 ? 'ns' : ''}):\n`
        
        // Mostra apenas mensagens não lidas (últimas do usuário)
        const unreadMsgs = messages.filter(m => m.role === 'user')
        unreadMsgs.forEach((msg, index) => {
          const date = new Date(msg.timestamp).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
          formattedMessages += `  ${index + 1}. [${date}] ${msg.content}\n`
        })
        formattedMessages += '\n'
      }

      formattedMessages += '\n💡 Use a ação send_whatsapp para responder às mensagens.'

      // Marca mensagens como lidas
      for (const phoneNumber of Object.keys(messagesByPhone)) {
        await markMessagesAsRead(phoneNumber, agent.integrations_id)
      }

      return formattedMessages
    } catch (err: any) {
      console.error('❌ Erro ao ler mensagens do WhatsApp:', err)
      return `❌ Não foi possível ler as mensagens: ${err.message || 'Erro desconhecido'}`
    }
  }

  // 6️⃣ Ação: ler mensagens do WhatsApp (do BANCO DE DADOS)
  if (parsed.action === 'read_whatsapp_db' || parsed.action === 'read_whatsapp_database') {
    try {
      if (!agent.integrations_id) {
        return JSON.stringify({
          action: 'read_whatsapp_db',
          messages: [],
          error: 'Agente não possui integração WhatsApp configurada'
        })
      }

      // Busca todas as mensagens não lidas do banco
      const { getAllUnreadMessages, getWhatsAppHistory } = await import('../integrations/whatsapp/whatsapp.service')
      const unreadMessages = await getAllUnreadMessages(agent.integrations_id)

      if (!unreadMessages || unreadMessages.length === 0) {
        return JSON.stringify({
          action: 'read_whatsapp_db',
          messages: []
        })
      }

      // Agrupa mensagens por contato (whatsapp_contact_id)
      const messagesByContact: Record<string, any[]> = {}
      
      for (const msg of unreadMessages) {
        const contactId = (msg as any).whatsapp_contact_id || 'unknown'
        if (!messagesByContact[contactId]) {
          messagesByContact[contactId] = []
        }
        messagesByContact[contactId].push(msg)
      }

      // Para cada contato, busca histórico completo
      const formattedMessages: any[] = []
      
      for (const [contactId, messages] of Object.entries(messagesByContact)) {
        // Pega a mensagem mais recente não lida
        const latestMessage = (messages as any[])[messages.length - 1]
        
        // Busca histórico completo (últimas 20 mensagens) usando contactId
        const history = await getWhatsAppHistory(
          contactId,
          agent.integrations_id,
          20
        )
        
        // Formata histórico
        const formattedHistory = history.map(msg => ({
          role: msg.direction === 'inbound' ? 'user' : 'assistant',
          content: msg.message,
          timestamp: msg.created_at
        }))
        
        // Busca o contato para obter o número
        const { supabase } = await import('../../lib/supabase')
        const { data: contact } = await supabase
          .from('tb_whatsapp_contacts')
          .select('id, lid, phone_number, status')
          .eq('id', contactId)
          .maybeSingle()
        
        // Prioriza número real, senão usa LID
        let phoneNumberForDisplay = contactId
        if (contact) {
          if (contact.phone_number && contact.status === 'active') {
            phoneNumberForDisplay = `${contact.phone_number}@s.whatsapp.net`
          } else if (contact.lid) {
            phoneNumberForDisplay = contact.lid.endsWith('@lid') ? contact.lid : `${contact.lid}@lid`
          }
        }
        
        formattedMessages.push({
          whatsapp_contact_id: contactId,
          phone_number: phoneNumberForDisplay,
          message: latestMessage.message,
          message_id: latestMessage.message_id || latestMessage.id,
          created_at: latestMessage.created_at,
          history: formattedHistory
        })
      }

      return JSON.stringify({
        action: 'read_whatsapp_db',
        messages: formattedMessages
      })
    } catch (error: any) {
      console.error('❌ Erro ao ler mensagens do banco:', error)
      return JSON.stringify({
        action: 'read_whatsapp_db',
        messages: [],
        error: error.message
      })
    }
  }

  // 7️⃣ Ação: enviar WhatsApp
  if (parsed.action === 'send_whatsapp' || parsed.action === 'whatsapp') {
    try {
      // Função para substituir templates {{variavel}} usando o contexto
      const replaceTemplates = (text: string): string => {
        if (!text || typeof text !== 'string' || !context) return text
        return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
          let value = context[key]
          if (value === undefined) {
            for (const [contextKey, contextValue] of Object.entries(context)) {
              if (typeof contextValue === 'object' && contextValue !== null && !Array.isArray(contextValue)) {
                if (contextValue[key] !== undefined) {
                  value = contextValue[key]
                  break
                }
              }
            }
          }
          return value !== undefined ? String(value) : match
        })
      }

      let phoneNumber = parsed.to || parsed.phone || parsed.phone_number || ''
      let message = parsed.message || parsed.body || ''

      // Validação robusta: Extrai apenas o texto, mesmo se vier JSON completo
      message = extractMessageText(message)
      
      console.log('[chatWithAgent] 📝 Mensagem extraída após validação:', {
        originalLength: (parsed.message || parsed.body || '').length,
        extractedLength: message.length,
        preview: message.substring(0, 100)
      })

      // Garante que message é uma string válida e não contém JSON
      if (typeof message !== 'string') {
        message = String(message)
      }
      
      // Última validação: se ainda contiver JSON, remove
      if (message.trim().startsWith('{') && message.trim().endsWith('}')) {
        try {
          const finalParse = JSON.parse(message)
          if (finalParse.message && typeof finalParse.message === 'string') {
            message = finalParse.message
            console.log('[chatWithAgent] ✅ Extraído texto do JSON (validação final)')
          } else if (finalParse.action === 'send_whatsapp' && finalParse.message) {
            message = finalParse.message
            console.log('[chatWithAgent] ✅ Extraído texto do send_whatsapp (validação final)')
          } else {
            // Se não tiver campo message, usa JSON stringificado (não ideal, mas melhor que nada)
            message = JSON.stringify(finalParse)
            console.warn('[chatWithAgent] ⚠️ JSON sem campo message, usando stringificado')
          }
        } catch (e) {
          // Não é JSON válido, mantém como está
        }
      }

      // Substitui templates se houver contexto
      if (context) {
        console.log('[chatWithAgent] Contexto disponível para substituição WhatsApp:', {
          contextKeys: Object.keys(context),
          contextData: context
        })
        phoneNumber = replaceTemplates(phoneNumber)
        message = replaceTemplates(message)
        console.log('[chatWithAgent] Templates substituídos WhatsApp:', { phoneNumber, message: message.substring(0, 100) })
      }

      console.log('[chatWithAgent] 🔍 Buscando número do contato para envio:', {
        phoneNumberDoParsed: phoneNumber,
        contextWhatsappContactId: context?.whatsapp_contact_id,
        contextPhoneNumber: context?.phone_number,
        contextFrom: context?.from,
        contextTo: context?.to
      })

      // PRIORIDADE 1: Se tiver whatsapp_contact_id no contexto (UUID do contato), usa ele
      if (context?.whatsapp_contact_id) {
        try {
          const { supabase } = await import('../../lib/supabase')
          const { data: contact, error } = await supabase
            .from('tb_whatsapp_contacts')
            .select('id, lid, phone_number, status')
            .eq('id', context.whatsapp_contact_id)
            .maybeSingle()
          
          if (contact && !error) {
            // Prioriza número real, senão usa LID
            if (contact.phone_number && contact.status === 'active') {
              phoneNumber = `${contact.phone_number}@s.whatsapp.net`
              console.log('[chatWithAgent] ✅ Número obtido do whatsapp_contact_id (número real):', {
                contactId: contact.id,
                phoneNumber
              })
            } else if (contact.lid) {
              phoneNumber = contact.lid.endsWith('@lid') ? contact.lid : `${contact.lid}@lid`
              console.log('[chatWithAgent] ✅ Número obtido do whatsapp_contact_id (LID):', {
                contactId: contact.id,
                phoneNumber
              })
            } else {
              phoneNumber = contact.id // Usa UUID do contato
              console.log('[chatWithAgent] ✅ Usando UUID do contato:', {
                contactId: contact.id,
                phoneNumber
              })
            }
          } else {
            console.warn('[chatWithAgent] ⚠️ whatsapp_contact_id não encontrado no banco:', {
              whatsapp_contact_id: context.whatsapp_contact_id,
              error: error?.message
            })
          }
        } catch (err: any) {
          console.error('[chatWithAgent] ❌ Erro ao buscar contato pelo whatsapp_contact_id:', err)
        }
      }

      // PRIORIDADE 2: Se não tiver whatsapp_contact_id, mas tiver número no contexto, VALIDA no banco
      if (!phoneNumber && context) {
        const contextNumber = context.phone_number || context.from || context.to || ''
        if (contextNumber) {
          console.log('[chatWithAgent] 🔍 Validando número do contexto no banco:', contextNumber)
          
          // Tenta buscar contato pelo número no banco
          try {
            const { getContactByPhoneNumber, getContactByLid } = await import('../integrations/whatsapp/whatsapp.contacts')
            
            // Remove sufixos para normalizar
            const normalizedNumber = contextNumber.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '').trim()
            
            // Tenta buscar pelo número
            const contactResult = await getContactByPhoneNumber(normalizedNumber)
            
            if (contactResult.success && contactResult.contact) {
              // Contato encontrado no banco, usa número real ou LID
              if (contactResult.contact.phone_number && contactResult.contact.status === 'active') {
                phoneNumber = `${contactResult.contact.phone_number}@s.whatsapp.net`
                console.log('[chatWithAgent] ✅ Número do contexto validado no banco (número real):', phoneNumber)
              } else if (contactResult.contact.lid) {
                phoneNumber = contactResult.contact.lid.endsWith('@lid') ? contactResult.contact.lid : `${contactResult.contact.lid}@lid`
                console.log('[chatWithAgent] ✅ Número do contexto validado no banco (LID):', phoneNumber)
              } else {
                phoneNumber = contactResult.contact.id // Usa UUID
                console.log('[chatWithAgent] ✅ Usando UUID do contato encontrado:', phoneNumber)
              }
            } else if (contextNumber.endsWith('@lid')) {
              // Se for LID, tenta buscar pelo LID
              const lidResult = await getContactByLid(contextNumber)
              if (lidResult.success && lidResult.contact) {
                if (lidResult.contact.phone_number && lidResult.contact.status === 'active') {
                  phoneNumber = `${lidResult.contact.phone_number}@s.whatsapp.net`
                  console.log('[chatWithAgent] ✅ LID do contexto validado no banco (número real):', phoneNumber)
                } else {
                  phoneNumber = contextNumber // Usa o LID original
                  console.log('[chatWithAgent] ✅ Usando LID do contexto:', phoneNumber)
                }
              } else {
                console.warn('[chatWithAgent] ⚠️ Número do contexto não encontrado no banco:', contextNumber)
              }
            } else {
              console.warn('[chatWithAgent] ⚠️ Número do contexto não encontrado no banco (não é LID nem número válido):', normalizedNumber)
            }
          } catch (err: any) {
            console.error('[chatWithAgent] ❌ Erro ao validar número do contexto:', err)
          }
        }
      }

      // PRIORIDADE 3: Se ainda não tiver número, busca a última mensagem não lida do banco
      if (!phoneNumber && agent.integrations_id) {
        console.log('[chatWithAgent] 🔍 Buscando última mensagem não lida do banco...')
        try {
          const { getAllUnreadMessages } = await import('../integrations/whatsapp/whatsapp.service')
          const { supabase } = await import('../../lib/supabase')
          
          const unreadMessages = await getAllUnreadMessages(agent.integrations_id, agentId)
          
          if (unreadMessages.length > 0) {
            // Pega a primeira mensagem (mais recente)
            const lastMessage = unreadMessages[0]
            
            // Busca o contato da mensagem
            const contactId = (lastMessage as any).whatsapp_contact_id
            if (contactId) {
              const { data: contact } = await supabase
                .from('tb_whatsapp_contacts')
                .select('id, lid, phone_number, status')
                .eq('id', contactId)
                .maybeSingle()
              
              if (contact) {
                // Prioriza número real, senão usa LID
                if (contact.phone_number && contact.status === 'active') {
                  phoneNumber = `${contact.phone_number}@s.whatsapp.net`
                } else if (contact.lid) {
                  phoneNumber = contact.lid.endsWith('@lid') ? contact.lid : `${contact.lid}@lid`
                } else {
                  phoneNumber = contact.id // Usa UUID do contato
                }
                
                console.log('[chatWithAgent] ✅ Número obtido da última mensagem não lida:', {
                  phoneNumber,
                  contactId: contact.id,
                  hasPhoneNumber: !!contact.phone_number,
                  status: contact.status
                })
              }
            }
          } else {
            console.warn('[chatWithAgent] ⚠️ Nenhuma mensagem não lida encontrada no banco')
          }
        } catch (error: any) {
          console.error('[chatWithAgent] ❌ Erro ao buscar última mensagem não lida:', error)
        }
      }

      if (!phoneNumber || phoneNumber.trim() === '') {
        console.error('[chatWithAgent] ❌ Número não encontrado em nenhum lugar:', {
          parsed: { to: parsed.to, phone: parsed.phone, phone_number: parsed.phone_number },
          context: {
            whatsapp_contact_id: context?.whatsapp_contact_id,
            phone_number: context?.phone_number,
            from: context?.from,
            to: context?.to
          }
        })
        return '❌ Não foi possível determinar o número de telefone do destinatário. Verifique se há mensagens não lidas ou forneça o whatsapp_contact_id (UUID do contato) no contexto.'
      }

      // Usa o ID da conversa diretamente (sem normalizar/converter)
      // O ID pode ser número ou ID completo com @lid, @s.whatsapp.net, etc.
      const conversationId = phoneNumber

      console.log('[chatWithAgent] 📱 ID da conversa para envio:', conversationId)

      if (!message) {
        return '❌ Mensagem vazia. Não é possível enviar WhatsApp sem conteúdo.'
      }

      if (!agent.integrations_id) {
        return '❌ Agente não possui integração WhatsApp configurada.'
      }

      // Busca histórico do Redis antes de enviar (para contexto da IA)
      console.log('[chatWithAgent] 📚 Buscando histórico do Redis para contexto...')
      const history = await getHistoryFromRedis(
        agent.integrations_id,
        conversationId, // Usa ID da conversa completo
        10 // últimas 10 mensagens
      )
      
      if (history.length > 0) {
        console.log(`[chatWithAgent] ✅ Histórico encontrado no Redis: ${history.length} mensagens`)
        
        // Se tem histórico, passa para a IA gerar resposta com contexto
        const historyContext = history.map(msg => {
          return `${msg.role}: ${msg.content}`
        }).join('\n')
        
        const contextualMessage = `Histórico da conversa:\n${historyContext}\n\nNova mensagem do usuário: ${message}\n\nGere uma resposta considerando o contexto acima.`
        
        // Chama a IA novamente com contexto
        console.log('[chatWithAgent] 🤖 Gerando resposta com contexto do histórico...')
        const contextualResponse = await chatText({
          system: agent.system_instructions + '\n\nVocê está em uma conversa via WhatsApp. Use o histórico da conversa para dar respostas mais contextuais e naturais.',
          user: contextualMessage,
          model: agent.provider_model,
          temperature: agent.temperature,
          maxTokens: agent.max_tokens,
          apiKey: agent.api_key,
        })
        
        // Usa a resposta contextualizada e extrai apenas o texto (remove JSON se houver)
        message = extractMessageText(contextualResponse.trim())
        console.log('[chatWithAgent] ✅ Resposta gerada com contexto')
      } else {
        console.log('[chatWithAgent] ℹ️ Nenhum histórico encontrado no Redis, enviando mensagem original')
      }

      const result = await sendWhatsApp(agent.integrations_id, {
        to: conversationId, // Usa ID da conversa completo
        message: message,
        agentId: agentId
      })

      if (result.success) {
        // Salva resposta no Redis como "assistant"
        await saveMessageToHistory(
          agent.integrations_id,
          conversationId, // Usa ID da conversa completo
          'assistant',
          message
        )
        
        // Se foi para fila (queued), retorna mensagem informativa
        if (result.queued) {
          return `✅ Resposta gerada e salva na fila. Será enviada automaticamente quando o número real estiver disponível.`
        }
        
        return `📱 WhatsApp enviado com sucesso para: ${conversationId}`
      } else {
        // Se falhou, mas não é erro crítico, continua o fluxo
        let errorMsg = `❌ Erro ao enviar WhatsApp: ${result.error || 'Erro desconhecido'}`
        
        // Se tiver QR code, adiciona informação destacada E inclui o base64 na mensagem
        if (result.qrCode) {
          // Garante que o QR code tenha o prefixo data:image/png;base64, se não tiver
          let qrCodeBase64 = result.qrCode
          if (!qrCodeBase64.startsWith('data:image')) {
            qrCodeBase64 = `data:image/png;base64,${qrCodeBase64}`
          }
          
          // Inclui o QR code base64 diretamente na mensagem para ser detectado pelo frontend
          errorMsg += '\n\n' +
            '═══════════════════════════════════════════════════════════════\n' +
            '📱                    QR CODE GERADO!                          📱\n' +
            '═══════════════════════════════════════════════════════════════\n' +
            '\n' +
            'CÓDIGO BASE64 DO QR CODE:\n' +
            '───────────────────────────────────────────────────────────────\n' +
            qrCodeBase64 + '\n' +
            '───────────────────────────────────────────────────────────────\n' +
            '\n' +
            '✅ Escaneie o QR Code acima com o WhatsApp para conectar.\n' +
            '📋 O QR Code também foi exibido no terminal/console do backend.\n' +
            '\n' +
            '💡 INSTRUÇÕES:\n' +
            '   1. Escaneie o QR Code exibido acima\n' +
            '   2. Ou olhe o terminal/console do backend\n' +
            '   3. Ou acesse: GET /whatsapp/qrcode?integration_id=' + agent.integrations_id + '\n' +
            '═══════════════════════════════════════════════════════════════'
        } else {
          errorMsg += '\n\n💡 DICA: Tente acessar GET /whatsapp/qrcode?integration_id=' + agent.integrations_id + ' para obter o QR Code.'
        }
        
        return errorMsg
      }
    } catch (err: any) {
      console.error('❌ Erro ao enviar WhatsApp:', err)
      return `❌ Não foi possível enviar o WhatsApp: ${err.message || 'Erro desconhecido'}`
    }
  }

  // 8️⃣ Ação: reply (mensagem simples)
  if (parsed.action === 'reply') {
    const replyMessage = parsed.message || 'Resposta gerada.'
    
    // REMOVIDO: Envio automático via WhatsApp quando é "reply"
    // Agora o agente deve usar explicitamente "send_whatsapp" para enviar
    
    return replyMessage
  }

  // 9️⃣ Ação: ler dados do CRM
  if (parsed.action === 'read_crm' || parsed.action === 'get_crm_data') {
    try {
      if (!agent.crm_integration_id) {
        return JSON.stringify({
          action: 'read_crm',
          data: [],
          error: 'Agente não possui integração CRM configurada. Configure um CRM na tela de Integrações.'
        })
      }

      const entityType = parsed.entity_type || parsed.entity || 'contacts' // contacts, deals, companies
      const limit = parsed.limit || parsed.count || 10
      const properties = parsed.properties || undefined // Array de propriedades específicas

      // Busca a integração CRM para saber qual CRM usar
      const { supabase } = await import('../../lib/supabase')
      const { data: crmIntegration, error: crmError } = await supabase
        .from('tb_crm_integrations')
        .select(`
          id,
          tb_crms (
            id,
            slug,
            name
          )
        `)
        .eq('id', agent.crm_integration_id)
        .eq('is_active', true)
        .single()

      if (crmError || !crmIntegration) {
        return JSON.stringify({
          action: 'read_crm',
          data: [],
          error: 'Integração CRM não encontrada ou inativa'
        })
      }

      const crm = (crmIntegration as any).tb_crms
      const crmSlug = crm?.slug

      if (!crmSlug) {
        return JSON.stringify({
          action: 'read_crm',
          data: [],
          error: 'Tipo de CRM não identificado'
        })
      }

      // Importa serviços de CRM baseado no slug
      let data: any[] = []

      if (crmSlug === 'hubspot') {
        const { getHubSpotContacts, getHubSpotDeals } = await import('../integrations/crm/hubspot.service')
        
        if (entityType === 'contacts' || entityType === 'contact') {
          data = await getHubSpotContacts(agent.crm_integration_id, limit, properties)
        } else if (entityType === 'deals' || entityType === 'deal') {
          data = await getHubSpotDeals(agent.crm_integration_id, limit, properties)
        } else {
          return JSON.stringify({
            action: 'read_crm',
            data: [],
            error: `Tipo de entidade não suportado: ${entityType}. Use 'contacts' ou 'deals'.`
          })
        }
      } else {
        return JSON.stringify({
          action: 'read_crm',
          data: [],
          error: `CRM '${crmSlug}' ainda não está implementado. CRMs suportados: hubspot`
        })
      }

      return JSON.stringify({
        action: 'read_crm',
        entity_type: entityType,
        crm: crmSlug,
        count: data.length,
        data: data
      })
    } catch (error: any) {
      console.error('❌ Erro ao ler dados do CRM:', error)
      return JSON.stringify({
        action: 'read_crm',
        data: [],
        error: error.message || 'Erro ao acessar CRM'
      })
    }
  }

  // 🔟 Ação: criar contato no CRM
  if (parsed.action === 'create_crm_contact' || parsed.action === 'create_crm_lead') {
    try {
      if (!agent.crm_integration_id) {
        return JSON.stringify({
          action: 'create_crm_contact',
          success: false,
          error: 'Agente não possui integração CRM configurada'
        })
      }

      const contactData = parsed.data || parsed.contact || {
        firstname: parsed.firstname || parsed.first_name,
        lastname: parsed.lastname || parsed.last_name,
        email: parsed.email,
        phone: parsed.phone || parsed.phone_number,
        company: parsed.company
      }

      // Busca o tipo de CRM
      const { supabase } = await import('../../lib/supabase')
      const { data: crmIntegration } = await supabase
        .from('tb_crm_integrations')
        .select(`
          id,
          tb_crms (
            slug
          )
        `)
        .eq('id', agent.crm_integration_id)
        .eq('is_active', true)
        .single()

      const crm = (crmIntegration as any)?.tb_crms
      const crmSlug = crm?.slug

      if (crmSlug === 'hubspot') {
        const { createHubSpotContact } = await import('../integrations/crm/hubspot.service')
        const result = await createHubSpotContact(agent.crm_integration_id, contactData)
        
        return JSON.stringify({
          action: 'create_crm_contact',
          success: true,
          crm: 'hubspot',
          contact: result
        })
      } else {
        return JSON.stringify({
          action: 'create_crm_contact',
          success: false,
          error: `CRM '${crmSlug}' ainda não está implementado para criação de contatos`
        })
      }
    } catch (error: any) {
      console.error('❌ Erro ao criar contato no CRM:', error)
      return JSON.stringify({
        action: 'create_crm_contact',
        success: false,
        error: error.message || 'Erro ao criar contato no CRM'
      })
    }
  }

  // 1️⃣1️⃣ Ação: atualizar contato no CRM
  if (parsed.action === 'update_crm_contact' || parsed.action === 'update_crm_lead') {
    try {
      if (!agent.crm_integration_id) {
        return JSON.stringify({
          action: 'update_crm_contact',
          success: false,
          error: 'Agente não possui integração CRM configurada'
        })
      }

      const contactId = parsed.contact_id || parsed.id
      if (!contactId) {
        return JSON.stringify({
          action: 'update_crm_contact',
          success: false,
          error: 'ID do contato é obrigatório'
        })
      }

      const contactData = parsed.data || parsed.contact || {
        ...(parsed.firstname || parsed.first_name ? { firstname: parsed.firstname || parsed.first_name } : {}),
        ...(parsed.lastname || parsed.last_name ? { lastname: parsed.lastname || parsed.last_name } : {}),
        ...(parsed.email ? { email: parsed.email } : {}),
        ...(parsed.phone || parsed.phone_number ? { phone: parsed.phone || parsed.phone_number } : {}),
        ...(parsed.company ? { company: parsed.company } : {})
      }

      // Busca o tipo de CRM
      const { supabase } = await import('../../lib/supabase')
      const { data: crmIntegration } = await supabase
        .from('tb_crm_integrations')
        .select(`
          id,
          tb_crms (
            slug
          )
        `)
        .eq('id', agent.crm_integration_id)
        .eq('is_active', true)
        .single()

      const crm = (crmIntegration as any)?.tb_crms
      const crmSlug = crm?.slug

      if (crmSlug === 'hubspot') {
        const { updateHubSpotContact } = await import('../integrations/crm/hubspot.service')
        const result = await updateHubSpotContact(agent.crm_integration_id, contactId, contactData)
        
        return JSON.stringify({
          action: 'update_crm_contact',
          success: true,
          crm: 'hubspot',
          contact: result
        })
      } else {
        return JSON.stringify({
          action: 'update_crm_contact',
          success: false,
          error: `CRM '${crmSlug}' ainda não está implementado para atualização de contatos`
        })
      }
    } catch (error: any) {
      console.error('❌ Erro ao atualizar contato no CRM:', error)
      return JSON.stringify({
        action: 'update_crm_contact',
        success: false,
        error: error.message || 'Erro ao atualizar contato no CRM'
      })
    }
  }

  // 8.5️⃣ Se for texto simples (não JSON) ou JSON sem action mas com contexto de WhatsApp
  if (isPlainText || (!parsed.action && typeof parsed === 'object' && parsed !== null && parsed.message)) {
    // Verifica se há contexto de WhatsApp (vem do webhook)
    if (context && (context.phone_number || context.from || context.to)) {
      console.log('[chatWithAgent] 📱 Texto simples detectado com contexto WhatsApp, enviando automaticamente...')
      
      try {
        // Extrai número do contexto - DEVE vir do banco de dados
        // Prioriza whatsapp_contact_id (UUID do contato no banco)
        let phoneNumber = context.whatsapp_contact_id || context.phone_number || context.from || context.to || ''
        
        console.log('[chatWithAgent] 🔍 Buscando número do contato:', {
          whatsapp_contact_id: context.whatsapp_contact_id,
          phone_number: context.phone_number,
          from: context.from,
          to: context.to,
          phoneNumberEncontrado: phoneNumber
        })
        
        // Se não tiver número no contexto, tenta buscar da última mensagem não lida
        if (!phoneNumber) {
          console.log('[chatWithAgent] ⚠️ Número não encontrado no contexto, buscando última mensagem não lida...')
          try {
            const { getAllUnreadMessages } = await import('../integrations/whatsapp/whatsapp.service')
            const unreadMessages = await getAllUnreadMessages(agent.integrations_id, agentId)
            
            if (unreadMessages && unreadMessages.length > 0) {
              const lastMessage = unreadMessages[0] // Já vem ordenado (mais recente primeiro)
              const contactId = lastMessage.whatsapp_contact_id
              
              if (contactId) {
                // Busca contato no banco para pegar número real ou LID
                const { getContactByLid, getContactByPhoneNumber } = await import('../integrations/whatsapp/whatsapp.contacts')
                
                // Tenta buscar pelo ID (UUID)
                const { supabase } = await import('../../lib/supabase')
                const { data: contact, error } = await supabase
                  .from('tb_whatsapp_contacts')
                  .select('id, lid, phone_number, status')
                  .eq('id', contactId)
                  .maybeSingle()
                
                if (contact && !error) {
                  // Prioriza número real, senão usa LID
                  if (contact.phone_number && contact.status === 'active') {
                    phoneNumber = `${contact.phone_number}@s.whatsapp.net`
                  } else if (contact.lid) {
                    phoneNumber = contact.lid.endsWith('@lid') ? contact.lid : `${contact.lid}@lid`
                  } else {
                    phoneNumber = contact.id // Usa UUID do contato
                  }
                  
                  console.log('[chatWithAgent] ✅ Número obtido da última mensagem não lida:', {
                    contactId,
                    phoneNumber,
                    hasPhoneNumber: !!contact.phone_number,
                    status: contact.status
                  })
                } else {
                  console.error('[chatWithAgent] ❌ Contato não encontrado no banco:', {
                    contactId,
                    error: error?.message
                  })
                }
              }
            }
          } catch (err: any) {
            console.error('[chatWithAgent] ❌ Erro ao buscar última mensagem não lida:', err)
          }
        }
        
        // Se ainda não tiver número, tenta extrair do parsed (última tentativa)
        if (!phoneNumber && parsed.phone_number) {
          phoneNumber = parsed.phone_number
          console.log('[chatWithAgent] ⚠️ Usando número do parsed (última tentativa):', phoneNumber)
        }
        
        if (!phoneNumber || phoneNumber.trim() === '') {
          console.error('[chatWithAgent] ❌ Número não encontrado em nenhum lugar:', {
            context,
            parsed: parsed.phone_number
          })
          return '❌ Não foi possível determinar o número de telefone do destinatário. Verifique se o contato existe no banco de dados.'
        }
        
        // Extrai mensagem
        let messageToSend = parsed.message || cleanedResponse || ''
        
        // Extrai o texto da mensagem (remove qualquer JSON)
        messageToSend = extractMessageText(messageToSend)
        
        console.log('[chatWithAgent] 📝 Mensagem extraída (texto simples):', {
          originalLength: (parsed.message || cleanedResponse || '').length,
          extractedLength: messageToSend.length,
          preview: messageToSend.substring(0, 100)
        })
        
        // Garante que messageToSend é uma string válida
        if (typeof messageToSend !== 'string') {
          messageToSend = String(messageToSend)
        }
        
        // Última validação: se ainda contiver JSON, remove
        if (messageToSend.trim().startsWith('{') && messageToSend.trim().endsWith('}')) {
          try {
            const finalParse = JSON.parse(messageToSend)
            if (finalParse.message && typeof finalParse.message === 'string') {
              messageToSend = finalParse.message
              console.log('[chatWithAgent] ✅ Extraído texto do JSON (validação final - texto simples)')
            } else if (finalParse.action === 'send_whatsapp' && finalParse.message) {
              messageToSend = finalParse.message
              console.log('[chatWithAgent] ✅ Extraído texto do send_whatsapp (validação final - texto simples)')
            }
          } catch (e) {
            // Não é JSON válido, mantém como está
          }
        }
        
        if (!messageToSend || messageToSend.trim() === '') {
          return '❌ Mensagem vazia. Não é possível enviar WhatsApp sem conteúdo.'
        }
        
        if (!agent.integrations_id) {
          return '❌ Agente não possui integração WhatsApp configurada.'
        }
        
        // Usa ID da conversa diretamente (sem normalizar)
        const conversationId = phoneNumber
        
        console.log('[chatWithAgent] 📱 Enviando mensagem simples via WhatsApp:', {
          conversationId,
          messageLength: messageToSend.length
        })
        
        // Envia via WhatsApp
        const result = await sendWhatsApp(agent.integrations_id, {
          to: conversationId, // Usa ID da conversa completo
          message: messageToSend,
          agentId: agentId
        })
        
        if (result.success) {
          await saveMessageToHistory(
            agent.integrations_id,
            conversationId, // Usa ID da conversa completo
            'assistant',
            messageToSend
          )
          return `📱 Mensagem enviada com sucesso para: ${conversationId}`
        } else {
          return `❌ Erro ao enviar WhatsApp: ${result.error || 'Erro desconhecido'}`
        }
      } catch (error: any) {
        console.error('[chatWithAgent] ❌ Erro ao processar texto simples:', error)
        return `❌ Erro ao processar mensagem: ${error?.message || 'Erro desconhecido'}`
      }
    }
  }

  // 9️⃣ Se não tem action mas tem dados (usado em flows para passar dados entre nodes)
  // MAS: Se a mensagem do usuário pediu uma ação específica, tenta detectar e executar
  if (!parsed.action && typeof parsed === 'object' && parsed !== null) {
    console.log('[chatWithAgent] JSON sem action detectado:', parsed)
    
    // Detecta se a mensagem do usuário pediu uma ação específica
    const messageLower = message.toLowerCase()
    
    // Detecta pedido de WhatsApp
    if (messageLower.includes('whatsapp') || messageLower.includes('send_whatsapp') || messageLower.includes('enviar whatsapp')) {
      console.log('[chatWithAgent] 🔄 Detectado pedido de WhatsApp na mensagem, mas agente retornou dados sem action. Tentando extrair dados da mensagem...')
      
      // Tenta extrair número e mensagem da mensagem original
      // Procura por padrões como: "numero "11999431006"", "número 11999431006", "para 11999431006"
      const phonePatterns = [
        /(?:numero|número|para|to|phone)[\s:"]*(\d{10,15})/i,
        /"(\d{10,15})"/,
        /(\d{10,15})/
      ]
      
      let phoneNumber = ''
      for (const pattern of phonePatterns) {
        const match = message.match(pattern)
        if (match && match[1]) {
          phoneNumber = match[1]
          break
        }
      }
      
      // Procura por mensagem entre aspas ou após "mensagem de"
      const messagePatterns = [
        /mensagem[\s:]*["']([^"']+)["']/i,
        /com[\s]+a[\s]+mensagem[\s]+de[\s]+["']([^"']+)["']/i,
        /["']([^"']+)["']/
      ]
      
      let whatsappMessage = ''
      for (const pattern of messagePatterns) {
        const match = message.match(pattern)
        if (match && match[1]) {
          whatsappMessage = match[1]
          break
        }
      }
      
      // Se não encontrou mensagem, tenta pegar texto após "mensagem de"
      if (!whatsappMessage) {
        const afterMessage = message.split(/mensagem[\s]+de/i)[1]
        if (afterMessage) {
          whatsappMessage = afterMessage.trim().replace(/^["']|["']$/g, '')
        }
      }
      
      console.log('[chatWithAgent] 📱 Dados extraídos da mensagem:', { phoneNumber, whatsappMessage })
      
      if (phoneNumber && whatsappMessage) {
        if (!agent.integrations_id) {
          return '❌ Agente não possui integração WhatsApp configurada.'
        }
        
        try {
          const result = await sendWhatsApp(agent.integrations_id, {
            to: phoneNumber,
            message: whatsappMessage
          })
          
          if (result.success) {
            return `📱 WhatsApp enviado com sucesso para: ${phoneNumber}`
          } else {
            let errorMsg = `❌ Erro ao enviar WhatsApp: ${result.error || 'Erro desconhecido'}`
            if (result.qrCode) {
              errorMsg += '\n\n📱 QR Code gerado! Verifique o terminal/console para escanear.'
            }
            return errorMsg
          }
        } catch (err: any) {
          console.error('❌ Erro ao enviar WhatsApp:', err)
          return `❌ Não foi possível enviar o WhatsApp: ${err.message || 'Erro desconhecido'}`
        }
      } else {
        console.warn('[chatWithAgent] ⚠️ Não foi possível extrair número ou mensagem da solicitação:', { phoneNumber, whatsappMessage })
      }
    }
    
    // Se não detectou ação específica, retorna como dados para flow
    console.log('[chatWithAgent] JSON sem action detectado (provavelmente dados para flow):', parsed)
    return JSON.stringify(parsed)
  }

  // 🔟 Fallback: Se veio de webhook (tem contexto com phone_number) e agente retornou apenas texto,
  //    envia automaticamente como WhatsApp
  if (context && (context.phone_number || context.from || context.to)) {
    const autoPhoneNumber = context.phone_number || context.from || context.to
    const hasWhatsAppIntegration = agent.integrations_id

    if (autoPhoneNumber && hasWhatsAppIntegration && cleanedResponse.trim().length > 0) {
      console.log('[chatWithAgent] 🔄 Fallback: Enviando resposta automática via WhatsApp (webhook)...', {
        phoneNumber: autoPhoneNumber,
        messageLength: cleanedResponse.length
      })

      try {
        // Busca histórico do Redis antes de enviar
        const history = await getHistoryFromRedis(
          agent.integrations_id,
          autoPhoneNumber,
          10
        )

        // Envia a resposta automaticamente
        const result = await sendWhatsApp(agent.integrations_id, {
          to: autoPhoneNumber,
          message: cleanedResponse,
          agentId: agentId
        })

        if (result.success) {
          // Salva resposta no Redis como "assistant"
          await saveMessageToHistory(
            agent.integrations_id,
            autoPhoneNumber,
            'assistant',
            cleanedResponse
          )
          
          console.log('[chatWithAgent] ✅ Resposta automática enviada com sucesso')
          return `📱 Resposta enviada automaticamente para ${autoPhoneNumber}`
        } else {
          console.error('[chatWithAgent] ❌ Erro ao enviar resposta automática:', result.error)
          return cleanedResponse // Retorna a resposta mesmo se falhar o envio
        }
      } catch (err: any) {
        console.error('[chatWithAgent] ❌ Erro no fallback de envio automático:', err)
        return cleanedResponse // Retorna a resposta mesmo se falhar
      }
    }
  }

  // 🔟 Fallback de segurança
  console.warn('⚠️ Ação não reconhecida:', parsed)
  return '❌ Ação não reconhecida pelo agente.'
}
