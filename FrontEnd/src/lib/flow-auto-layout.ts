import type { Edge, Node } from "reactflow"

const COL_GAP = 380
const ROW_GAP = 260
const COMPONENT_MARGIN = 120

/** Estimativa de largura para empilhar componentes desconectados. */
const LAYOUT_RIGHT_PAD = 320

function edgeOutSortKey(e: Edge): number {
  const h = e.sourceHandle
  if (h === "true") return 0
  if (h === "false") return 1
  return 2
}

function connectedComponents(nodes: Node[], edges: Edge[]): string[][] {
  const adj = new Map<string, Set<string>>()
  for (const n of nodes) adj.set(n.id, new Set())
  for (const e of edges) {
    if (!adj.has(e.source) || !adj.has(e.target)) continue
    adj.get(e.source)!.add(e.target)
    adj.get(e.target)!.add(e.source)
  }
  const seen = new Set<string>()
  const out: string[][] = []
  for (const n of nodes) {
    if (seen.has(n.id)) continue
    const stack = [n.id]
    const comp: string[] = []
    seen.add(n.id)
    while (stack.length) {
      const u = stack.pop()!
      comp.push(u)
      for (const v of adj.get(u) || []) {
        if (!seen.has(v)) {
          seen.add(v)
          stack.push(v)
        }
      }
    }
    out.push(comp)
  }
  return out
}

function normalizeY(positions: Map<string, { x: number; y: number }>): Map<string, { x: number; y: number }> {
  let minY = Infinity
  for (const p of positions.values()) minY = Math.min(minY, p.y)
  if (!Number.isFinite(minY) || minY === 0) return positions
  const next = new Map<string, { x: number; y: number }>()
  for (const [id, p] of positions) next.set(id, { x: p.x, y: p.y - minY })
  return next
}

function layoutWidth(positions: Map<string, { x: number; y: number }>): number {
  let maxX = 0
  for (const p of positions.values()) maxX = Math.max(maxX, p.x)
  return maxX + LAYOUT_RIGHT_PAD
}

/**
 * Layout “escada” como fluxo classificador + cadeia Se/Senão (Criar com IA):
 * início → agente → [Se/Senão com IF à esquerda e ELSE indo ao próximo nível à direita] → fallback à direita.
 */
function tryStructuredClassifierLayout(
  subNodes: Node[],
  edges: Edge[]
): Map<string, { x: number; y: number }> | null {
  const idSet = new Set(subNodes.map((n) => n.id))
  const nodeOf = (id: string) => subNodes.find((n) => n.id === id)
  const outs = (id: string) => edges.filter((e) => e.source === id && idSet.has(e.target))

  const starts = subNodes.filter((n) => n.type === "start")
  if (starts.length !== 1) return null
  const startId = starts[0].id

  const so = outs(startId)
  if (so.length !== 1) return null
  const classifierId = so[0].target
  const classifier = nodeOf(classifierId)
  if (!classifier || classifier.type !== "agent") return null

  const co = outs(classifierId)
  if (co.length !== 1) return null

  let cur = co[0].target
  const ifChain: string[] = []

  while (true) {
    const n = nodeOf(cur)
    if (!n) return null
    if (n.type === "if-else") {
      ifChain.push(cur)
      const fe = outs(cur).find((e) => e.sourceHandle === "false")
      if (!fe) return null
      cur = fe.target
      continue
    }
    if (n.type === "agent") break
    return null
  }
  const fallbackAgentId = cur

  const positions = new Map<string, { x: number; y: number }>()
  const placed = new Set<string>()

  const SPINE_X0 = 420
  const STAIRCASE_DX = 92
  const BRANCH_X = 52
  const START_Y = 40
  const CLASSIFIER_Y = 176
  const LANE_Y = 292
  const FIRST_IF_Y = CLASSIFIER_Y + 172

  positions.set(startId, { x: SPINE_X0, y: START_Y })
  positions.set(classifierId, { x: SPINE_X0 - 36, y: CLASSIFIER_Y })
  placed.add(startId)
  placed.add(classifierId)

  for (let i = 0; i < ifChain.length; i++) {
    const ifId = ifChain[i]
    const xIf = SPINE_X0 + i * STAIRCASE_DX
    const yIf = FIRST_IF_Y + i * LANE_Y
    positions.set(ifId, { x: xIf, y: yIf })
    placed.add(ifId)

    const te = outs(ifId).find((e) => e.sourceHandle === "true")
    if (!te) return null
    const branchAgentId = te.target
    const ag = nodeOf(branchAgentId)
    if (!ag || ag.type !== "agent") return null
    positions.set(branchAgentId, { x: BRANCH_X, y: yIf + 54 })
    placed.add(branchAgentId)

    const ao = outs(branchAgentId)
    if (ao.length !== 1) return null
    const stopId = ao[0].target
    const st = nodeOf(stopId)
    if (!st || st.type !== "stop") return null
    positions.set(stopId, { x: BRANCH_X, y: yIf + 224 })
    placed.add(stopId)
  }

  const lastI = ifChain.length - 1
  const xFb =
    ifChain.length === 0
      ? SPINE_X0 + 248
      : SPINE_X0 + (lastI + 1) * STAIRCASE_DX + 220
  const yFb =
    ifChain.length === 0 ? CLASSIFIER_Y + 96 : FIRST_IF_Y + lastI * LANE_Y + 28

  positions.set(fallbackAgentId, { x: xFb, y: yFb })
  placed.add(fallbackAgentId)

  const fo = outs(fallbackAgentId)
  if (fo.length !== 1) return null
  const fbStopId = fo[0].target
  const fst = nodeOf(fbStopId)
  if (!fst || fst.type !== "stop") return null
  positions.set(fbStopId, { x: xFb, y: yFb + 204 })
  placed.add(fbStopId)

  if (placed.size !== subNodes.length) return null

  return normalizeY(positions)
}

function layoutComponent(subNodes: Node[], edges: Edge[]): {
  positions: Map<string, { x: number; y: number }>
  width: number
} {
  const ids = subNodes.map((n) => n.id)
  const idSet = new Set(ids)

  const inEdges = new Map<string, Edge[]>()
  const outEdges = new Map<string, Edge[]>()
  for (const id of ids) {
    inEdges.set(id, [])
    outEdges.set(id, [])
  }
  for (const e of edges) {
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue
    inEdges.get(e.target)!.push(e)
    outEdges.get(e.source)!.push(e)
  }

  const layer = new Map<string, number>()
  for (const id of ids) layer.set(id, 0)

  const maxRelax = Math.max(ids.length, edges.length, 1) + 8
  for (let i = 0; i < maxRelax; i++) {
    let changed = false
    for (const e of edges) {
      if (!idSet.has(e.source) || !idSet.has(e.target)) continue
      const lu = layer.get(e.source) ?? 0
      const next = lu + 1
      const cur = layer.get(e.target) ?? 0
      if (next > cur) {
        layer.set(e.target, next)
        changed = true
      }
    }
    if (!changed) break
  }

  let maxL = 0
  for (const id of ids) maxL = Math.max(maxL, layer.get(id) ?? 0)

  const layers: string[][] = Array.from({ length: maxL + 1 }, () => [])
  for (const id of ids) {
    const L = layer.get(id) ?? 0
    layers[L].push(id)
  }

  const startId = subNodes.find((n) => n.type === "start")?.id ?? null
  const dfsOrder = new Map<string, number>()
  let ord = 0
  function dfs(u: string) {
    if (dfsOrder.has(u)) return
    dfsOrder.set(u, ord++)
    const outs = [...(outEdges.get(u) || [])].sort((a, b) => {
      const k = edgeOutSortKey(a) - edgeOutSortKey(b)
      if (k !== 0) return k
      return (a.target || "").localeCompare(b.target || "")
    })
    for (const e of outs) dfs(e.target)
  }
  if (startId) dfs(startId)
  for (const id of ids) {
    if (!dfsOrder.has(id)) dfs(id)
  }

  for (let L = 0; L <= maxL; L++) {
    layers[L].sort((a, b) => {
      const da = dfsOrder.get(a) ?? 99999
      const db = dfsOrder.get(b) ?? 99999
      if (da !== db) return da - db
      return a.localeCompare(b)
    })
  }

  function indexInLayer(id: string): number {
    const L = layer.get(id) ?? 0
    return layers[L].indexOf(id)
  }

  const iterations = Math.min(14, 6 + Math.ceil(ids.length / 4))
  for (let it = 0; it < iterations; it++) {
    for (let L = 1; L <= maxL; L++) {
      const arr = layers[L]
      const scored = arr.map((id) => {
        const preds = inEdges.get(id) || []
        if (preds.length === 0) return indexInLayer(id)
        let s = 0
        for (const p of preds) s += indexInLayer(p.source)
        return s / preds.length
      })
      const idx = arr.map((_, i) => i)
      idx.sort((i, j) => scored[i] - scored[j] || arr[i].localeCompare(arr[j]))
      layers[L] = idx.map((i) => arr[i])
    }

    for (let L = maxL - 1; L >= 0; L--) {
      const arr = layers[L]
      const scored = arr.map((id) => {
        const o = outEdges.get(id) || []
        if (o.length === 0) return indexInLayer(id)
        let s = 0
        for (const e of o) s += indexInLayer(e.target)
        return s / o.length
      })
      const idx = arr.map((_, i) => i)
      idx.sort((i, j) => scored[i] - scored[j] || arr[i].localeCompare(arr[j]))
      layers[L] = idx.map((i) => arr[i])
    }
  }

  const positions = new Map<string, { x: number; y: number }>()
  for (let L = 0; L <= maxL; L++) {
    const row = layers[L]
    row.forEach((id, idx) => {
      positions.set(id, { x: L * COL_GAP, y: idx * ROW_GAP })
    })
  }

  const normalized = normalizeY(positions)
  return { positions: normalized, width: (maxL + 1) * COL_GAP }
}

export function autoLayoutFlowNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes

  const comps = connectedComponents(nodes, edges)
  let offsetX = 0
  const global = new Map<string, { x: number; y: number }>()

  for (const compIds of comps) {
    const subNodes = nodes.filter((n) => compIds.includes(n.id))
    const structured = tryStructuredClassifierLayout(subNodes, edges)
    let positions: Map<string, { x: number; y: number }>
    let width: number

    if (structured) {
      positions = structured
      width = layoutWidth(positions)
    } else {
      const r = layoutComponent(subNodes, edges)
      positions = r.positions
      width = r.width
    }

    for (const [id, p] of positions) {
      global.set(id, { x: p.x + offsetX, y: p.y })
    }
    offsetX += width + COMPONENT_MARGIN
  }

  return nodes.map((n) => {
    const p = global.get(n.id)
    if (!p) return n
    return { ...n, position: { x: p.x, y: p.y } }
  })
}
