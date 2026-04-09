import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

function nodeUsesAgent(node: unknown, agentId: string): boolean {
  if (!node || typeof node !== 'object') return false
  const data = (node as { data?: Record<string, unknown> }).data
  if (!data || typeof data !== 'object') return false
  const aid = data.agentId ?? data.agent_id
  if (aid == null) return false
  return String(aid).trim().toLowerCase() === String(agentId).trim().toLowerCase()
}

/** Fluxos da empresa cujo JSON de nós referencia este agente (bloqueia exclusão). */
export async function getFlowNamesBlockingAgentDelete(
  agentId: string,
  companiesId: string
): Promise<string[]> {
  const { data: flows, error } = await supabase
    .from('tb_flows')
    .select('id, name, nodes')
    .eq('companies_id', companiesId)

  if (error) {
    logger.warn('[deleteAgent] Listagem de fluxos para checagem:', error.message)
    return []
  }
  if (!Array.isArray(flows)) return []

  const names: string[] = []
  for (const f of flows) {
    const row = f as { id?: string; name?: string; nodes?: unknown }
    const nodes = row.nodes
    const list = Array.isArray(nodes) ? nodes : []
    if (list.some((n) => nodeUsesAgent(n, agentId))) {
      names.push(String(row.name || row.id || 'sem nome'))
    }
  }
  return names
}

async function safeClear(
  label: string,
  run: () => PromiseLike<{ error?: { message?: string } | null }>
): Promise<void> {
  try {
    const { error } = await Promise.resolve(run())
    if (error?.message) {
      logger.warn(`[deleteAgent] ${label}: ${error.message}`)
    }
  } catch (e: unknown) {
    logger.warn(`[deleteAgent] ${label}:`, e instanceof Error ? e.message : e)
  }
}

/**
 * Remove o agente da tabela e registros dependentes conhecidos.
 * Retorna 409 se algum fluxo da empresa ainda referencia o agente nos nós.
 */
export async function hardDeleteAgent(
  agentId: string,
  companiesId: string
): Promise<
  { ok: true } | { ok: false; status: number; error: string; details?: string }
> {
  const blockingFlows = await getFlowNamesBlockingAgentDelete(agentId, companiesId)
  if (blockingFlows.length > 0) {
    const sample = blockingFlows.slice(0, 8).join(', ')
    const suffix = blockingFlows.length > 8 ? '…' : ''
    return {
      ok: false,
      status: 409,
      error: 'Agente ainda está em uso em fluxos',
      details: `Remova ou substitua o agente nos fluxos antes de excluir: ${sample}${suffix}`,
    }
  }

  await safeClear('tb_agent_decisions', () =>
    supabase.from('tb_agent_decisions').delete().eq('agent_id', agentId).then((r) => r)
  )

  await safeClear('tb_agent_token_usage', () =>
    supabase.from('tb_agent_token_usage').delete().eq('agent_id', agentId).then((r) => r)
  )

  await safeClear('tb_agent_files', () =>
    supabase
      .from('tb_agent_files')
      .delete()
      .eq('agent_id', agentId)
      .eq('companies_id', companiesId)
      .then((r) => r)
  )

  await safeClear('tb_whatsapp_messages', () =>
    supabase.from('tb_whatsapp_messages').update({ agent_id: null }).eq('agent_id', agentId).then((r) => r)
  )

  await safeClear('tb_system_logs', () =>
    supabase.from('tb_system_logs').update({ agent_id: null }).eq('agent_id', agentId).then((r) => r)
  )

  const { error: delErr } = await supabase
    .from('tb_agents')
    .delete()
    .eq('id', agentId)
    .eq('companies_id', companiesId)

  if (delErr) {
    logger.error('[deleteAgent] Falha ao excluir tb_agents:', delErr.message)
    return {
      ok: false,
      status: 500,
      error: 'Não foi possível excluir o agente',
      details: delErr.message,
    }
  }

  logger.log(`[deleteAgent] Agente ${agentId} excluído (empresa ${companiesId})`)
  return { ok: true }
}
