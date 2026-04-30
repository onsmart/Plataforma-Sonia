import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}))

import { LocalRealtimeVoiceAgentService } from '../modules/voice/services/localRealtimeVoiceAgent.service'

describe('LocalRealtimeVoiceAgentService', () => {
  it('fica desabilitado quando nenhum adapter de midia foi configurado', async () => {
    const service = new LocalRealtimeVoiceAgentService('unconfigured')

    expect(service.supportsRealtimeCalls()).toBe(false)
    await expect(
      service.prepareInboundWhatsAppCall({
        sessionId: 'call-1',
        callId: 'call-1',
        agentId: 'agent-1',
        integrationId: 'integration-1',
        provider: 'whatsapp_calling',
        startedAt: '2026-04-29T12:00:00.000Z',
        sdpOffer: 'v=0',
      })
    ).rejects.toThrow('Nenhum adapter WebRTC/SIP')
  })

  it('gera um sdpAnswer em modo dev-sdp para validar o contrato sem audio real', async () => {
    const service = new LocalRealtimeVoiceAgentService('dev-sdp')

    const result = await service.prepareInboundWhatsAppCall({
      sessionId: 'call-1',
      callId: 'call-1',
      agentId: 'agent-1',
      integrationId: 'integration-1',
      provider: 'whatsapp_calling',
      startedAt: '2026-04-29T12:00:00.000Z',
      sdpOffer: 'v=0\r\na=setup:actpass\r\na=ice-options:trickle',
    })

    expect(service.supportsRealtimeCalls()).toBe(true)
    expect(result.sdpAnswer).toContain('v=0')
    expect(result.sdpAnswer).toContain('a=setup:passive')
    expect(result.sdpAnswer).not.toContain('ice-options:trickle')
    expect(result.metadata).toEqual(
      expect.objectContaining({
        adapter: 'dev-sdp',
      })
    )
  })
})
