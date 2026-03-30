import { supabase } from '../../../lib/supabase'
import logger from '../../../lib/logger'
import { getContactByLid, getContactByPhoneNumber } from './whatsapp.contacts'

export interface WhatsAppMessage {
  id?: string
  whatsapp_contact_id: string
  message: string
  message_id?: string
  direction: 'inbound' | 'outbound'
  integrations_id: string
  agent_id?: string
  is_read?: boolean
  created_at?: string
  metadata?: Record<string, any> | null
  contact?: {
    id: string
    lid: string
    phone_number: string | null
    status: string
  } | null
}

export interface SendWhatsAppInput {
  to: string
  message: string
  agentId?: string
  context?: Record<string, any>
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizePhoneDigits(value: string): string {
  return value
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/@.*$/, '')
    .replace(/\D/g, '')
    .trim()
}

async function getContactById(contactId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('tb_whatsapp_contacts')
    .select('id, lid, phone_number, status')
    .eq('id', contactId)
    .maybeSingle()

  if (error) {
    logger.error('[whatsapp.service] Erro ao buscar contato por ID', {
      contactId,
      error: error.message
    })
    return null
  }

  return data || null
}

async function resolveContact(reference: string): Promise<any | null> {
  const normalizedReference = String(reference || '').trim()

  if (!normalizedReference) {
    return null
  }

  if (isUuid(normalizedReference)) {
    return getContactById(normalizedReference)
  }

  if (normalizedReference.endsWith('@lid')) {
    const result = await getContactByLid(normalizedReference)
    return result.success ? result.contact || null : null
  }

  const phoneDigits = normalizePhoneDigits(normalizedReference)
  if (!phoneDigits) {
    return null
  }

  const result = await getContactByPhoneNumber(phoneDigits)
  return result.success ? result.contact || null : null
}

export async function saveWhatsAppMessage(data: {
  whatsapp_contact_id: string
  message: string
  message_id?: string
  direction: 'inbound' | 'outbound'
  integrations_id: string
  agent_id?: string
  metadata?: Record<string, any>
}): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const isRead = data.direction === 'outbound'

    const { data: savedData, error } = await supabase
      .from('tb_whatsapp_messages')
      .insert({
        whatsapp_contact_id: data.whatsapp_contact_id,
        message: data.message,
        message_id: data.message_id || null,
        direction: data.direction,
        integrations_id: data.integrations_id,
        agent_id: data.agent_id || null,
        is_read: isRead,
        metadata: data.metadata || {}
      })
      .select('id')
      .single()

    if (error) {
      logger.error('[saveWhatsAppMessage] Erro ao salvar mensagem', {
        error: error.message,
        direction: data.direction,
        integrationsId: data.integrations_id
      })
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      id: savedData?.id
    }
  } catch (error: any) {
    logger.error('[saveWhatsAppMessage] Erro inesperado', {
      error: error?.message
    })
    return {
      success: false,
      error: error?.message || 'Erro desconhecido ao salvar mensagem'
    }
  }
}

export async function getWhatsAppHistory(
  contactIdOrLid: string,
  integrationsId: string,
  limit: number = 10,
  agentId?: string,
  sinceTimestamp?: string
): Promise<WhatsAppMessage[]> {
  try {
    const contact = await resolveContact(contactIdOrLid)
    if (!contact?.id) {
      return []
    }

    let query = supabase
      .from('tb_whatsapp_messages')
      .select('*')
      .eq('whatsapp_contact_id', contact.id)
      .eq('integrations_id', integrationsId)

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    if (sinceTimestamp) {
      query = query.gte('created_at', sinceTimestamp)
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      logger.error('[getWhatsAppHistory] Erro ao buscar historico', {
        integrationsId,
        contactIdOrLid,
        error: error.message
      })
      return []
    }

    return ((data || []) as WhatsAppMessage[]).reverse()
  } catch (error: any) {
    logger.error('[getWhatsAppHistory] Erro inesperado', {
      error: error?.message
    })
    return []
  }
}

export async function getAllUnreadMessages(
  integrationsId: string,
  agentId?: string
): Promise<WhatsAppMessage[]> {
  try {
    let query = supabase
      .from('tb_whatsapp_messages')
      .select('*')
      .eq('integrations_id', integrationsId)
      .eq('is_read', false)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    const { data, error } = await query

    if (error) {
      logger.error('[getAllUnreadMessages] Erro ao buscar mensagens nao lidas', {
        integrationsId,
        agentId,
        error: error.message
      })
      return []
    }

    const unreadMessages = (data || []) as WhatsAppMessage[]
    if (unreadMessages.length === 0) {
      return []
    }

    const contactIds = [...new Set(unreadMessages.map(message => message.whatsapp_contact_id).filter(Boolean))]
    const contactsMap = new Map<string, any>()

    if (contactIds.length > 0) {
      const { data: contacts, error: contactsError } = await supabase
        .from('tb_whatsapp_contacts')
        .select('id, lid, phone_number, status')
        .in('id', contactIds)

      if (!contactsError && contacts) {
        for (const contact of contacts) {
          contactsMap.set(contact.id, contact)
        }
      }
    }

    const lastMessageByContact = new Map<string, WhatsAppMessage>()
    for (const message of unreadMessages) {
      if (!lastMessageByContact.has(message.whatsapp_contact_id)) {
        lastMessageByContact.set(message.whatsapp_contact_id, {
          ...message,
          contact: contactsMap.get(message.whatsapp_contact_id) || null
        })
      }
    }

    return Array.from(lastMessageByContact.values()).sort((left, right) => {
      const leftTime = new Date(left.created_at || 0).getTime()
      const rightTime = new Date(right.created_at || 0).getTime()
      return rightTime - leftTime
    })
  } catch (error: any) {
    logger.error('[getAllUnreadMessages] Erro inesperado', {
      error: error?.message
    })
    return []
  }
}

export async function getContactNumberForSending(
  contactIdOrLid: string,
  integrationsId: string
): Promise<{ success: boolean; number?: string; error?: string }> {
  try {
    const normalizedReference = String(contactIdOrLid || '').trim()
    if (!normalizedReference) {
      return {
        success: false,
        error: 'Contato de destino nao informado'
      }
    }

    if (normalizedReference.endsWith('@s.whatsapp.net')) {
      const digits = normalizePhoneDigits(normalizedReference)
      return digits
        ? { success: true, number: digits }
        : { success: false, error: 'Numero de destino invalido' }
    }

    const directDigits = normalizePhoneDigits(normalizedReference)
    if (directDigits && !isUuid(normalizedReference) && !normalizedReference.endsWith('@lid')) {
      return { success: true, number: directDigits }
    }

    const contact = await resolveContact(normalizedReference)
    if (!contact) {
      logger.warn('[getContactNumberForSending] Contato nao encontrado', {
        contactIdOrLid: normalizedReference,
        integrationsId
      })
      return {
        success: false,
        error: 'Contato nao encontrado'
      }
    }

    const contactDigits = normalizePhoneDigits(String(contact.phone_number || ''))
    if (!contactDigits) {
      return {
        success: false,
        error: 'Contato nao possui numero de telefone ativo para envio via Meta'
      }
    }

    return {
      success: true,
      number: contactDigits
    }
  } catch (error: any) {
    logger.error('[getContactNumberForSending] Erro inesperado', {
      contactIdOrLid,
      integrationsId,
      error: error?.message
    })
    return {
      success: false,
      error: error?.message || 'Erro desconhecido ao resolver contato'
    }
  }
}

export async function markMessagesAsRead(
  contactReference: string,
  integrationsId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const contact = await resolveContact(contactReference)
    if (!contact?.id) {
      return {
        success: false,
        error: 'Contato nao encontrado para marcacao de leitura'
      }
    }

    const { error } = await supabase
      .from('tb_whatsapp_messages')
      .update({ is_read: true })
      .eq('whatsapp_contact_id', contact.id)
      .eq('integrations_id', integrationsId)
      .eq('is_read', false)

    if (error) {
      logger.error('[markMessagesAsRead] Erro ao marcar mensagens como lidas', {
        contactReference,
        integrationsId,
        error: error.message
      })
      return {
        success: false,
        error: error.message
      }
    }

    return { success: true }
  } catch (error: any) {
    logger.error('[markMessagesAsRead] Erro inesperado', {
      contactReference,
      integrationsId,
      error: error?.message
    })
    return {
      success: false,
      error: error?.message || 'Erro desconhecido ao marcar mensagens como lidas'
    }
  }
}
