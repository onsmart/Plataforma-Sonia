import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/logger', () => ({
  default: { info: vi.fn(), log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('../utils/company-helper', () => ({
  getCompanyIdByEmail: vi.fn(),
}))

vi.mock('../services/agents/chatwithAgent', () => ({
  runAgentConversationTurn: vi.fn(),
}))

import { agentChat } from '../api/controllers/agents.controller'
import {
  getPlanCatalogEntry,
  isStripeCheckoutAvailable,
} from '../config/plans.catalog'
import { isAllowedKnowledgeUploadFile } from '../services/files/knowledge-file-formats'

describe('MVP go-live smoke (checklist §4 — código)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('§4.6 Playground: agentChat retorna 401 sem JWT', async () => {
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }
    await agentChat({ body: { agent_id: 'a', message: 'hi' } } as any, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('§4.5 REC Start: catálogo sem RAG', () => {
    expect(getPlanCatalogEntry('rec_start').hasRAG).toBe(false)
    expect(getPlanCatalogEntry('rec_growth').hasRAG).toBe(true)
  })

  it('§4.7 REC Growth: sem governança avançada no catálogo', () => {
    expect(getPlanCatalogEntry('rec_growth').hasGovernance).toBe(false)
    expect(getPlanCatalogEntry('rec_enterprise').hasGovernance).toBe(true)
  })

  it('§4.2 Stripe: checkout só Start e Growth', () => {
    expect(isStripeCheckoutAvailable('rec_start')).toBe(true)
    expect(isStripeCheckoutAvailable('rec_growth')).toBe(true)
    expect(isStripeCheckoutAvailable('rec_enterprise')).toBe(false)
  })

  it('§4.8 Knowledge: só .txt e .pdf', () => {
    expect(isAllowedKnowledgeUploadFile('a.txt', 'text/plain')).toBe(true)
    expect(isAllowedKnowledgeUploadFile('a.pdf', 'application/pdf')).toBe(true)
    expect(isAllowedKnowledgeUploadFile('a.md', 'text/markdown')).toBe(false)
  })

  it('§4.8 inbox stuck: serviço de listagem exportado', async () => {
    const mod = await import('../services/inbox-stuck-conversations.service')
    expect(typeof mod.listStuckWhatsAppConversations).toBe('function')
  })
})
