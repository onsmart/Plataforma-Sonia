import { supabase } from '../../../lib/supabase'
import logger from '../../../lib/logger'
import { computeCustomerCareWindow } from './whatsapp-session-window'

export interface CustomerCareWindowState extends ReturnType<typeof computeCustomerCareWindow> {
  lastInboundAt: string | null
}

/**
 * Usa tb_whatsapp_messages (comportamento já existente) como fonte primária.
 * Eventos em tb_whatsapp_message_events podem ser incorporados depois sem quebrar compatibilidade.
 */
export async function getCustomerCareWindowState(
  integrationsId: string,
  whatsappContactId: string
): Promise<CustomerCareWindowState> {
  try {
    const { data, error } = await supabase
      .from('tb_whatsapp_messages')
      .select('created_at')
      .eq('integrations_id', integrationsId)
      .eq('whatsapp_contact_id', whatsappContactId)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      logger.warn('[whatsapp-session-window.service] Erro ao buscar ultimo inbound', {
        integrationsId,
        whatsappContactId,
        error: error.message
      })
      const fallback = computeCustomerCareWindow({ lastInboundAt: null, now: new Date() })
      return { ...fallback, lastInboundAt: null }
    }

    const lastIso = data?.created_at ? String(data.created_at) : null
    const lastInboundAt = lastIso ? new Date(lastIso) : null
    const computed = computeCustomerCareWindow({
      lastInboundAt,
      now: new Date()
    })

    return {
      ...computed,
      lastInboundAt: lastIso
    }
  } catch (err: any) {
    logger.warn('[whatsapp-session-window.service] Excecao', { error: err?.message })
    const fallback = computeCustomerCareWindow({ lastInboundAt: null, now: new Date() })
    return { ...fallback, lastInboundAt: null }
  }
}
