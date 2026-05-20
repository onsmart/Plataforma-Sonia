import { beforeEach, describe, expect, it, vi } from 'vitest'

const redisMock = vi.hoisted(() => ({
  set: vi.fn(),
}))

vi.mock('../lib/redis', () => ({
  getRedisClient: vi.fn(async () => redisMock),
}))

import { claimInboundMessageProcessing } from '../services/flows/flow-inbound-idempotency.service'

describe('flow-inbound-idempotency', () => {
  beforeEach(() => {
    redisMock.set.mockReset()
  })

  it('deve pular quando wamid ausente', async () => {
    const result = await claimInboundMessageProcessing({
      integrationId: 'int-1',
      externalMessageId: '',
    })
    expect(result.status).toBe('skipped')
  })

  it('deve reclamar quando Redis NX retorna OK', async () => {
    redisMock.set.mockResolvedValue('OK')
    const result = await claimInboundMessageProcessing({
      integrationId: 'int-1',
      externalMessageId: 'wamid.abc',
    })
    expect(result.status).toBe('claimed')
    expect(redisMock.set).toHaveBeenCalled()
  })

  it('deve detectar duplicata quando Redis NX falha', async () => {
    redisMock.set.mockResolvedValue(null)
    const result = await claimInboundMessageProcessing({
      integrationId: 'int-1',
      externalMessageId: 'wamid.abc',
    })
    expect(result.status).toBe('duplicate')
  })
})
