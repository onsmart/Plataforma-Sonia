import { supabase } from '../../../lib/supabase'
import logger from '../../../lib/logger'

export interface WhatsAppContact {
  id: string
  lid: string
  phone_number: string | null
  status: 'awaiting_phone' | 'active' | 'blocked'
  created_at: string
  updated_at: string
}

/**
 * Cria ou atualiza um contato WhatsApp
 * Se o LID já existir, atualiza; senão, cria novo
 */
export async function createOrUpdateContact(data: {
  lid: string
  phone_number?: string | null
  status?: 'awaiting_phone' | 'active' | 'blocked'
}): Promise<{ success: boolean; contact?: WhatsAppContact; error?: string }> {
  try {
    // Normaliza o LID (remove @lid se presente, mas mantém o ID)
    const normalizedLid = data.lid.replace(/@lid$/, '').trim()
    
    if (!normalizedLid) {
      return {
        success: false,
        error: 'LID é obrigatório'
      }
    }

    logger.log('[createOrUpdateContact] Criando/atualizando contato:', {
      lid: normalizedLid,
      phone_number: data.phone_number,
      status: data.status || 'awaiting_phone'
    })

    // Busca contato existente pelo LID
    const { data: existingContact, error: findError } = await supabase
      .from('tb_whatsapp_contacts')
      .select('*')
      .eq('lid', normalizedLid)
      .maybeSingle()

    if (findError && findError.code !== 'PGRST116') { // PGRST116 = not found (ok)
      logger.error('[createOrUpdateContact] ❌ Erro ao buscar contato:', {
        error: findError.message
      })
      return {
        success: false,
        error: findError.message
      }
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    // Se tem phone_number, atualiza
    if (data.phone_number) {
      // Normaliza o número (remove @s.whatsapp.net se presente)
      const normalizedPhone = data.phone_number.replace(/@s\.whatsapp\.net$/, '').trim()
      updateData.phone_number = normalizedPhone
      
      // Se tinha status 'awaiting_phone', muda para 'active'
      if (!data.status && existingContact?.status === 'awaiting_phone') {
        updateData.status = 'active'
      }
    }

    // Se status foi fornecido, atualiza
    if (data.status) {
      updateData.status = data.status
    }

    if (existingContact) {
      // Atualiza contato existente
      const { data: updatedContact, error: updateError } = await supabase
        .from('tb_whatsapp_contacts')
        .update(updateData)
        .eq('id', existingContact.id)
        .select()
        .single()

      if (updateError) {
        logger.error('[createOrUpdateContact] ❌ Erro ao atualizar contato:', {
          error: updateError.message
        })
        return {
          success: false,
          error: updateError.message
        }
      }

      logger.log('[createOrUpdateContact] ✅ Contato atualizado:', {
        id: updatedContact.id,
        lid: updatedContact.lid,
        phone_number: updatedContact.phone_number,
        status: updatedContact.status
      })

      return {
        success: true,
        contact: updatedContact as WhatsAppContact
      }
    } else {
      // Cria novo contato
      const insertData = {
        lid: normalizedLid,
        phone_number: data.phone_number ? data.phone_number.replace(/@s\.whatsapp\.net$/, '').trim() : null,
        status: data.status || 'awaiting_phone'
      }

      const { data: newContact, error: insertError } = await supabase
        .from('tb_whatsapp_contacts')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        logger.error('[createOrUpdateContact] ❌ Erro ao criar contato:', {
          error: insertError.message
        })
        return {
          success: false,
          error: insertError.message
        }
      }

      logger.log('[createOrUpdateContact] ✅ Contato criado:', {
        id: newContact.id,
        lid: newContact.lid,
        phone_number: newContact.phone_number,
        status: newContact.status
      })

      return {
        success: true,
        contact: newContact as WhatsAppContact
      }
    }
  } catch (error: any) {
    logger.error('[createOrUpdateContact] ❌ Erro:', {
      message: error?.message,
      stack: error?.stack
    })
    return {
      success: false,
      error: error?.message || 'Erro desconhecido ao criar/atualizar contato'
    }
  }
}

/**
 * Busca um contato pelo LID
 */
export async function getContactByLid(lid: string): Promise<{ success: boolean; contact?: WhatsAppContact; error?: string }> {
  try {
    const normalizedLid = lid.replace(/@lid$/, '').trim()

    const { data: contact, error } = await supabase
      .from('tb_whatsapp_contacts')
      .select('*')
      .eq('lid', normalizedLid)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      contact: contact as WhatsAppContact | undefined
    }
  } catch (error: any) {
    logger.error('[getContactByLid] ❌ Erro:', {
      message: error?.message
    })
    return {
      success: false,
      error: error?.message
    }
  }
}

/**
 * Busca um contato pelo número de telefone
 * Normaliza o número removendo todos os sufixos e comparando apenas os dígitos
 */
export async function getContactByPhoneNumber(phoneNumber: string): Promise<{ success: boolean; contact?: WhatsAppContact; error?: string }> {
  try {
    // Normaliza o número: remove sufixos (@s.whatsapp.net, @lid, etc) e mantém apenas dígitos
    let normalizedPhone = phoneNumber
      .replace(/@s\.whatsapp\.net$/i, '') // Remove @s.whatsapp.net
      .replace(/@lid$/i, '') // Remove @lid
      .replace(/@.*$/, '') // Remove qualquer outro sufixo
      .trim()
    
    // Remove todos os caracteres não numéricos para comparação
    const digitsOnly = normalizedPhone.replace(/\D/g, '')
    
    logger.log('[getContactByPhoneNumber] 🔍 Buscando contato pelo número:', {
      original: phoneNumber,
      normalized: normalizedPhone,
      digitsOnly: digitsOnly
    })

    // Tenta buscar pelo número normalizado (com sufixos removidos)
    let { data: contact, error } = await supabase
      .from('tb_whatsapp_contacts')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .maybeSingle()

    // Se não encontrou, tenta buscar apenas pelos dígitos (caso o número no banco tenha formatação diferente)
    if (!contact && digitsOnly) {
      logger.log('[getContactByPhoneNumber] 🔍 Tentando buscar apenas pelos dígitos...')
      
      // Busca todos os contatos e filtra pelos dígitos
      const { data: allContacts, error: allError } = await supabase
        .from('tb_whatsapp_contacts')
        .select('*')
        .not('phone_number', 'is', null)
      
      if (!allError && allContacts) {
        // Filtra contatos onde os dígitos do phone_number correspondem
        contact = allContacts.find((c: any) => {
          if (!c.phone_number) return false
          const contactDigits = String(c.phone_number).replace(/\D/g, '')
          return contactDigits === digitsOnly
        }) as WhatsAppContact | undefined
        
        if (contact) {
          logger.log('[getContactByPhoneNumber] ✅ Contato encontrado pelos dígitos:', {
            contactId: contact.id,
            phone_number: contact.phone_number
          })
        }
      }
    }

    if (error && error.code !== 'PGRST116') {
      logger.error('[getContactByPhoneNumber] ❌ Erro ao buscar contato:', {
        error: error.message,
        phoneNumber: normalizedPhone
      })
      return {
        success: false,
        error: error.message
      }
    }

    if (!contact) {
      logger.warn('[getContactByPhoneNumber] ⚠️ Contato não encontrado:', {
        original: phoneNumber,
        normalized: normalizedPhone,
        digitsOnly: digitsOnly
      })
    } else {
      logger.log('[getContactByPhoneNumber] ✅ Contato encontrado:', {
        contactId: contact.id,
        phone_number: contact.phone_number,
        status: contact.status
      })
    }

    return {
      success: true,
      contact: contact as WhatsAppContact | undefined
    }
  } catch (error: any) {
    logger.error('[getContactByPhoneNumber] ❌ Erro:', {
      message: error?.message
    })
    return {
      success: false,
      error: error?.message
    }
  }
}

/**
 * Atualiza o número de telefone e status de um contato
 */
export async function updateContactPhoneNumber(
  lid: string,
  phoneNumber: string
): Promise<{ success: boolean; contact?: WhatsAppContact; error?: string }> {
  try {
    const normalizedLid = lid.replace(/@lid$/, '').trim()
    const normalizedPhone = phoneNumber.replace(/@s\.whatsapp\.net$/, '').trim()

    logger.log('[updateContactPhoneNumber] Atualizando número do contato:', {
      lid: normalizedLid,
      phone_number: normalizedPhone
    })

    const { data: updatedContact, error } = await supabase
      .from('tb_whatsapp_contacts')
      .update({
        phone_number: normalizedPhone,
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('lid', normalizedLid)
      .select()
      .single()

    if (error) {
      logger.error('[updateContactPhoneNumber] ❌ Erro ao atualizar:', {
        error: error.message
      })
      return {
        success: false,
        error: error.message
      }
    }

    logger.log('[updateContactPhoneNumber] ✅ Contato atualizado:', {
      id: updatedContact.id,
      lid: updatedContact.lid,
      phone_number: updatedContact.phone_number,
      status: updatedContact.status
    })

    return {
      success: true,
      contact: updatedContact as WhatsAppContact
    }
  } catch (error: any) {
    logger.error('[updateContactPhoneNumber] ❌ Erro:', {
      message: error?.message
    })
    return {
      success: false,
      error: error?.message
    }
  }
}
