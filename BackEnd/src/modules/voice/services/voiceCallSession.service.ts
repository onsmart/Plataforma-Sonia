import logger from '../../../lib/logger'
import { supabase } from '../../../lib/supabase'

export type VoiceCallSessionStatus =
  | 'received'
  | 'rejected'
  | 'pre_accepted'
  | 'accepted'
  | 'active'
  | 'terminated'
  | 'failed'

export interface SaveVoiceCallSessionInput {
  callId: string
  integrationId: string
  agentId?: string | null
  companiesId?: string | null
  caller?: string | null
  phoneNumberId?: string | null
  status: VoiceCallSessionStatus
  reason?: string | null
  sdpOffer?: string | null
  sdpAnswer?: string | null
  metadata?: Record<string, unknown> | null
}

export async function upsertVoiceCallSession(input: SaveVoiceCallSessionInput): Promise<void> {
  const callId = String(input.callId || '').trim()
  const integrationId = String(input.integrationId || '').trim()

  if (!callId || !integrationId) {
    return
  }

  const metadata = input.metadata && typeof input.metadata === 'object' ? input.metadata : {}

  const { error } = await supabase
    .from('tb_whatsapp_call_sessions')
    .upsert(
      {
        call_id: callId,
        integrations_id: integrationId,
        agent_id: input.agentId || null,
        companies_id: input.companiesId || null,
        caller: input.caller || null,
        phone_number_id: input.phoneNumberId || null,
        status: input.status,
        reason: input.reason || null,
        sdp_offer: input.sdpOffer || null,
        sdp_answer: input.sdpAnswer || null,
        metadata,
        last_event_at: new Date().toISOString()
      },
      {
        onConflict: 'call_id'
      }
    )

  if (error) {
    logger.warn('[voice.call_session] Falha ao persistir sessao de chamada', {
      callId,
      integrationId,
      status: input.status,
      error: error.message
    })
  }
}
