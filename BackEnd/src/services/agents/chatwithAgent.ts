import { chatText } from '../llm/openai'
import { getAgentsByEmail } from './index'
import { getAgentFromCache } from './getagentfromcache'
import { sendEmail } from '../integrations/email/email.service'
import { readEmailsWithAgent } from './readEmailsWithAgent'

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

  // 4️⃣ Parse do JSON
  let parsed: any = null
  try {
    parsed = JSON.parse(llmResponse)
    console.log('✅ JSON parseado:', parsed)
  } catch (err) {
    console.warn('⚠️ Resposta não é JSON válido')
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

        try {
          parsed = JSON.parse(llmResponse)
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

  // 7️⃣ Ação: reply (mensagem simples)
  if (parsed.action === 'reply') {
    return parsed.message || 'Resposta gerada.'
  }

  // 8️⃣ Se não tem action mas tem dados (usado em flows para passar dados entre nodes)
  // Retorna o JSON como string para que o flow-executor possa fazer parse
  if (!parsed.action && typeof parsed === 'object' && parsed !== null) {
    console.log('[chatWithAgent] JSON sem action detectado (provavelmente dados para flow):', parsed)
    // Retorna o JSON como string para manter compatibilidade
    return JSON.stringify(parsed)
  }

  // 9️⃣ Fallback de segurança
  console.warn('⚠️ Ação não reconhecida:', parsed)
  return '❌ Ação não reconhecida pelo agente.'
}
