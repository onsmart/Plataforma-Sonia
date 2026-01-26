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
  try {
    parsed = JSON.parse(cleanedResponse)
    console.log('✅ JSON parseado:', parsed)
  } catch (err) {
    console.warn('⚠️ Resposta não é JSON válido após limpeza')
    console.warn('📝 Resposta original:', llmResponse.substring(0, 200))
    console.warn('📝 Resposta limpa:', cleanedResponse.substring(0, 200))
    return '❌ Erro ao interpretar a resposta do agente.'
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

      let phoneNumber = parsed.to || parsed.phone || ''
      let message = parsed.message || parsed.body || ''

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

      // Se não tiver número, tenta pegar do contexto (resposta automática)
      if (!phoneNumber && context) {
        phoneNumber = context.phone_number || context.from || context.to || ''
        console.log('[chatWithAgent] 📱 Número obtido do contexto (resposta automática):', phoneNumber)
      }

      if (!phoneNumber) {
        return '❌ Não foi possível determinar o número de telefone do destinatário.'
      }

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
        phoneNumber,
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
        
        // Usa a resposta contextualizada
        message = contextualResponse.trim()
        console.log('[chatWithAgent] ✅ Resposta gerada com contexto')
      } else {
        console.log('[chatWithAgent] ℹ️ Nenhum histórico encontrado no Redis, enviando mensagem original')
      }

      const result = await sendWhatsApp(agent.integrations_id, {
        to: phoneNumber,
        message: message,
        agentId: agentId
      })

      if (result.success) {
        // Salva resposta no Redis como "assistant"
        await saveMessageToHistory(
          agent.integrations_id,
          phoneNumber,
          'assistant',
          message
        )
        
        return `📱 WhatsApp enviado com sucesso para: ${phoneNumber}`
      } else {
        let errorMsg = `❌ Erro ao enviar WhatsApp: ${result.error || 'Erro desconhecido'}`
        
        // Se tiver QR code, adiciona informação destacada
        if (result.qrCode) {
          errorMsg += '\n\n' +
            '═══════════════════════════════════════════════════════════════\n' +
            '📱                    QR CODE GERADO!                          📱\n' +
            '═══════════════════════════════════════════════════════════════\n' +
            '\n' +
            '✅ O QR Code foi exibido no TERMINAL/CONSOLE do backend.\n' +
            '📋 Verifique o terminal onde o backend está rodando.\n' +
            '\n' +
            '💡 INSTRUÇÕES:\n' +
            '   1. Olhe o terminal/console do backend\n' +
            '   2. Procure pela seção "QR CODE DO WHATSAPP"\n' +
            '   3. Escaneie o código com o WhatsApp\n' +
            '\n' +
            '🔗 Ou acesse via API:\n' +
            '   GET /whatsapp/qrcode?integration_id=' + agent.integrations_id + '\n' +
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
