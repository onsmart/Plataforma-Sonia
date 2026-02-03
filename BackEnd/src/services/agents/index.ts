import { supabase } from '../../lib/supabase'

export async function getAgentsByEmail(email: string) {
  console.log('[getAgentsByEmail] Buscando agentes para email:', email)
  
  const { data, error } = await supabase.rpc(
    'fn_get_agents_with_api_key',
    { p_user_email: email }
  )

  if (error) {
    console.error('[getAgentsByEmail] Erro na RPC:', error)
    throw new Error('Failed to fetch agents')
  }

  console.log('[getAgentsByEmail] Agentes retornados:', data?.length || 0)
  if (data && Array.isArray(data) && data.length > 0) {
    console.log('[getAgentsByEmail] Primeiro agente:', {
      id: data[0].id,
      nome: data[0].nome,
      integrations_id: data[0].integrations_id,
      integrations_id_type: typeof data[0].integrations_id,
      crm_integration_id: data[0].crm_integration_id,
      crm_integration_id_type: typeof data[0].crm_integration_id
    })
    // Log completo do primeiro agente para debug
    console.log('[getAgentsByEmail] Primeiro agente completo:', JSON.stringify(data[0], null, 2))
  }

  return data
}
