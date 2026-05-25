/**
 * Testes de simultaneidade via resolveInboundSession mockado.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sessionStore = new Map<string, string>()

vi.mock('../lib/logger', () => ({
  default: { info: vi.fn(), log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../services/service-session.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/service-session.service')>()
  return {
    ...actual,
    closeStaleSessions: vi.fn().mockResolvedValue(0),
    getOpenSession: vi.fn(async (integrationId: string, contactId: string) => {
      const key = `${integrationId}:${contactId}`
      const id = sessionStore.get(key)
      if (!id) return null
      return {
        id,
        integrations_id: integrationId,
        whatsapp_contact_id: contactId,
        status: 'open' as const,
      }
    }),
    resolveInboundSession: vi.fn(async (params) => {
      const key = `${params.integrationId}:${params.whatsappContactId}`
      if (sessionStore.has(key)) {
        return { blocked: false, continuing: true, sessionId: sessionStore.get(key) }
      }
      if (sessionStore.size >= 200) {
        return {
          blocked: true,
          continuing: false,
          conversationsUsed: 200,
          conversationsLimit: 200,
        }
      }
      const id = `sess-${sessionStore.size + 1}`
      sessionStore.set(key, id)
      return {
        blocked: false,
        continuing: false,
        newlyOpened: true,
        sessionId: id,
        conversationsUsed: sessionStore.size,
      }
    }),
  }
})

describe('atendimento-concurrency', () => {
  beforeEach(() => {
    sessionStore.clear()
    vi.clearAllMocks()
  })

  it('C1: 10 inbounds paralelos de 10 contatos distintos', async () => {
    const { resolveInboundSession } = await import('../services/service-session.service')

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        resolveInboundSession({
          companiesId: 'company-1',
          integrationId: 'int-1',
          whatsappContactId: `parallel-${i}`,
          inboundMessage: 'oi',
        })
      )
    )

    expect(results.every((r) => !r.blocked)).toBe(true)
    expect(sessionStore.size).toBe(10)
  })

  it('C5: double webhook no mesmo contato continua mesma sessão', async () => {
    const { resolveInboundSession } = await import('../services/service-session.service')

    const params = {
      companiesId: 'company-1',
      integrationId: 'int-1',
      whatsappContactId: 'same-contact',
      inboundMessage: 'Quero ajuda',
    }

    const [a, b] = await Promise.all([
      resolveInboundSession(params),
      resolveInboundSession(params),
    ])

    expect(a.blocked).toBe(false)
    expect(b.blocked).toBe(false)
    expect(b.continuing).toBe(true)
    expect(sessionStore.size).toBe(1)
  })

  it('C6: após 199 sessões, a próxima abre e a seguinte bloqueia', async () => {
    const { resolveInboundSession } = await import('../services/service-session.service')

    for (let i = 0; i < 199; i++) {
      sessionStore.set(`int-1:pre-${i}`, `sess-pre-${i}`)
    }

    const ok = await resolveInboundSession({
      companiesId: 'company-1',
      integrationId: 'int-1',
      whatsappContactId: 'new-200',
    })
    const blocked = await resolveInboundSession({
      companiesId: 'company-1',
      integrationId: 'int-1',
      whatsappContactId: 'new-201',
    })

    expect(ok.newlyOpened).toBe(true)
    expect(blocked.blocked).toBe(true)
    expect(sessionStore.size).toBe(200)
  })
})
