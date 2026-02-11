"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveMessageToHistory = saveMessageToHistory;
exports.getHistoryFromRedis = getHistoryFromRedis;
exports.getUnreadConversations = getUnreadConversations;
exports.clearHistory = clearHistory;
exports.markConversationAsRead = markConversationAsRead;
exports.saveLidToRealNumberMapping = saveLidToRealNumberMapping;
exports.getRealNumberFromLid = getRealNumberFromLid;
const redis_1 = require("../../../lib/redis");
const logger_1 = __importDefault(require("../../../lib/logger"));
const MAX_HISTORY_MESSAGES = 20;
const DEFAULT_TTL = parseInt(process.env.WHATSAPP_HISTORY_TTL || '86400', 10); // 24 horas padrão
/**
 * Gera a chave Redis para uma conversa
 */
function getConversationKey(integrationId, phoneNumber) {
    // Normaliza o número (remove caracteres não numéricos)
    const normalizedPhone = phoneNumber.replace(/\D/g, '');
    return `whatsapp:conversation:${integrationId}:${normalizedPhone}`;
}
/**
 * Salva uma mensagem no histórico Redis
 * @param integrationId - ID da integração
 * @param phoneNumber - Número de telefone
 * @param role - 'user' ou 'assistant'
 * @param content - Conteúdo da mensagem
 */
async function saveMessageToHistory(integrationId, phoneNumber, role, content) {
    try {
        if (!content || content.trim() === '') {
            logger_1.default.warn('[saveMessageToHistory] ⚠️ Mensagem vazia, ignorando');
            return { success: true }; // Não é erro, apenas ignora
        }
        const client = await (0, redis_1.getRedisClient)();
        const key = getConversationKey(integrationId, phoneNumber);
        // Busca histórico atual
        const existingHistory = await getHistoryFromRedis(integrationId, phoneNumber);
        // Adiciona nova mensagem
        const newMessage = {
            role,
            content: content.trim(),
            timestamp: Date.now()
        };
        const updatedHistory = [...existingHistory, newMessage];
        // Mantém apenas as últimas MAX_HISTORY_MESSAGES mensagens
        const trimmedHistory = updatedHistory.slice(-MAX_HISTORY_MESSAGES);
        // Salva no Redis com TTL
        await client.setEx(key, DEFAULT_TTL, JSON.stringify(trimmedHistory));
        logger_1.default.log('[saveMessageToHistory] ✅ Mensagem salva no Redis:', {
            integrationId,
            phoneNumber: phoneNumber.replace(/\D/g, ''),
            role,
            contentLength: content.length,
            totalMessages: trimmedHistory.length
        });
        return { success: true };
    }
    catch (error) {
        logger_1.default.error('[saveMessageToHistory] ❌ Erro ao salvar no Redis:', {
            error: error.message,
            stack: error.stack
        });
        return {
            success: false,
            error: error.message || 'Erro ao salvar mensagem no Redis'
        };
    }
}
/**
 * Busca histórico de conversa do Redis
 * @param integrationId - ID da integração
 * @param phoneNumber - Número de telefone
 * @param limit - Limite de mensagens (padrão: todas)
 */
async function getHistoryFromRedis(integrationId, phoneNumber, limit) {
    try {
        const client = await (0, redis_1.getRedisClient)();
        const key = getConversationKey(integrationId, phoneNumber);
        const data = await client.get(key);
        if (!data) {
            logger_1.default.log('[getHistoryFromRedis] 📭 Nenhum histórico encontrado:', {
                integrationId,
                phoneNumber: phoneNumber.replace(/\D/g, '')
            });
            return [];
        }
        const history = JSON.parse(data);
        // Aplica limite se fornecido
        const limitedHistory = limit ? history.slice(-limit) : history;
        logger_1.default.log('[getHistoryFromRedis] ✅ Histórico encontrado:', {
            integrationId,
            phoneNumber: phoneNumber.replace(/\D/g, ''),
            totalMessages: history.length,
            returnedMessages: limitedHistory.length
        });
        return limitedHistory;
    }
    catch (error) {
        logger_1.default.error('[getHistoryFromRedis] ❌ Erro ao buscar do Redis:', {
            error: error.message
        });
        return [];
    }
}
/**
 * Busca todas as conversas não lidas (com mensagens de usuário não respondidas)
 * Retorna lista de números com mensagens não lidas
 */
async function getUnreadConversations(integrationId) {
    try {
        const client = await (0, redis_1.getRedisClient)();
        const pattern = `whatsapp:conversation:${integrationId}:*`;
        // Busca todas as chaves que correspondem ao padrão
        const keys = await client.keys(pattern);
        const unreadNumbers = [];
        for (const key of keys) {
            const data = await client.get(key);
            if (!data)
                continue;
            const history = JSON.parse(data);
            // Verifica se a última mensagem é do usuário (não respondida)
            if (history.length > 0 && history[history.length - 1].role === 'user') {
                // Extrai o número da chave
                const phoneNumber = key.split(':').pop() || '';
                if (phoneNumber) {
                    unreadNumbers.push(phoneNumber);
                }
            }
        }
        logger_1.default.log('[getUnreadConversations] ✅ Conversas não lidas encontradas:', {
            integrationId,
            count: unreadNumbers.length
        });
        return unreadNumbers;
    }
    catch (error) {
        logger_1.default.error('[getUnreadConversations] ❌ Erro:', {
            error: error.message
        });
        return [];
    }
}
/**
 * Limpa o histórico de uma conversa
 */
async function clearHistory(integrationId, phoneNumber) {
    try {
        const client = await (0, redis_1.getRedisClient)();
        const key = getConversationKey(integrationId, phoneNumber);
        await client.del(key);
        logger_1.default.log('[clearHistory] ✅ Histórico limpo:', {
            integrationId,
            phoneNumber: phoneNumber.replace(/\D/g, '')
        });
        return { success: true };
    }
    catch (error) {
        logger_1.default.error('[clearHistory] ❌ Erro:', {
            error: error.message
        });
        return {
            success: false,
            error: error.message
        };
    }
}
/**
 * Marca mensagens como lidas (remove última mensagem do usuário se não foi respondida)
 * Na prática, isso significa que a próxima mensagem do assistente vai "responder" a anterior
 */
async function markConversationAsRead(integrationId, phoneNumber) {
    try {
        const history = await getHistoryFromRedis(integrationId, phoneNumber);
        // Se a última mensagem é do usuário, não faz nada (já está "não lida")
        // A marcação como lida acontece quando o assistente responde
        // Então esta função é mais para compatibilidade
        logger_1.default.log('[markConversationAsRead] ✅ Conversa processada:', {
            integrationId,
            phoneNumber: phoneNumber.replace(/\D/g, ''),
            totalMessages: history.length
        });
        return { success: true };
    }
    catch (error) {
        logger_1.default.error('[markConversationAsRead] ❌ Erro:', {
            error: error.message
        });
        return {
            success: false,
            error: error.message
        };
    }
}
/**
 * Gera a chave Redis para mapeamento LID → número real
 */
function getLidMappingKey(lid) {
    // Remove sufixos para normalizar
    const normalizedLid = lid.replace(/@lid$/, '').replace(/\D/g, '');
    return `whatsapp:lid_mapping:${normalizedLid}`;
}
/**
 * Salva o mapeamento LID → número real no Redis
 * @param lid - O LID (ex: "145479333621989@lid")
 * @param realPhoneNumber - O número real (ex: "5511999241987@s.whatsapp.net" ou "5511999241987")
 */
async function saveLidToRealNumberMapping(lid, realPhoneNumber) {
    try {
        const client = await (0, redis_1.getRedisClient)();
        // Normaliza o LID (remove @lid e caracteres não numéricos)
        const normalizedLid = lid.replace(/@lid$/, '').replace(/\D/g, '');
        // Normaliza o número real (garante que tenha @s.whatsapp.net)
        let normalizedRealNumber = realPhoneNumber;
        if (!normalizedRealNumber.includes('@')) {
            normalizedRealNumber = `${normalizedRealNumber}@s.whatsapp.net`;
        }
        const key = getLidMappingKey(normalizedLid);
        // Salva com TTL de 7 dias (604800 segundos)
        await client.setEx(key, 604800, normalizedRealNumber);
        console.log('\n' + '='.repeat(80));
        console.log('💾 [saveLidToRealNumberMapping] MAPEAMENTO SALVO NO REDIS:');
        console.log('='.repeat(80));
        console.log('LID:', lid);
        console.log('LID Normalizado:', normalizedLid);
        console.log('Número Real:', realPhoneNumber);
        console.log('Número Real Normalizado:', normalizedRealNumber);
        console.log('Chave Redis:', key);
        console.log('TTL: 7 dias (604800 segundos)');
        console.log('='.repeat(80) + '\n');
        logger_1.default.log('[saveLidToRealNumberMapping] ✅ Mapeamento salvo:', {
            lid,
            normalizedLid,
            realPhoneNumber,
            normalizedRealNumber
        });
        return { success: true };
    }
    catch (error) {
        logger_1.default.error('[saveLidToRealNumberMapping] ❌ Erro ao salvar mapeamento:', {
            error: error.message,
            lid
        });
        return {
            success: false,
            error: error.message
        };
    }
}
/**
 * Busca o número real correspondente a um LID
 * @param lid - O LID (ex: "145479333621989@lid" ou "145479333621989")
 * @returns O número real com @s.whatsapp.net ou null se não encontrado
 */
async function getRealNumberFromLid(lid) {
    try {
        const client = await (0, redis_1.getRedisClient)();
        // Normaliza o LID
        const normalizedLid = lid.replace(/@lid$/, '').replace(/\D/g, '');
        const key = getLidMappingKey(normalizedLid);
        const realNumber = await client.get(key);
        if (realNumber) {
            console.log('\n' + '='.repeat(80));
            console.log('🔍 [getRealNumberFromLid] MAPEAMENTO ENCONTRADO NO REDIS:');
            console.log('='.repeat(80));
            console.log('LID Buscado:', lid);
            console.log('LID Normalizado:', normalizedLid);
            console.log('Número Real Encontrado:', realNumber);
            console.log('Chave Redis:', key);
            console.log('='.repeat(80) + '\n');
            logger_1.default.log('[getRealNumberFromLid] ✅ Mapeamento encontrado:', {
                lid,
                normalizedLid,
                realNumber
            });
            return realNumber;
        }
        console.log('\n' + '='.repeat(80));
        console.log('⚠️ [getRealNumberFromLid] MAPEAMENTO NÃO ENCONTRADO:');
        console.log('='.repeat(80));
        console.log('LID Buscado:', lid);
        console.log('LID Normalizado:', normalizedLid);
        console.log('Chave Redis:', key);
        console.log('='.repeat(80) + '\n');
        logger_1.default.log('[getRealNumberFromLid] ⚠️ Mapeamento não encontrado:', {
            lid,
            normalizedLid
        });
        return null;
    }
    catch (error) {
        logger_1.default.error('[getRealNumberFromLid] ❌ Erro ao buscar mapeamento:', {
            error: error.message,
            lid
        });
        return null;
    }
}
