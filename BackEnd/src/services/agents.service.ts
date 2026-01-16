import { supabase } from '../lib/supabase'

export async function getAgents() {
  const { data, error } = await supabase
    .from('tb_agents')
    .select('*')

  if (error) {
    console.error('SUPABASE RPC ERROR:', error)
    throw error
  }

  return data
}
