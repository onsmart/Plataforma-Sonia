import { supabase } from '../../lib/supabase'

export async function getAgentsByEmail(email: string) {
  const { data, error } = await supabase.rpc(
    'sp_get_agents_playground_by_email',
    { p_user_email: email }
  )

  if (error) {
    console.error('Supabase error:', error)
    throw new Error('Failed to fetch agents')
  }

  return data
}
