import { describe, expect, it } from 'vitest'
import {
  attachDraftRevision,
  getFlowPublishSummary,
  publishFlowDraft,
  resolveFlowDataForExecution,
} from '../services/flows/flow-versioning'
import type { FlowData } from '../services/flows/flow.types'

function buildSampleFlow(label: string): FlowData {
  return {
    startNodeId: 'start-1',
    nodes: [{ id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: { label } }],
    edges: [],
    meta: { kind: 'main', runtime: { fastTrackIntentNodeId: 'intent-1' } },
  }
}

describe('flow-versioning', () => {
  it('live deve usar publishedRevision quando existir', () => {
    const draft = buildSampleFlow('draft')
    const published = buildSampleFlow('published')
    const stored = publishFlowDraft(attachDraftRevision(draft))
    stored.meta = {
      ...(stored.meta || {}),
      publishedRevision: {
        version: 1,
        nodes: published.nodes,
        edges: published.edges,
        startNodeId: published.startNodeId,
        meta: published.meta,
      },
    }

    const live = resolveFlowDataForExecution(stored, 'live')
    expect(live.nodes[0].data.label).toBe('published')
  })

  it('test deve usar draftRevision', () => {
    const draft = buildSampleFlow('draft-only')
    const stored = attachDraftRevision(draft)
    const testRun = resolveFlowDataForExecution(stored, 'test')
    expect(testRun.nodes[0].data.label).toBe('draft-only')
  })

  it('publishFlowDraft deve marcar publishStatus published', () => {
    const stored = publishFlowDraft(buildSampleFlow('v1'))
    expect(stored.meta?.publishStatus).toBe('published')
    expect(stored.meta?.publishedRevision?.version).toBeGreaterThan(0)
  })

  it('getFlowPublishSummary deve sinalizar alteracoes nao publicadas', () => {
    const draft = attachDraftRevision(buildSampleFlow('draft-v2'))
    const summary = getFlowPublishSummary(draft)
    expect(summary.hasUnpublishedChanges).toBe(true)
    expect(summary.draftVersion).toBeGreaterThan(0)
  })
})
