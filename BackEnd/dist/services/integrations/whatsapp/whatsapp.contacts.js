"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrUpdateContact = createOrUpdateContact;
exports.getContactByLid = getContactByLid;
exports.getContactByPhoneNumber = getContactByPhoneNumber;
exports.updateContactPhoneNumber = updateContactPhoneNumber;
const supabase_1 = require("../../../lib/supabase");
const logger_1 = __importDefault(require("../../../lib/logger"));
/**
 * Cria ou atualiza um contato WhatsApp
 * Se o LID já existir, atualiza; senão, cria novo
 */
async function createOrUpdateContact(data) {
    try {
        // Normaliza o LID (remove @lid se presente, mas mantém o ID)
        const normalizedLid = data.lid.replace(/@lid$/, '').trim();
        if (!normalizedLid) {
            return {
                success: false,
                error: 'LID é obrigatório'
            };
        }
        logger_1.default.log('[createOrUpdateContact] Criando/atualizando contato:', {
            lid: normalizedLid,
            phone_number: data.phone_number,
            status: data.status || 'awaiting_phone'
        });
        // Busca contato existente pelo LID
        const { data: existingContact, error: findError } = await supabase_1.supabase
            .from('tb_whatsapp_contacts')
            .select('*')
            .eq('lid', normalizedLid)
            .maybeSingle();
        if (findError && findError.code !== 'PGRST116') { // PGRST116 = not found (ok)
            logger_1.default.error('[createOrUpdateContact] ❌ Erro ao buscar contato:', {
                error: findError.message
            });
            return {
                success: false,
                error: findError.message
            };
        }
        const updateData = {
            updated_at: new Date().toISOString()
        };
        // Se tem phone_number, atualiza
        if (data.phone_number) {
            // Normaliza o número (remove @s.whatsapp.net se presente)
            const normalizedPhone = data.phone_number.replace(/@s\.whatsapp\.net$/, '').trim();
            updateData.phone_number = normalizedPhone;
            // Se tinha status 'awaiting_phone', muda para 'active'
            if (!data.status && existingContact?.status === 'awaiting_phone') {
                updateData.status = 'active';
            }
        }
        // Se status foi fornecido, atualiza
        if (data.status) {
            updateData.status = data.status;
        }
        if (existingContact) {
            // Atualiza contato existente
            const { data: updatedContact, error: updateError } = await supabase_1.supabase
                .from('tb_whatsapp_contacts')
                .update(updateData)
                .eq('id', existingContact.id)
                .select()
                .single();
            if (updateError) {
                logger_1.default.error('[createOrUpdateContact] ❌ Erro ao atualizar contato:', {
                    error: updateError.message
                });
                return {
                    success: false,
                    error: updateError.message
                };
            }
            logger_1.default.log('[createOrUpdateContact] ✅ Contato atualizado:', {
                id: updatedContact.id,
                lid: updatedContact.lid,
                phone_number: updatedContact.phone_number,
                status: updatedContact.status
            });
            return {
                success: true,
                contact: updatedContact
            };
        }
        else {
            // Cria novo contato
            const insertData = {
                lid: normalizedLid,
                phone_number: data.phone_number ? data.phone_number.replace(/@s\.whatsapp\.net$/, '').trim() : null,
                status: data.status || 'awaiting_phone'
            };
            const { data: newContact, error: insertError } = await supabase_1.supabase
                .from('tb_whatsapp_contacts')
                .insert(insertData)
                .select()
                .single();
            if (insertError) {
                logger_1.default.error('[createOrUpdateContact] ❌ Erro ao criar contato:', {
                    error: insertError.message
                });
                return {
                    success: false,
                    error: insertError.message
                };
            }
            logger_1.default.log('[createOrUpdateContact] ✅ Contato criado:', {
                id: newContact.id,
                lid: newContact.lid,
                phone_number: newContact.phone_number,
                status: newContact.status
            });
            return {
                success: true,
                contact: newContact
            };
        }
    }
    catch (error) {
        logger_1.default.error('[createOrUpdateContact] ❌ Erro:', {
            message: error?.message,
            stack: error?.stack
        });
        return {
            success: false,
            error: error?.message || 'Erro desconhecido ao criar/atualizar contato'
        };
    }
}
/**
 * Busca um contato pelo LID
 */
async function getContactByLid(lid) {
    try {
        const normalizedLid = lid.replace(/@lid$/, '').trim();
        const { data: contact, error } = await supabase_1.supabase
            .from('tb_whatsapp_contacts')
            .select('*')
            .eq('lid', normalizedLid)
            .maybeSingle();
        if (error && error.code !== 'PGRST116') {
            return {
                success: false,
                error: error.message
            };
        }
        return {
            success: true,
            contact: contact
        };
    }
    catch (error) {
        logger_1.default.error('[getContactByLid] ❌ Erro:', {
            message: error?.message
        });
        return {
            success: false,
            error: error?.message
        };
    }
}
/**
 * Busca um contato pelo número de telefone
 * Normaliza o número removendo todos os sufixos e comparando apenas os dígitos
 */
async function getContactByPhoneNumber(phoneNumber) {
    try {
        // Normaliza o número: remove sufixos (@s.whatsapp.net, @lid, etc) e mantém apenas dígitos
        let normalizedPhone = phoneNumber
            .replace(/@s\.whatsapp\.net$/i, '') // Remove @s.whatsapp.net
            .replace(/@lid$/i, '') // Remove @lid
            .replace(/@.*$/, '') // Remove qualquer outro sufixo
            .trim();
        // Remove todos os caracteres não numéricos para comparação
        const digitsOnly = normalizedPhone.replace(/\D/g, '');
        logger_1.default.log('[getContactByPhoneNumber] 🔍 Buscando contato pelo número:', {
            original: phoneNumber,
            normalized: normalizedPhone,
            digitsOnly: digitsOnly
        });
        // Tenta buscar pelo número normalizado (com sufixos removidos)
        let { data: contact, error } = await supabase_1.supabase
            .from('tb_whatsapp_contacts')
            .select('*')
            .eq('phone_number', normalizedPhone)
            .maybeSingle();
        // Se não encontrou, tenta buscar apenas pelos dígitos (caso o número no banco tenha formatação diferente)
        if (!contact && digitsOnly) {
            logger_1.default.log('[getContactByPhoneNumber] 🔍 Tentando buscar apenas pelos dígitos...');
            // Busca todos os contatos e filtra pelos dígitos
            const { data: allContacts, error: allError } = await supabase_1.supabase
                .from('tb_whatsapp_contacts')
                .select('*')
                .not('phone_number', 'is', null);
            if (!allError && allContacts) {
                // Filtra contatos onde os dígitos do phone_number correspondem
                contact = allContacts.find((c) => {
                    if (!c.phone_number)
                        return false;
                    const contactDigits = String(c.phone_number).replace(/\D/g, '');
                    return contactDigits === digitsOnly;
                });
                if (contact) {
                    logger_1.default.log('[getContactByPhoneNumber] ✅ Contato encontrado pelos dígitos:', {
                        contactId: contact.id,
                        phone_number: contact.phone_number
                    });
                }
            }
        }
        if (error && error.code !== 'PGRST116') {
            logger_1.default.error('[getContactByPhoneNumber] ❌ Erro ao buscar contato:', {
                error: error.message,
                phoneNumber: normalizedPhone
            });
            return {
                success: false,
                error: error.message
            };
        }
        if (!contact) {
            logger_1.default.warn('[getContactByPhoneNumber] ⚠️ Contato não encontrado:', {
                original: phoneNumber,
                normalized: normalizedPhone,
                digitsOnly: digitsOnly
            });
        }
        else {
            logger_1.default.log('[getContactByPhoneNumber] ✅ Contato encontrado:', {
                contactId: contact.id,
                phone_number: contact.phone_number,
                status: contact.status
            });
        }
        return {
            success: true,
            contact: contact
        };
    }
    catch (error) {
        logger_1.default.error('[getContactByPhoneNumber] ❌ Erro:', {
            message: error?.message
        });
        return {
            success: false,
            error: error?.message
        };
    }
}
/**
 * Atualiza o número de telefone e status de um contato
 */
async function updateContactPhoneNumber(lid, phoneNumber) {
    try {
        const normalizedLid = lid.replace(/@lid$/, '').trim();
        const normalizedPhone = phoneNumber.replace(/@s\.whatsapp\.net$/, '').trim();
        logger_1.default.log('[updateContactPhoneNumber] Atualizando número do contato:', {
            lid: normalizedLid,
            phone_number: normalizedPhone
        });
        const { data: updatedContact, error } = await supabase_1.supabase
            .from('tb_whatsapp_contacts')
            .update({
            phone_number: normalizedPhone,
            status: 'active',
            updated_at: new Date().toISOString()
        })
            .eq('lid', normalizedLid)
            .select()
            .single();
        if (error) {
            logger_1.default.error('[updateContactPhoneNumber] ❌ Erro ao atualizar:', {
                error: error.message
            });
            return {
                success: false,
                error: error.message
            };
        }
        logger_1.default.log('[updateContactPhoneNumber] ✅ Contato atualizado:', {
            id: updatedContact.id,
            lid: updatedContact.lid,
            phone_number: updatedContact.phone_number,
            status: updatedContact.status
        });
        return {
            success: true,
            contact: updatedContact
        };
    }
    catch (error) {
        logger_1.default.error('[updateContactPhoneNumber] ❌ Erro:', {
            message: error?.message
        });
        return {
            success: false,
            error: error?.message
        };
    }
}
