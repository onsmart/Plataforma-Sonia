import { supabase } from '../../lib/supabase'

function hasAutomationColumnError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || '').toLowerCase()
  return message.includes('column') && (message.includes('automation_mode') || message.includes('linked_flow_id'))
}

/**
 * Mantém tb_agents.integrations_id alinhado ao agente principal de uma integração WhatsApp.
 */
export async function syncWhatsAppAgentBinding(
  companiesId: string | null,
  integrationId: string,
  linkedAgentId: string | null
): Promise<void> {
  if (!companiesId) {
    if (linkedAgentId) {
      throw new Error('Nao foi possivel identificar a empresa para vincular o agente ao WhatsApp.')
    }
    return
  }

  const { data: companyAgents, error: companyAgentsError } = await supabase
    .from('tb_agents')
    .select('id, integrations_id')
    .eq('companies_id', companiesId)

  if (companyAgentsError) {
    throw new Error(companyAgentsError.message)
  }

  const agentsUsingThisIntegration = (companyAgents || [])
    .filter((agent: { integrations_id?: string | null }) => String(agent?.integrations_id || '').trim() === integrationId)
    .map((agent: { id: string }) => String(agent.id))

  if (!linkedAgentId) {
    if (agentsUsingThisIntegration.length > 0) {
      const { error } = await supabase
        .from('tb_agents')
        .update({ integrations_id: null })
        .eq('companies_id', companiesId)
        .in('id', agentsUsingThisIntegration)

      if (error) {
        throw new Error(error.message)
      }
    }

    return
  }

  const idsToClear = agentsUsingThisIntegration.filter((agentId) => agentId !== linkedAgentId)
  if (idsToClear.length > 0) {
    const { error } = await supabase
      .from('tb_agents')
      .update({ integrations_id: null })
      .eq('companies_id', companiesId)
      .in('id', idsToClear)

    if (error) {
      throw new Error(error.message)
    }
  }

  const { error: assignError } = await supabase
    .from('tb_agents')
    .update({ integrations_id: integrationId })
    .eq('id', linkedAgentId)
    .eq('companies_id', companiesId)

  if (assignError) {
    throw new Error(assignError.message)
  }
}

/** Ao vincular um agente, garante modo agente na integração (desliga flow). */
export async function setIntegrationAgentAutomationMode(
  companiesId: string | null,
  integrationId: string
): Promise<void> {
  if (!companiesId) return

  let response = await supabase
    .from('tb_integrations')
    .update({
      automation_mode: 'agent',
      linked_flow_id: null,
    })
    .eq('id', integrationId)
    .eq('companies_id', companiesId)

  if (response.error && hasAutomationColumnError(response.error)) {
    return
  }

  if (response.error) {
    throw new Error(response.error.message)
  }
}
