import { supabase } from '../../../lib/supabase'
import logger from '../../../lib/logger'

export type WhatsappMessageEventType =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'received'
  | 'status_update'

export type WhatsappMessageKind = 'session_text' | 'template' | 'unknown'

export interface RecordWhatsappMessageEventInput {
  integrations_id: string
  companies_id?: string | null
  whatsapp_contact_id?: string | null
  wamid?: string | null
  event_type: WhatsappMessageEventType
  message_kind: WhatsappMessageKind
  template_name?: string | null
  template_language?: string | null
  template_category?: string | null
  meta_status?: string | null
  flow_id?: string | null
  campaign_id?: string | null
  error_code?: number | null
  error_message?: string | null
  payload?: Record<string, unknown>
}

/**
 * Persistência best-effort: nunca lança para não quebrar webhook ou envio legado.
 */
export async function recordWhatsappMessageEvent(input: RecordWhatsappMessageEventInput): Promise<void> {
  try {
    const row = {
      integrations_id: input.integrations_id,
      companies_id: input.companies_id ?? null,
      whatsapp_contact_id: input.whatsapp_contact_id ?? null,
      wamid: input.wamid ?? null,
      event_type: input.event_type,
      message_kind: input.message_kind,
      template_name: input.template_name ?? null,
      template_language: input.template_language ?? null,
      template_category: input.template_category ?? null,
      meta_status: input.meta_status ?? null,
      flow_id: input.flow_id ?? null,
      campaign_id: input.campaign_id ?? null,
      error_code: input.error_code ?? null,
      error_message: input.error_message ?? null,
      payload: input.payload ?? {}
    }

    const { error } = await supabase.from('tb_whatsapp_message_events').insert(row)

    if (error) {
      if (String(error.message || '').includes('does not exist') || error.code === '42P01') {
        return
      }
      logger.warn('[whatsapp-message-events] Falha ao inserir evento', {
        integrations_id: input.integrations_id,
        event_type: input.event_type,
        error: error.message
      })
    }
  } catch (err: any) {
    logger.warn('[whatsapp-message-events] Excecao ao inserir evento', {
      integrations_id: input.integrations_id,
      error: err?.message
    })
  }
}
