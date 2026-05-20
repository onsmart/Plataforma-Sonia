import type { FlowData, FlowExecutionMode } from './flow.types'

export type FlowRevisionSnapshot = {
  version: number
  nodes: FlowData['nodes']
  edges: FlowData['edges']
  startNodeId: string
  meta?: FlowData['meta']
  savedAt?: string
  publishedAt?: string
}

export type FlowPublishMeta = {
  publishStatus?: 'draft' | 'published'
  draftRevision?: FlowRevisionSnapshot | null
  publishedRevision?: FlowRevisionSnapshot | null
}

function cloneRevisionFromFlow(flow: FlowData, version: number): FlowRevisionSnapshot {
  return {
    version,
    nodes: Array.isArray(flow.nodes) ? flow.nodes : [],
    edges: Array.isArray(flow.edges) ? flow.edges : [],
    startNodeId: String(flow.startNodeId || '').trim(),
    meta: flow.meta ? { ...flow.meta } : undefined,
    savedAt: new Date().toISOString(),
  }
}

function revisionToFlowData(revision: FlowRevisionSnapshot): FlowData {
  return {
    nodes: revision.nodes,
    edges: revision.edges,
    startNodeId: revision.startNodeId,
    meta: revision.meta,
  }
}

export function readFlowPublishMeta(flow: FlowData): FlowPublishMeta {
  const meta = (flow.meta || {}) as FlowPublishMeta & FlowData['meta']
  return {
    publishStatus: meta.publishStatus,
    draftRevision: meta.draftRevision || null,
    publishedRevision: meta.publishedRevision || null,
  }
}

/**
 * Resolve qual revisao executar.
 * - live: publishedRevision (ou grafo atual se ainda nao publicado)
 * - test: draft atual (canvas em edicao)
 */
export function resolveFlowDataForExecution(
  stored: FlowData,
  executionMode: FlowExecutionMode = 'live'
): FlowData {
  const publish = readFlowPublishMeta(stored)

  if (executionMode === 'test') {
    if (publish.draftRevision) {
      return revisionToFlowData(publish.draftRevision)
    }
    return stored
  }

  if (publish.publishedRevision) {
    return revisionToFlowData(publish.publishedRevision)
  }

  return stored
}

/** Atualiza o rascunho (canvas) sem alterar a revisao publicada em producao. */
export function attachDraftRevision(flow: FlowData): FlowData {
  const publish = readFlowPublishMeta(flow)
  const nextVersion = Math.max(
    publish.draftRevision?.version || 0,
    publish.publishedRevision?.version || 0,
    0
  ) + 1

  return {
    ...flow,
    meta: {
      ...(flow.meta || {}),
      publishStatus: publish.publishStatus || 'draft',
      draftRevision: cloneRevisionFromFlow(flow, nextVersion),
      publishedRevision: publish.publishedRevision || null,
    },
  }
}

/** Publica o rascunho atual para execucao live. */
export type FlowPublishSummary = {
  publishStatus: 'draft' | 'published'
  draftVersion: number | null
  publishedVersion: number | null
  publishedAt: string | null
  hasUnpublishedChanges: boolean
}

export function getFlowPublishSummary(stored: FlowData): FlowPublishSummary {
  const publish = readFlowPublishMeta(stored)
  const draftVersion = publish.draftRevision?.version ?? null
  const publishedVersion = publish.publishedRevision?.version ?? null
  const publishedAt = publish.publishedRevision?.publishedAt ?? null

  const hasUnpublishedChanges =
    !publish.publishedRevision ||
    !publish.draftRevision ||
    draftVersion !== publishedVersion

  return {
    publishStatus: publish.publishedRevision ? 'published' : 'draft',
    draftVersion,
    publishedVersion,
    publishedAt,
    hasUnpublishedChanges,
  }
}

export function publishFlowDraft(flow: FlowData): FlowData {
  const publish = readFlowPublishMeta(flow)
  const source =
    publish.draftRevision && publish.draftRevision.nodes?.length
      ? publish.draftRevision
      : cloneRevisionFromFlow(flow, (publish.publishedRevision?.version || 0) + 1)

  const publishedRevision: FlowRevisionSnapshot = {
    ...source,
    publishedAt: new Date().toISOString(),
  }

  return {
    ...revisionToFlowData(publishedRevision),
    meta: {
      ...(publishedRevision.meta || {}),
      publishStatus: 'published',
      draftRevision: source,
      publishedRevision,
    },
  }
}
