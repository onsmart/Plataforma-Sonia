import logger from '../../../lib/logger'
import {
  type PreparedVoiceCallSession,
  type RealtimeVoiceAgentService,
  type VoiceCallSession,
} from '../types/voice.types'
import { WeriftVoiceCallAdapter } from './weriftVoiceCallAdapter.service'

type LocalVoiceMediaAdapterName = 'unconfigured' | 'dev-sdp' | 'werift'

function getAdapterName(): LocalVoiceMediaAdapterName {
  const normalized = String(process.env.VOICE_CALL_MEDIA_ADAPTER || 'unconfigured').trim().toLowerCase()
  if (normalized === 'werift') return 'werift'
  return normalized === 'dev-sdp' ? 'dev-sdp' : 'unconfigured'
}

function buildDevSdpAnswer(offer: string): string {
  const normalizedOffer = String(offer || '').trim()
  if (!normalizedOffer.startsWith('v=0')) {
    throw new Error('sdpOffer ausente ou invalido.')
  }

  return normalizedOffer
    .replace(/\r?\na=setup:actpass/g, '\r\na=setup:passive')
    .replace(/\r?\na=ice-options:trickle/g, '')
}

export class LocalRealtimeVoiceAgentService implements RealtimeVoiceAgentService {
  private readonly adapterName: LocalVoiceMediaAdapterName
  private readonly weriftAdapter: WeriftVoiceCallAdapter | null

  constructor(adapterName: LocalVoiceMediaAdapterName = getAdapterName()) {
    this.adapterName = adapterName
    this.weriftAdapter = adapterName === 'werift' ? new WeriftVoiceCallAdapter() : null
  }

  supportsRealtimeCalls(): boolean {
    return this.adapterName !== 'unconfigured'
  }

  async prepareInboundWhatsAppCall(session: VoiceCallSession): Promise<PreparedVoiceCallSession> {
    if (this.weriftAdapter) {
      return this.weriftAdapter.prepareInboundWhatsAppCall(session)
    }

    if (this.adapterName === 'dev-sdp') {
      return {
        sdpAnswer: buildDevSdpAnswer(session.sdpOffer || ''),
        metadata: {
          adapter: this.adapterName,
          warning: 'Adapter apenas para desenvolvimento. Nao transporta audio real.',
        },
      }
    }

    throw new Error('Nenhum adapter WebRTC/SIP foi configurado para gerar sdpAnswer.')
  }

  async attachAgentVoice(session: VoiceCallSession): Promise<void> {
    if (this.weriftAdapter) {
      return this.weriftAdapter.attachAgentVoice(session)
    }

    if (this.adapterName === 'dev-sdp') {
      logger.warn('[voice.local_runtime] Sessao anexada em modo dev-sdp sem transporte de audio real', {
        callId: session.callId,
        agentId: session.agentId,
        integrationId: session.integrationId,
      })
      return
    }

    throw new Error('Nenhum adapter WebRTC/SIP foi configurado para anexar audio realtime.')
  }
}

export function createLocalRealtimeVoiceAgentServiceFromEnv(): LocalRealtimeVoiceAgentService {
  const adapterName = getAdapterName()
  logger.info('[voice.runtime] Runtime local de ligacoes configurado', {
    adapter: adapterName,
  })
  return new LocalRealtimeVoiceAgentService(adapterName)
}
