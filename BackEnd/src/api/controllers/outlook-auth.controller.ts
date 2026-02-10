import { Request, Response } from 'express'
import { exchangeCodeForToken } from '../../services/integrations/email_reader/outlook/outlook.oauth'
import { supabase } from '../../lib/supabase'

/**
 * Normaliza um número de telefone removendo sufixos do WhatsApp
 * Exemplo: "5511999431006@s.whatsapp.net" → "5511999431006"
 * @param phoneNumber - Número de telefone que pode conter sufixos do WhatsApp
 * @returns Número normalizado (apenas dígitos)
 */
function normalizePhoneNumber(phoneNumber: string | null | undefined): string | null {
  if (!phoneNumber) return null
  
  // Remove sufixos do WhatsApp (@s.whatsapp.net, @lid, @g.us, @c.us, etc)
  // e mantém apenas os dígitos
  const normalized = phoneNumber
    .replace(/@s\.whatsapp\.net/gi, '')
    .replace(/@lid/gi, '')
    .replace(/@g\.us/gi, '')
    .replace(/@c\.us/gi, '')
    .replace(/\D/g, '') // Remove todos os caracteres não numéricos
  
  return normalized.length > 0 ? normalized : null
}

export async function outlookCallback(req: Request, res: Response) {
  try {
    const { code, state, error, error_description } = req.query

    // ✅ Verificar erros do OAuth primeiro
    if (error) {
      console.error('[outlookCallback] Erro do OAuth:', error, error_description)
      return res.status(400).send(`
        <html>
          <head>
            <title>Erro de Autenticação</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
              .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
              h2 { color: #dc3545; margin-bottom: 20px; }
              p { color: #666; }
              .close-btn { margin-top: 20px; padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>❌ Erro de Autenticação</h2>
              <p>${error_description || error}</p>
              <p style="font-size: 12px; color: #666; margin-top: 20px;">Tente novamente.</p>
              <button class="close-btn" onclick="window.close()">Fechar Janela</button>
            </div>
            <script>
              setTimeout(() => {
                if (window.opener) {
                  window.close();
                }
              }, 5000);
            </script>
          </body>
        </html>
      `)
    }

    if (!code || !state) {
      return res.status(400).send(`
        <html>
          <head>
            <title>Erro</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
              .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
              h2 { color: #dc3545; margin-bottom: 20px; }
              p { color: #666; }
              .close-btn { margin-top: 20px; padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>❌ Código ou state ausente</h2>
              <p>Tente iniciar a autenticação novamente.</p>
              <button class="close-btn" onclick="window.close()">Fechar Janela</button>
            </div>
            <script>
              setTimeout(() => {
                if (window.opener) {
                  window.close();
                }
              }, 3000);
            </script>
          </body>
        </html>
      `)
    }

    // 1️⃣ Troca o code por tokens
    const tokenData = await exchangeCodeForToken(code as string)

    if (!tokenData.access_token || !tokenData.refresh_token) {
      throw new Error('Tokens não recebidos da Microsoft')
    }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000)

    // 2️⃣ O state é o user_id da tabela tb_user (text)
    // Busca o email do usuário na tabela tb_user pelo user_id
    const userId = state as string
    
    if (!userId || userId.trim() === '') {
      throw new Error('ID de usuário inválido')
    }

    // Busca o email do usuário na tabela tb_user
    const { data: userData, error: userError } = await supabase
      .from('tb_users')
      .select('email')
      .eq('id', userId)
      .single()

    if (userError || !userData?.email) {
      console.error('Erro ao buscar usuário:', userError)
      console.error('State recebido (user_id):', userId)
      throw new Error(`Usuário não encontrado na tabela tb_users. User ID: ${userId}`)
    }

    const userEmail = userData.email

    // 3️⃣ Verifica se já existe uma integração para este usuário e provider
    const { data: existingIntegration } = await supabase
      .from('tb_integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', 'outlook')
      .maybeSingle() // maybeSingle() não retorna erro se não encontrar, apenas null

    // 4️⃣ Salva/atualiza os tokens na tabela tb_integrations usando o id da tabela
    const upsertData: any = {
      user_id: userId,
      provider: 'outlook',
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt.toISOString(),
      email: userEmail,
      smtp_host: 'smtp.office365.com',
      smtp_port: 587,
    }

    // Normaliza phone_number se vier no formato WhatsApp (ex: "5511999431006@s.whatsapp.net" → "5511999431006")
    // Verifica se há phone_number nos query params ou body
    const phoneNumberFromQuery = req.query.phone_number as string | undefined
    const phoneNumberFromBody = (req.body as any)?.phone_number as string | undefined
    const phoneNumberRaw = phoneNumberFromQuery || phoneNumberFromBody
    
    if (phoneNumberRaw) {
      const normalizedPhone = normalizePhoneNumber(phoneNumberRaw)
      if (normalizedPhone) {
        upsertData.phone_number = normalizedPhone
        console.log('[outlookCallback] 📱 Número de telefone normalizado:', {
          original: phoneNumberRaw,
          normalized: normalizedPhone
        })
      }
    }

    let upsertError: any = null

    // Se já existe, atualiza usando o id; se não, cria novo
    if (existingIntegration?.id) {
      upsertData.id = existingIntegration.id
      console.log('[outlookCallback] Atualizando integração existente com id:', existingIntegration.id)
      
      // Atualiza usando o id como chave
      const { error } = await supabase
        .from('tb_integrations')
        .update(upsertData)
        .eq('id', existingIntegration.id)
      
      upsertError = error
    } else {
      console.log('[outlookCallback] Criando nova integração para user_id:', userId)
      
      // Insere novo registro (sem id)
      const { error } = await supabase
        .from('tb_integrations')
        .insert(upsertData)
      
      upsertError = error
    }

    if (upsertError) {
      console.error('Erro ao salvar tokens:', upsertError)
      throw upsertError
    }

    // 4️⃣ Atualiza via RPC para manter consistência
    try {
      await supabase.rpc('sp_upsert_integration_by_email', {
        p_user_email: userEmail,
        p_email: userEmail,
        p_smtp_host: 'smtp.office365.com',
        p_smtp_port: 587,
        p_app_key: tokenData.access_token,
      })
    } catch (rpcError) {
      console.warn('Erro ao atualizar via RPC (não crítico):', rpcError)
    }

    // 5️⃣ Feedback melhorado (UX)
    return res.send(`
      <html>
        <head>
          <title>Outlook Conectado</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
            h2 { color: #28a745; margin-bottom: 20px; }
            p { color: #666; }
            .close-btn { margin-top: 20px; padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
            .close-btn:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>✅ Outlook conectado com sucesso!</h2>
            <p>Você pode fechar esta janela e voltar para a plataforma.</p>
            <button class="close-btn" onclick="window.close()">Fechar Janela</button>
          </div>
          <script>
            // Tenta fechar automaticamente após 3 segundos
            setTimeout(() => {
              if (window.opener) {
                // Envia mensagem para a janela pai (se existir)
                try {
                  window.opener.postMessage('outlook-connected', '*');
                } catch (e) {
                  console.log('Não foi possível enviar mensagem para janela pai');
                }
                window.close();
              } else {
                // Se não conseguir fechar, mostra mensagem
                console.log('Janela não pode ser fechada automaticamente. Use o botão acima.');
              }
            }, 3000);
          </script>
        </body>
      </html>
    `)
  } catch (err: any) {
    console.error('Erro OAuth Outlook:', err)
    return res.status(500).send(`
      <html>
        <head>
          <title>Erro ao Conectar Outlook</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
            h2 { color: #dc3545; margin-bottom: 20px; }
            p { color: #666; }
            .close-btn { margin-top: 20px; padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
            .close-btn:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>❌ Erro ao conectar Outlook</h2>
            <p>${err.message || 'Erro desconhecido'}</p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">Verifique os logs do servidor para mais detalhes.</p>
            <button class="close-btn" onclick="window.close()">Fechar Janela</button>
          </div>
          <script>
            setTimeout(() => {
              if (window.opener) {
                window.close();
              }
            }, 5000);
          </script>
        </body>
      </html>
    `)
  }
}
