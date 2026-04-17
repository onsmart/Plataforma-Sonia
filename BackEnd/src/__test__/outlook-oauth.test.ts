import { afterEach, describe, expect, it } from 'vitest'
import {
  createSignedOutlookState,
  verifySignedOutlookState,
} from '../services/integrations/email_reader/outlook/outlook.oauth'

const originalStateSecret = process.env.OUTLOOK_STATE_SECRET
const originalClientSecret = process.env.OUTLOOK_CLIENT_SECRET

describe('outlook.oauth state signing', () => {
  afterEach(() => {
    process.env.OUTLOOK_STATE_SECRET = originalStateSecret
    process.env.OUTLOOK_CLIENT_SECRET = originalClientSecret
  })

  it('gera e valida state assinado para o Microsoft 365', () => {
    process.env.OUTLOOK_STATE_SECRET = 'test-state-secret'

    const state = createSignedOutlookState({
      userId: 'user-123',
      userEmail: 'usuario@empresa.com',
    })

    const payload = verifySignedOutlookState(state)

    expect(payload.userId).toBe('user-123')
    expect(payload.userEmail).toBe('usuario@empresa.com')
    expect(payload.expiresAt).toBeGreaterThan(payload.issuedAt)
  })

  it('rejeita state adulterado', () => {
    process.env.OUTLOOK_STATE_SECRET = 'test-state-secret'

    const state = createSignedOutlookState({
      userId: 'user-123',
    })

    const tamperedState = `${state.slice(0, -1)}x`

    expect(() => verifySignedOutlookState(tamperedState)).toThrow(/state do outlook/i)
  })

  it('rejeita state expirado', () => {
    process.env.OUTLOOK_STATE_SECRET = 'test-state-secret'

    const state = createSignedOutlookState(
      {
        userId: 'user-123',
      },
      -1000
    )

    expect(() => verifySignedOutlookState(state)).toThrow(/expirado/i)
  })
})
