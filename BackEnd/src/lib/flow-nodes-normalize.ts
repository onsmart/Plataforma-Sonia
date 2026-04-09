/**
 * Coluna `tb_flows.nodes` pode ser array legado ou objeto FlowData { nodes, edges, startNodeId }.
 */
export function normalizeFlowNodesColumn(nodesCol: unknown): unknown[] {
  if (nodesCol == null) return []
  if (Array.isArray(nodesCol)) return nodesCol
  if (
    typeof nodesCol === 'object' &&
    nodesCol !== null &&
    Array.isArray((nodesCol as { nodes?: unknown }).nodes)
  ) {
    return (nodesCol as { nodes: unknown[] }).nodes
  }
  return []
}

export function nodeDataAgentId(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null
  const data = (node as { data?: Record<string, unknown> }).data
  if (!data || typeof data !== 'object') return null
  const aid = data.agentId ?? data.agent_id
  if (aid == null) return null
  const s = String(aid).trim()
  return s || null
}
