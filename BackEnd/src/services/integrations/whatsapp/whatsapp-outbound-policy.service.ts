import logger from '../../../lib/logger'
import { getCustomerCareWindowState } from './whatsapp-session-window.service'

/** Quando true, bloqueia envio de texto de sessão fora da janela (fase opcional; default desligado). */
export function isEnforceSessionWindowGlobally(): boolean {
  return String(process.env.WHATSAPP_ENFORCE_SESSION_WINDOW || '').toLowerCase() === 'true'
}

/**
 * Regra conservadora para texto livre (não template).
 * Não altera comportamento padrão enquanto WHATSAPP_ENFORCE_SESSION_WINDOW não estiver true.
 */
export async function assertCanSendSessionText(params: {
  integrationsId: string
  whatsappContactId: string
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!isEnforceSessionWindowGlobally()) {
    return { ok: true }
  }

  try {
    const state = await getCustomerCareWindowState(params.integrationsId, params.whatsappContactId)

    if (state.conservativeUnknown) {
      return {
        ok: false,
        reason:
          'Sem mensagem inbound registrada para este contato; fora da janela de atendimento exige template aprovado (politica conservadora).'
      }
    }

    if (!state.insideWindow) {
      return {
        ok: false,
        reason: 'Fora da janela de 24h desde a ultima mensagem do cliente; use template oficial aprovado pela Meta.'
      }
    }

    return { ok: true }
  } catch (err: any) {
    logger.warn('[whatsapp-outbound-policy] Falha ao avaliar janela; bloqueando texto por seguranca', {
      error: err?.message
    })
    return { ok: false, reason: 'Nao foi possivel validar a janela de atendimento; tente novamente ou use template.' }
  }
}
