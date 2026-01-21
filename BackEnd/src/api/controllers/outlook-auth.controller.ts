import { Request, Response } from 'express'
import { exchangeCodeForToken } from '../../services/integrations/email_reader/outlook/outlook.oauth'
import { supabase } from '../../lib/supabase'

export async function outlookCallback(req: Request, res: Response) {
  try {
    const { code, state } = req.query

    if (!code || !state) {
      return res.status(400).json({ error: 'Code ou state ausente' })
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
      throw new Error('Usuário não encontrado na tabela tb_user')
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

    // 5️⃣ Feedback simples (UX)
    return res.send(`
      <html>
        <head>
          <title>Outlook Conectado</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h2 { color: #28a745; }
          </style>
        </head>
        <body>
          <h2>✅ Outlook conectado com sucesso!</h2>
          <p>Você pode fechar esta janela e voltar para a plataforma.</p>
          <script>
            setTimeout(() => {
              window.close();
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
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h2 { color: #dc3545; }
          </style>
        </head>
        <body>
          <h2>❌ Erro ao conectar Outlook</h2>
          <p>${err.message || 'Erro desconhecido'}</p>
          <p style="font-size: 12px; color: #666;">Verifique os logs do servidor para mais detalhes.</p>
        </body>
      </html>
    `)
  }
}
