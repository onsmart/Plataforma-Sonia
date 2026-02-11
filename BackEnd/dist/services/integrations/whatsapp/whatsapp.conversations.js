"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrUpdateConversation = createOrUpdateConversation;
exports.linkLidToPhoneNumber = linkLidToPhoneNumber;
exports.getPendingConversations = getPendingConversations;
exports.getConversationByIdentifier = getConversationByIdentifier;
const supabase_1 = require("../../../lib/supabase");
const logger_1 = __importDefault(require("../../../lib/logger"));
/**
 * Cria ou atualiza uma conversa baseada em LID ou número real
 */
async function createOrUpdateConversation(data) {
    try {
        const { lid, phone_number, integrations_id } = data;
        // Validação: precisa ter pelo menos um identificador
        if (!lid && !phone_number) {
            return {
                success: false,
                error: 'É necessário fornecer lid ou phone_number'
            };
        }
        logger_1.default.log('[createOrUpdateConversation] 🔍 Criando/atualizando conversa:', {
            lid,
            phone_number,
            integrations_id
        });
        // Se tem número real, status é ready
        // Se só tem LID, status é pending
        const status = phone_number ? 'ready' : 'pending';
        // Tenta buscar conversa existente por LID ou número
        let existingConversation = null;
        if (lid) {
            const { data: lidData, error: lidError } = await supabase_1.supabase
                .from('tb_whatsapp_conversations')
                .select('*')
                .eq('lid', lid)
                .eq('integrations_id', integrations_id)
                .single();
            if (!lidError && lidData) {
                existingConversation = lidData;
                logger_1.default.log('[createOrUpdateConversation] ✅ Conversa encontrada por LID:', {
                    id: existingConversation.id,
                    lid: existingConversation.lid
                });
            }
        }
        if (!existingConversation && phone_number) {
            const { data: phoneData, error: phoneError } = await supabase_1.supabase
                .from('tb_whatsapp_conversations')
                .select('*')
                .eq('phone_number', phone_number)
                .eq('integrations_id', integrations_id)
                .single();
            if (!phoneError && phoneData) {
                existingConversation = phoneData;
                logger_1.default.log('[createOrUpdateConversation] ✅ Conversa encontrada por número:', {
                    id: existingConversation.id,
                    phone_number: existingConversation.phone_number
                });
            }
        }
        if (existingConversation) {
            // Atualiza conversa existente
            const updateData = {
                status
            };
            // Se a conversa tinha só LID e agora temos número, atualiza
            if (phone_number && !existingConversation.phone_number) {
                updateData.phone_number = phone_number;
                updateData.status = 'ready';
                logger_1.default.log('[createOrUpdateConversation] 🔄 Atualizando: LID vinculado ao número real:', {
                    lid: existingConversation.lid,
                    phone_number
                });
            }
            // Se a conversa tinha só número e agora temos LID, atualiza
            if (lid && !existingConversation.lid) {
                updateData.lid = lid;
                logger_1.default.log('[createOrUpdateConversation] 🔄 Atualizando: número vinculado ao LID:', {
                    phone_number: existingConversation.phone_number,
                    lid
                });
            }
            const { data: updatedData, error: updateError } = await supabase_1.supabase
                .from('tb_whatsapp_conversations')
                .update(updateData)
                .eq('id', existingConversation.id)
                .select()
                .single();
            if (updateError) {
                logger_1.default.error('[createOrUpdateConversation] ❌ Erro ao atualizar conversa:', {
                    error: updateError.message,
                    conversationId: existingConversation.id
                });
                return {
                    success: false,
                    error: updateError.message
                };
            }
            logger_1.default.log('[createOrUpdateConversation] ✅ Conversa atualizada:', {
                id: updatedData.id,
                status: updatedData.status,
                hasLid: !!updatedData.lid,
                hasPhone: !!updatedData.phone_number
            });
            return {
                success: true,
                conversation: updatedData
            };
        }
        else {
            // Cria nova conversa
            const insertData = {
                integrations_id,
                status
            };
            if (lid)
                insertData.lid = lid;
            if (phone_number)
                insertData.phone_number = phone_number;
            const { data: newData, error: insertError } = await supabase_1.supabase
                .from('tb_whatsapp_conversations')
                .insert(insertData)
                .select()
                .single();
            if (insertError) {
                logger_1.default.error('[createOrUpdateConversation] ❌ Erro ao criar conversa:', {
                    error: insertError.message
                });
                return {
                    success: false,
                    error: insertError.message
                };
            }
            logger_1.default.log('[createOrUpdateConversation] ✅ Nova conversa criada:', {
                id: newData.id,
                status: newData.status,
                hasLid: !!newData.lid,
                hasPhone: !!newData.phone_number
            });
            return {
                success: true,
                conversation: newData
            };
        }
    }
    catch (error) {
        logger_1.default.error('[createOrUpdateConversation] ❌ Erro:', {
            message: error?.message,
            stack: error?.stack
        });
        return {
            success: false,
            error: error?.message || 'Erro desconhecido ao criar/atualizar conversa'
        };
    }
}
/**
 * Vincula LID ao número real quando o número aparecer em eventos de chat
 */
async function linkLidToPhoneNumber(lid, phone_number, integrations_id) {
    try {
        logger_1.default.log('[linkLidToPhoneNumber] 🔗 Vinculando LID ao número real:', {
            lid,
            phone_number,
            integrations_id
        });
        // Busca conversa pelo LID
        const { data: conversation, error: findError } = await supabase_1.supabase
            .from('tb_whatsapp_conversations')
            .select('*')
            .eq('lid', lid)
            .eq('integrations_id', integrations_id)
            .single();
        if (findError || !conversation) {
            // Se não encontrou, cria nova conversa
            logger_1.default.log('[linkLidToPhoneNumber] ℹ️ Conversa não encontrada por LID, criando nova:', {
                lid
            });
            return await createOrUpdateConversation({
                lid,
                phone_number,
                integrations_id
            });
        }
        // Atualiza conversa existente
        const { data: updatedData, error: updateError } = await supabase_1.supabase
            .from('tb_whatsapp_conversations')
            .update({
            phone_number,
            status: 'ready'
        })
            .eq('id', conversation.id)
            .select()
            .single();
        if (updateError) {
            logger_1.default.error('[linkLidToPhoneNumber] ❌ Erro ao vincular LID:', {
                error: updateError.message
            });
            return {
                success: false,
                error: updateError.message
            };
        }
        logger_1.default.log('[linkLidToPhoneNumber] ✅ LID vinculado ao número real:', {
            conversationId: updatedData.id,
            lid,
            phone_number,
            status: updatedData.status
        });
        return {
            success: true,
            conversation: updatedData
        };
    }
    catch (error) {
        logger_1.default.error('[linkLidToPhoneNumber] ❌ Erro:', {
            message: error?.message
        });
        return {
            success: false,
            error: error?.message || 'Erro desconhecido ao vincular LID'
        };
    }
}
/**
 * Busca conversas pendentes que precisam ser processadas
 */
async function getPendingConversations(integrations_id, limit = 10) {
    try {
        let query = supabase_1.supabase
            .from('tb_whatsapp_conversations')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(limit);
        if (integrations_id) {
            query = query.eq('integrations_id', integrations_id);
        }
        const { data, error } = await query;
        if (error) {
            logger_1.default.error('[getPendingConversations] ❌ Erro ao buscar conversas pendentes:', {
                error: error.message
            });
            return {
                success: false,
                error: error.message
            };
        }
        logger_1.default.log('[getPendingConversations] ✅ Conversas pendentes encontradas:', {
            count: data?.length || 0
        });
        return {
            success: true,
            conversations: (data || [])
        };
    }
    catch (error) {
        logger_1.default.error('[getPendingConversations] ❌ Erro:', {
            message: error?.message
        });
        return {
            success: false,
            error: error?.message || 'Erro desconhecido ao buscar conversas pendentes'
        };
    }
}
/**
 * Busca conversa por LID ou número
 */
async function getConversationByIdentifier(identifier, integrations_id) {
    try {
        const isLid = identifier.endsWith('@lid');
        const isPhone = identifier.endsWith('@s.whatsapp.net');
        let query = supabase_1.supabase
            .from('tb_whatsapp_conversations')
            .select('*')
            .eq('integrations_id', integrations_id);
        if (isLid) {
            query = query.eq('lid', identifier);
        }
        else if (isPhone) {
            query = query.eq('phone_number', identifier);
        }
        else {
            // Tenta ambos
            query = query.or(`lid.eq.${identifier},phone_number.eq.${identifier}`);
        }
        const { data, error } = await query.single();
        if (error || !data) {
            return {
                success: false,
                error: 'Conversa não encontrada'
            };
        }
        return {
            success: true,
            conversation: data
        };
    }
    catch (error) {
        return {
            success: false,
            error: error?.message || 'Erro ao buscar conversa'
        };
    }
}
