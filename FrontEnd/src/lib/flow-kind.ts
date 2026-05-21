/** Entrada mínima de listagem de fluxos (API /flows). */
export type FlowListEntry = {
  id: string
  name?: string | null
  flowKind?: 'main' | 'subflow' | string | null
  parentFlowId?: string | null
  parentFlowName?: string | null
  subflowKey?: string | null
  subflowOrder?: number | null
  meta?: { kind?: string | null } | null
}

export function resolveFlowKind(flow: FlowListEntry | null | undefined): 'main' | 'subflow' {
  const explicit = String(flow?.flowKind || flow?.meta?.kind || 'main').trim().toLowerCase()
  return explicit === 'subflow' ? 'subflow' : 'main'
}

export function isMainFlow(flow: FlowListEntry | null | undefined): boolean {
  return resolveFlowKind(flow) === 'main'
}

export function isSubflow(flow: FlowListEntry | null | undefined): boolean {
  return resolveFlowKind(flow) === 'subflow'
}

/** Fluxos raiz — uso em laboratório, integrações WhatsApp, seletor principal do editor. */
export function filterMainFlows<T extends FlowListEntry>(flows: T[]): T[] {
  return flows.filter(isMainFlow)
}

/**
 * Subfluxos pertencentes à família do fluxo raiz (mesmo parent_flow_id ou parent_flow_name).
 * Uso no picker do nó "Executar subfluxo" e loop interno ao grafo.
 */
export function filterFamilySubflows<T extends FlowListEntry>(
  flows: T[],
  rootFlowId: string | null | undefined,
  rootFlowName?: string | null
): T[] {
  const rootId = String(rootFlowId || '').trim()
  const rootName = String(rootFlowName || '').trim().toLowerCase()
  if (!rootId && !rootName) return []

  return flows.filter((flow) => {
    if (!isSubflow(flow)) return false
    const parentId = String(flow.parentFlowId || '').trim()
    const parentName = String(flow.parentFlowName || '').trim().toLowerCase()
    if (rootId && parentId === rootId) return true
    if (rootName && parentName && parentName === rootName) return true
    return false
  })
}
