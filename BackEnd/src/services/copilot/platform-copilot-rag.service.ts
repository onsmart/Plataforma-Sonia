import { generateEmbedding } from '../rag/embeddings.service'
import {
  PLATFORM_COPILOT_KNOWLEDGE,
  type PlatformKnowledgeChunk,
} from '../../content/platform-copilot/knowledge'
import logger from '../../lib/logger'

type IndexedChunk = PlatformKnowledgeChunk & { embedding: number[] }

let indexedChunks: IndexedChunk[] | null = null
let indexPromise: Promise<IndexedChunk[]> | null = null

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

/** Fallback determinístico para testes ou quando embedding falha. */
export function keywordSearchPlatformKnowledge(
  query: string,
  topK = 5
): PlatformKnowledgeChunk[] {
  const q = query.toLowerCase()
  const scored = PLATFORM_COPILOT_KNOWLEDGE.map((chunk) => {
    let score = 0
    const haystack = `${chunk.title} ${chunk.text} ${(chunk.keywords || []).join(' ')}`.toLowerCase()
    if (haystack.includes(q)) score += 10
    for (const kw of chunk.keywords || []) {
      if (q.includes(kw.toLowerCase()) || kw.toLowerCase().includes(q)) score += 3
    }
    for (const word of q.split(/\s+/).filter((w) => w.length > 3)) {
      if (haystack.includes(word)) score += 1
    }
    return { chunk, score }
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, topK).map((s) => s.chunk)
}

async function ensureIndex(): Promise<IndexedChunk[]> {
  if (indexedChunks) return indexedChunks
  if (indexPromise) return indexPromise

  indexPromise = (async () => {
    const result: IndexedChunk[] = []
    for (const chunk of PLATFORM_COPILOT_KNOWLEDGE) {
      const input = `${chunk.title}\n${chunk.text}`
      try {
        const { embedding } = await generateEmbedding(input)
        result.push({ ...chunk, embedding })
      } catch (err) {
        logger.warn('[platform-copilot-rag] Falha ao indexar chunk', {
          id: chunk.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    indexedChunks = result
    return result
  })()

  return indexPromise
}

export function resetPlatformCopilotIndexForTests(): void {
  indexedChunks = null
  indexPromise = null
}

export async function searchPlatformCopilotKnowledge(
  query: string,
  options?: { topK?: number; currentRoute?: string | null }
): Promise<{ chunks: PlatformKnowledgeChunk[]; contextText: string }> {
  const topK = options?.topK ?? 5
  const trimmed = query.trim()
  if (!trimmed) {
    return { chunks: [], contextText: '' }
  }

  let chunks: PlatformKnowledgeChunk[] = []

  try {
    const index = await ensureIndex()
    if (index.length > 0) {
      const { embedding: queryEmbedding } = await generateEmbedding(trimmed)
      const ranked = index
        .map((item) => ({
          chunk: item,
          score: cosineSimilarity(queryEmbedding, item.embedding),
        }))
        .sort((a, b) => b.score - a.score)

      chunks = ranked.slice(0, topK).map((r) => ({
        id: r.chunk.id,
        title: r.chunk.title,
        text: r.chunk.text,
        routes: r.chunk.routes,
        keywords: r.chunk.keywords,
      }))
    }
  } catch (err) {
    logger.warn('[platform-copilot-rag] Busca vetorial indisponível, usando keywords', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  if (chunks.length === 0) {
    chunks = keywordSearchPlatformKnowledge(trimmed, topK)
  }

  if (options?.currentRoute) {
    const routeBoost = PLATFORM_COPILOT_KNOWLEDGE.filter(
      (c) => c.routes?.includes(options.currentRoute!)
    )
    for (const extra of routeBoost) {
      if (!chunks.find((c) => c.id === extra.id)) {
        chunks.unshift(extra)
      }
    }
    chunks = chunks.slice(0, topK)
  }

  const contextText = chunks
    .map((c, i) => `[${i + 1}] ${c.title}\n${c.text}`)
    .join('\n\n')

  return { chunks, contextText }
}

export const __test__ = {
  cosineSimilarity,
  keywordSearchPlatformKnowledge,
  ensureIndex,
  resetPlatformCopilotIndexForTests,
}
