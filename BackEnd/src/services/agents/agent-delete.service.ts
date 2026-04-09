import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { normalizeFlowNodesColumn, nodeDataAgentId } from '../../lib/flow-nodes-normalize'

function nodeUsesAgent(node: unknown, agentId: string): boolean {
  const aid = nodeDataAgentId(node)
  if (!aid) return false
  return aid.toLowerCase() === String(agentId).trim().toLowerCase()
}

function stripAgentFromNodeData(data: Record<string, unknown>, agentId: string): boolean {
  const target = agentId.trim().toLowerCase()
  const aid = data.agentId ?? data.agent_id
  if (aid == null) return false
  if (String(aid).trim().toLowerCase() !== target) return false
  delete data.agentId
  delete data.agent_id
  return true
}

function mapNodeStripAgent(node: unknown, agentId: string): { node: unknown; changed: boolean } {
  if (!node || typeof node !== 'object') return { node, changed: false }
  const n = node as { data?: Record<string, unknown> }
  if (!n.data || typeof n.data !== 'object') return { node, changed: false }
  const data = { ...n.data }
  if (!stripAgentFromNodeData(data, agentId)) return { node, changed: false }
  return { node: { ...n, data }, changed: true }
}

function stripAgentFromNodesColumn(nodesCol: unknown, agentId: string): { next: unknown; changed: boolean } {
  if (nodesCol == null) return { next: nodesCol, changed: false }
  if (Array.isArray(nodesCol)) {
    let changed = false
    const next = nodesCol.map((node) => {
      const r = mapNodeStripAgent(node, agentId)
      if (r.changed) changed = true
      return r.node
    })
    return { next, changed }
  }
  if (
    typeof nodesCol === 'object' &&
    nodesCol !== null &&
    Array.isArray((nodesCol as { nodes?: unknown[] }).nodes)
  ) {
    const o = nodesCol as { nodes: unknown[]; [key: string]: unknown }
    let changed = false
    const nextNodes = o.nodes.map((node) => {
      const r = mapNodeStripAgent(node, agentId)
      if (r.changed) changed = true
      return r.node
    })
    if (!changed) return { next: nodesCol, changed: false }
    return { next: { ...o, nodes: nextNodes }, changed: true }
  }
  return { next: nodesCol, changed: false }
}

/** Remove referências ao agente nos JSON de nós (fluxos legados ou “apagados” na UI mas ainda no banco). */
export async function detachAgentFromCompanyFlows(agentId: string, companiesId: string): Promise<number> {
  const { data: flows, error } = await supabase
    .from('tb_flows')
    .select('id, nodes')
    .eq('companies_id', companiesId)

  if (error || !Array.isArray(flows)) {
    logger.warn('[deleteAgent] detach flows list:', error?.message)
    return 0
  }

  let updated = 0
  for (const f of flows) {
    const row = f as { id?: string; nodes?: unknown }
    const fid = row.id
    if (!fid) continue
    const { next, changed } = stripAgentFromNodesColumn(row.nodes, agentId)
    if (!changed) continue
    const { error: upErr } = await supabase
      .from('tb_flows')
      .update({ nodes: next })
      .eq('id', fid)
      .eq('companies_id', companiesId)
    if (upErr) {
      logger.warn(`[deleteAgent] Falha ao atualizar fluxo ${fid}:`, upErr.message)
    } else {
      updated++
    }
  }
  return updated
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
    const list = normalizeFlowNodesColumn(row.nodes)
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
  await detachAgentFromCompanyFlows(agentId, companiesId)

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

  await safeClear('tb_integrations linked_agent_id', () =>
    supabase
      .from('tb_integrations')
      .update({ linked_agent_id: null })
      .eq('linked_agent_id', agentId)
      .eq('companies_id', companiesId)
      .then((r) => r)
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
