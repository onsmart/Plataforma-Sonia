import { supabase } from '../../lib/supabase'
import { normalizeAgentLanguageCode } from '../../utils/agent-language'

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

  const normalizedAgents = Array.isArray(data) ? [...data] : []

  if (normalizedAgents.length > 0) {
    const missingLanguageIds = normalizedAgents
      .filter(agent => !String(agent?.primary_language || '').trim())
      .map(agent => agent.id)

    if (missingLanguageIds.length > 0) {
      const { data: languageRows, error: languageError } = await supabase
        .from('tb_agents')
        .select('id, primary_language')
        .in('id', missingLanguageIds)

      if (languageError) {
        console.warn('[getAgentsByEmail] Erro ao complementar primary_language:', languageError)
      } else if (Array.isArray(languageRows)) {
        const languageMap = new Map(languageRows.map(row => [row.id, row.primary_language]))

        for (const agent of normalizedAgents) {
          const fallbackLanguage = languageMap.get(agent.id)
          agent.primary_language = normalizeAgentLanguageCode(agent.primary_language || fallbackLanguage, 'pt-BR')
        }
      }
    }

    for (const agent of normalizedAgents) {
      agent.primary_language = normalizeAgentLanguageCode(agent.primary_language, 'pt-BR')
    }
  }

  console.log('[getAgentsByEmail] Agentes retornados:', normalizedAgents.length || 0)
  if (normalizedAgents.length > 0) {
    const agentIds = normalizedAgents.map(agent => agent.id)
    console.log('[getAgentsByEmail] IDs dos agentes disponiveis:', agentIds)
    console.log('[getAgentsByEmail] Primeiro agente:', {
      id: normalizedAgents[0].id,
      nome: normalizedAgents[0].nome,
      integrations_id: normalizedAgents[0].integrations_id,
      integrations_id_type: typeof normalizedAgents[0].integrations_id,
      crm_integration_id: normalizedAgents[0].crm_integration_id,
      crm_integration_id_type: typeof normalizedAgents[0].crm_integration_id,
      primary_language: normalizedAgents[0].primary_language
    })
    console.log('[getAgentsByEmail] Primeiro agente completo:', JSON.stringify(normalizedAgents[0], null, 2))
  } else {
    console.warn('[getAgentsByEmail] Nenhum agente retornado para o email:', email)
  }

  return normalizedAgents
}
