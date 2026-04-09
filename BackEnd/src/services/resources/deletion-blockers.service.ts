import { supabase } from '../../lib/supabase'
import { normalizeFlowNodesColumn, nodeDataAgentId } from '../../lib/flow-nodes-normalize'
import logger from '../../lib/logger'

export type TemplateAgentRef = { id: string; name: string }

export type DeletionBlockersPayload = {
  agentsInFlows: Record<string, string[]>
  templatesUsedByAgents: Record<string, TemplateAgentRef[]>
  flowsLinkedInIntegrations: Record<string, string[]>
}

/**
 * Mapas para o front desabilitar itens em exclusão em lote (agentes em fluxos, templates em uso, fluxos vinculados).
 */
export async function buildDeletionBlockers(companiesId: string): Promise<DeletionBlockersPayload> {
  const agentsInFlows: Record<string, string[]> = {}

  const { data: flows, error: flowsErr } = await supabase
    .from('tb_flows')
    .select('id, name, nodes')
    .eq('companies_id', companiesId)

  if (flowsErr) {
    logger.warn('[deletion-blockers] Fluxos:', flowsErr.message)
  } else {
    for (const row of flows || []) {
      const r = row as { id?: string; name?: string; nodes?: unknown }
      const fname = String(r.name || r.id || 'sem nome')
      const list = normalizeFlowNodesColumn(r.nodes)
      for (const n of list) {
        const aid = nodeDataAgentId(n)
        if (!aid) continue
        if (!agentsInFlows[aid]) agentsInFlows[aid] = []
        if (!agentsInFlows[aid].includes(fname)) agentsInFlows[aid].push(fname)
      }
    }
  }

  const templatesUsedByAgents: Record<string, TemplateAgentRef[]> = {}
  const { data: agents, error: agentsErr } = await supabase
    .from('tb_agents')
    .select('id, nome, role_template_id')
    .eq('companies_id', companiesId)

  if (agentsErr) {
    logger.warn('[deletion-blockers] Agentes:', agentsErr.message)
  } else {
    for (const a of agents || []) {
      const row = a as { id?: string; nome?: string; role_template_id?: string | null }
      const tid = row.role_template_id
      if (!tid) continue
      if (!templatesUsedByAgents[tid]) templatesUsedByAgents[tid] = []
      templatesUsedByAgents[tid].push({
        id: String(row.id || ''),
        name: String(row.nome || 'Agente'),
      })
    }
  }

  const flowsLinkedInIntegrations: Record<string, string[]> = {}
  const { data: ints, error: intErr } = await supabase
    .from('tb_integrations')
    .select('linked_flow_id, phone_number, provider')
    .eq('companies_id', companiesId)
    .not('linked_flow_id', 'is', null)

  if (intErr) {
    logger.warn('[deletion-blockers] Integrações:', intErr.message)
  } else {
    for (const row of ints || []) {
      const r = row as { linked_flow_id?: string | null; phone_number?: string | null; provider?: string | null }
      const fid = r.linked_flow_id
      if (!fid) continue
      const phone = r.phone_number ? String(r.phone_number) : ''
      const prov = r.provider ? String(r.provider) : 'integração'
      const label = phone ? `${prov} (${phone})` : prov
      if (!flowsLinkedInIntegrations[fid]) flowsLinkedInIntegrations[fid] = []
      if (!flowsLinkedInIntegrations[fid].includes(label)) flowsLinkedInIntegrations[fid].push(label)
    }
  }

  return { agentsInFlows, templatesUsedByAgents, flowsLinkedInIntegrations }
}
