import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('getAgentSkills', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('agrega skills únicos por nome e prefere descrição mais completa', async () => {
    vi.doMock('../lib/supabase', () => ({
      supabase: {
        from: vi.fn((table: string) => {
          if (table === 'tb_agent_files') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () =>
                    Promise.resolve({
                      data: [{ file_id: 'file-1' }],
                      error: null,
                    }),
                }),
              }),
            }
          }
          if (table === 'tb_files') {
            return {
              select: () => ({
                in: () =>
                  Promise.resolve({
                    data: [{ id: 'file-1', file_purpose: 'skills' }],
                    error: null,
                  }),
              }),
            }
          }
          if (table === 'tb_file_skills') {
            return {
              select: () => ({
                in: () => ({
                  eq: () =>
                    Promise.resolve({
                      data: [
                        {
                          skill_name: 'Consultar pedido',
                          skill_description: null,
                          skill_type: 'process',
                        },
                        {
                          skill_name: 'Consultar pedido',
                          skill_description: 'Ver status e rastreio',
                          skill_type: 'process',
                        },
                        {
                          skill_name: 'Abrir chamado',
                          skill_description: 'Registrar ticket',
                          skill_type: 'action',
                        },
                      ],
                      error: null,
                    }),
                }),
              }),
            }
          }
          throw new Error(`tabela inesperada: ${table}`)
        }),
      },
    }))

    const { getAgentSkills } = await import('../services/agents/get-agent-skills')
    const skills = await getAgentSkills('agent-1', 'company-1')

    expect(skills).toHaveLength(2)
    const consultar = skills.find((s) => s.name === 'Consultar pedido')
    expect(consultar?.description).toBe('Ver status e rastreio')
    expect(consultar?.type).toBe('process')
  })

  it('retorna array vazio quando o agente não tem arquivos vinculados', async () => {
    vi.doMock('../lib/supabase', () => ({
      supabase: {
        from: vi.fn(() => ({
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        })),
      },
    }))

    const { getAgentSkills } = await import('../services/agents/get-agent-skills')
    const skills = await getAgentSkills('agent-x', 'company-x')
    expect(skills).toEqual([])
  })
})
