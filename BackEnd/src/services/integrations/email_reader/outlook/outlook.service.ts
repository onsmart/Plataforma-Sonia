import { supabase } from '../../../../lib/supabase'
import { OutlookClient } from './outlook.client'

export async function readOutlookEmails(
  integrationsId: string,
  limit = 5
) {
  console.log('[readOutlookEmails] Buscando integração com id:', integrationsId, 'tipo:', typeof integrationsId)
  
  if (!integrationsId || integrationsId.trim() === '') {
    throw new Error('ID de integração não fornecido')
  }

  const { data, error } = await supabase
    .from('tb_integrations')
    .select('id, access_token, user_id, provider, email')
    .eq('id', integrationsId)
    .single()

  console.log('[readOutlookEmails] Resultado da query:', { 
    data, 
    error, 
    hasData: !!data,
    hasAccessToken: !!data?.access_token 
  })

  if (error) {
    console.error('[readOutlookEmails] Erro na query:', error)
    throw new Error(`Erro ao buscar token do Outlook: ${error.message}`)
  }

  if (!data) {
    console.error('[readOutlookEmails] Nenhum dado retornado para integrationsId:', integrationsId)
    throw new Error(`Token do Outlook não encontrado para integration_id: ${integrationsId}`)
  }

  if (!data.access_token) {
    console.error('[readOutlookEmails] access_token está vazio/null para integration_id:', integrationsId)
    throw new Error('Token do Outlook não encontrado (access_token vazio)')
  }

  const client = new OutlookClient(data.access_token)
  const result = await client.getInboxMessages(limit)

  return result.value.map((email: any) => ({
    id: email.id,
    from: email.from.emailAddress.address,
    subject: email.subject,
    preview: email.bodyPreview,
    receivedAt: email.receivedDateTime,
  }))
}
