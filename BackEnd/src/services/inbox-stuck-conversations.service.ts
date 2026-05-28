import { supabase } from '../lib/supabase'
import logger from '../lib/logger'
import { getCompanyIdByEmail } from '../utils/company-helper'

export type StuckConversationReason = 'unassigned' | 'plan_limit_atendimentos'

export type StuckWhatsAppConversation = {
  message_id: string
  whatsapp_contact_id: string
  last_message: string
  last_message_at: string
  integrations_id: string
  stuck_reason: StuckConversationReason
  stuck_detail?: string
  phone_number?: string | null
  conversations_used?: number
  conversations_limit?: number | null
}

function normalizeRpcRow(row: Record<string, unknown>): StuckWhatsAppConversation | null {
  const messageId = String(row.message_id || row.id || '').trim()
  const contactId = String(row.whatsapp_contact_id || '').trim()
  const integrationsId = String(row.integrations_id || '').trim()
  if (!messageId || !contactId || !integrationsId) return null

  return {
    message_id: messageId,
    whatsapp_contact_id: contactId,
    last_message: String(row.last_message || ''),
    last_message_at: String(row.last_message_at || row.created_at || new Date().toISOString()),
    integrations_id: integrationsId,
    stuck_reason: 'unassigned',
    phone_number: row.phone_number != null ? String(row.phone_number) : null,
  }
}

async function listUnassignedFromRpc(email: string): Promise<StuckWhatsAppConversation[]> {
  const { data, error } = await supabase.rpc('sp_list_unassigned_whatsapp_conversations', {
    p_email: email.trim(),
  })

  if (error) {
    logger.warn('[inbox-stuck] RPC sp_list_unassigned_whatsapp_conversations falhou', {
      error: error.message,
    })
    return []
  }

  const rows = Array.isArray(data) ? data : data ? [data] : []
  return rows
    .map((row) => normalizeRpcRow(row as Record<string, unknown>))
    .filter((row): row is StuckWhatsAppConversation => Boolean(row))
}

async function listPlanLimitBlocked(companiesId: string): Promise<StuckWhatsAppConversation[]> {
  const { data: integrations, error: intError } = await supabase
    .from('tb_integrations')
    .select('id')
    .eq('companies_id', companiesId)

  if (intError) {
    logger.warn('[inbox-stuck] Erro ao buscar integrações', { error: intError.message })
    return []
  }

  const integrationIds = (integrations || []).map((row) => row.id).filter(Boolean)
  if (integrationIds.length === 0) return []

  const { data: messages, error: msgError } = await supabase
    .from('tb_whatsapp_messages')
    .select('id, whatsapp_contact_id, message, created_at, integrations_id, metadata')
    .in('integrations_id', integrationIds)
    .eq('direction', 'inbound')
    .contains('metadata', { block_reason: 'plan_limit_atendimentos' })
    .order('created_at', { ascending: false })
    .limit(500)

  if (msgError) {
    logger.warn('[inbox-stuck] Erro ao buscar mensagens bloqueadas por plano', {
      error: msgError.message,
    })
    return []
  }

  const contactIds = [
    ...new Set(
      (messages || [])
        .map((row) => String(row.whatsapp_contact_id || '').trim())
        .filter(Boolean)
    ),
  ]

  const contactById = new Map<string, { phone_number?: string; lid?: string }>()
  if (contactIds.length > 0) {
    const { data: contacts, error: contactError } = await supabase
      .from('tb_whatsapp_contacts')
      .select('id, phone_number, lid')
      .in('id', contactIds)

    if (contactError) {
      logger.warn('[inbox-stuck] Erro ao buscar contatos das mensagens bloqueadas', {
        error: contactError.message,
      })
    } else {
      for (const c of contacts || []) {
        contactById.set(String(c.id), {
          phone_number: c.phone_number != null ? String(c.phone_number) : undefined,
          lid: c.lid != null ? String(c.lid) : undefined,
        })
      }
    }
  }

  const byContact = new Map<string, StuckWhatsAppConversation>()

  for (const row of messages || []) {
    const contactId = String(row.whatsapp_contact_id || '').trim()
    if (!contactId || byContact.has(contactId)) continue

    const metadata =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {}

    const contact = contactById.get(contactId) ?? null

    byContact.set(contactId, {
      message_id: String(row.id),
      whatsapp_contact_id: contactId,
      last_message: String(row.message || ''),
      last_message_at: String(row.created_at || new Date().toISOString()),
      integrations_id: String(row.integrations_id),
      stuck_reason: 'plan_limit_atendimentos',
      stuck_detail: String(
        metadata.block_message ||
          'Limite mensal de atendimentos atingido. O agente não respondeu esta mensagem.'
      ),
      phone_number: contact?.phone_number || contact?.lid || null,
      conversations_used:
        typeof metadata.conversations_used === 'number'
          ? metadata.conversations_used
          : Number(metadata.conversations_used) || undefined,
      conversations_limit:
        metadata.conversations_limit === null
          ? null
          : typeof metadata.conversations_limit === 'number'
            ? metadata.conversations_limit
            : Number(metadata.conversations_limit) || undefined,
    })
  }

  return [...byContact.values()]
}

/**
 * Lista conversas travadas: fila manual (RPC) + bloqueadas por limite de plano.
 */
export async function listStuckWhatsAppConversations(
  email: string
): Promise<StuckWhatsAppConversation[]> {
  const companiesId = await getCompanyIdByEmail(email)
  const byContact = new Map<string, StuckWhatsAppConversation>()

  const unassigned = await listUnassignedFromRpc(email)
  for (const row of unassigned) {
    byContact.set(row.whatsapp_contact_id, row)
  }

  if (companiesId) {
    const planBlocked = await listPlanLimitBlocked(companiesId)
    for (const row of planBlocked) {
      byContact.set(row.whatsapp_contact_id, row)
    }
  }

  return [...byContact.values()].sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  )
}
