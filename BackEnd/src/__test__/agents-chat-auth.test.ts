import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/logger', () => ({
  default: { info: vi.fn(), log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

vi.mock('../utils/company-helper', () => ({
  getCompanyIdByEmail: vi.fn(),
}))

vi.mock('../services/agents/chatwithAgent', () => ({
  runAgentConversationTurn: vi.fn(),
}))

import { agentChat } from '../api/controllers/agents.controller'

function createRes() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status: vi.fn((code: number) => {
      res.statusCode = code
      return res
    }),
    json: vi.fn((payload: unknown) => {
      res.body = payload
      return res
    }),
  }
  return res
}

describe('agentChat auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 401 sem usuário autenticado', async () => {
    const res = createRes()
    await agentChat({ body: { agent_id: 'a1', message: 'oi' } } as any, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.body?.error).toMatch(/autenticado/i)
  })
})
