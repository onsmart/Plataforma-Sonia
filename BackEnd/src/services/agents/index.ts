import { supabase } from '../../lib/supabase'

export async function getAgentsByEmail(email: string) {
  const { data, error } = await supabase.rpc(
    'fn_get_agents_with_api_key',
    { p_user_email: email }
  )

  if (error) {
    console.error('Supabase error:', error)
    throw new Error('Failed to fetch agents')
  }

  return data
}
