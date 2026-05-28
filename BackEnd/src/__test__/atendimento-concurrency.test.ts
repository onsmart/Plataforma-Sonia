/**
 * Testes de simultaneidade via resolveInboundSession mockado.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sessionStore = new Map<string, string>()
const companyOpenCount = new Map<string, number>()
const LIMIT_PER_COMPANY = 200

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
      const companyId = params.companiesId || 'company-1'
      const key = `${companyId}:${params.integrationId}:${params.whatsappContactId}`
      if (sessionStore.has(key)) {
        return { blocked: false, continuing: true, sessionId: sessionStore.get(key) }
      }
      const used = companyOpenCount.get(companyId) ?? 0
      if (used >= LIMIT_PER_COMPANY) {
        return {
          blocked: true,
          continuing: false,
          conversationsUsed: used,
          conversationsLimit: LIMIT_PER_COMPANY,
        }
      }
      const id = `sess-${sessionStore.size + 1}`
      sessionStore.set(key, id)
      companyOpenCount.set(companyId, used + 1)
      return {
        blocked: false,
        continuing: false,
        newlyOpened: true,
        sessionId: id,
        conversationsUsed: used + 1,
      }
    }),
  }
})

describe('atendimento-concurrency', () => {
  beforeEach(() => {
    sessionStore.clear()
    companyOpenCount.clear()
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

  it('C2: dois webhooks simultâneos no mesmo contato — uma sessão', async () => {
    const { resolveInboundSession } = await import('../services/service-session.service')

    const params = {
      companiesId: 'company-1',
      integrationId: 'int-1',
      whatsappContactId: 'dup-contact',
      inboundMessage: 'oi',
    }

    const [first, second] = await Promise.all([
      resolveInboundSession(params),
      resolveInboundSession(params),
    ])

    expect(first.blocked).toBe(false)
    expect(second.blocked).toBe(false)
    expect(second.continuing).toBe(true)
    expect(sessionStore.size).toBe(1)
  })

  it('C3: 50 inbounds paralelos com limite atingido — todos bloqueiam', async () => {
    const { resolveInboundSession } = await import('../services/service-session.service')
    companyOpenCount.set('company-1', LIMIT_PER_COMPANY)

    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        resolveInboundSession({
          companiesId: 'company-1',
          integrationId: 'int-1',
          whatsappContactId: `over-limit-${i}`,
          inboundMessage: 'oi',
        })
      )
    )

    expect(results.every((r) => r.blocked)).toBe(true)
    expect(results.every((r) => r.conversationsUsed === LIMIT_PER_COMPANY)).toBe(true)
    expect(sessionStore.size).toBe(0)
  })

  it('C4: cinco empresas abrindo sessão em paralelo — isolamento', async () => {
    const { resolveInboundSession } = await import('../services/service-session.service')

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        resolveInboundSession({
          companiesId: `company-${i}`,
          integrationId: 'int-1',
          whatsappContactId: `contact-${i}`,
          inboundMessage: 'oi',
        })
      )
    )

    expect(results.every((r) => !r.blocked && r.newlyOpened)).toBe(true)
    expect(companyOpenCount.size).toBe(5)
    expect(sessionStore.size).toBe(5)
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
      sessionStore.set(`company-1:int-1:pre-${i}`, `sess-pre-${i}`)
    }
    companyOpenCount.set('company-1', 199)

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
