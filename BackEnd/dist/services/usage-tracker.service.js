"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentAgentCount = getCurrentAgentCount;
exports.getActiveAgentCount = getActiveAgentCount;
exports.getCurrentMessageCount = getCurrentMessageCount;
exports.getLegacyContactConversationCount = getLegacyContactConversationCount;
exports.getCurrentMonthConversationCount = getCurrentMonthConversationCount;
exports.hasOpenServiceSession = hasOpenServiceSession;
exports.hasContactConversationThisMonth = hasContactConversationThisMonth;
exports.incrementMessageCount = incrementMessageCount;
const supabase_1 = require("../lib/supabase");
const logger_1 = __importDefault(require("../lib/logger"));
/**
 * Obtém o uso atual de agentes da empresa (todos os agentes)
 */
async function getCurrentAgentCount(companiesId) {
    try {
        const { count, error } = await supabase_1.supabase
            .from('tb_agents')
            .select('*', { count: 'exact', head: true })
            .eq('companies_id', companiesId);
        if (error) {
            logger_1.default.warn(`[getCurrentAgentCount] Erro ao contar agentes: ${error.message}`);
            return 0;
        }
        return count || 0;
    }
    catch (err) {
        logger_1.default.error('[getCurrentAgentCount] Erro:', err);
        return 0;
    }
}
/**
 * Obtém o número de agentes ATIVOS da empresa
 * status_id = 1 = ativo
 */
async function getActiveAgentCount(companiesId) {
    try {
        const { count, error } = await supabase_1.supabase
            .from('tb_agents')
            .select('*', { count: 'exact', head: true })
            .eq('companies_id', companiesId)
            .eq('status_id', 1); // ✅ Só conta agentes ATIVOS
        if (error) {
            logger_1.default.warn(`[getActiveAgentCount] Erro ao contar agentes ativos: ${error.message}`);
            return 0;
        }
        return count || 0;
    }
    catch (err) {
        logger_1.default.error('[getActiveAgentCount] Erro:', err);
        return 0;
    }
}
/**
 * Obtém o uso atual de mensagens da empresa no mês atual
 */
async function getCurrentMessageCount(companiesId) {
    try {
        // Obter início e fim do mês atual
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        // Buscar integrações da empresa
        const { data: integrations, error: intError } = await supabase_1.supabase
            .from('tb_integrations')
            .select('id')
            .eq('companies_id', companiesId);
        if (intError || !integrations || integrations.length === 0) {
            return 0;
        }
        const integrationIds = integrations.map(i => i.id);
        // Contar mensagens enviadas no mês atual
        const { count, error } = await supabase_1.supabase
            .from('tb_whatsapp_messages')
            .select('*', { count: 'exact', head: true })
            .in('integrations_id', integrationIds)
            .eq('direction', 'outbound')
            .gte('created_at', startOfMonth.toISOString())
            .lte('created_at', endOfMonth.toISOString());
        if (error) {
            logger_1.default.warn(`[getCurrentMessageCount] Erro ao contar mensagens: ${error.message}`);
            return 0;
        }
        return count || 0;
    }
    catch (err) {
        logger_1.default.error('[getCurrentMessageCount] Erro:', err);
        return 0;
    }
}
/**
 * Incrementa o contador de mensagens no mês atual
 * Atualiza ou cria registro em tb_usage_metrics
 */
function getCurrentMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
}
async function getCompanyIntegrationIds(companiesId) {
    const { data: integrations, error } = await supabase_1.supabase
        .from('tb_integrations')
        .select('id')
        .eq('companies_id', companiesId);
    if (error || !integrations?.length) {
        return [];
    }
    return integrations.map((row) => row.id);
}
/**
 * Contatos distintos com pelo menos uma mensagem (inbound ou outbound) no mês corrente.
 * @deprecated Contagem migrou para tb_service_sessions — use getMonthlyAtendimentoCount.
 */
async function getLegacyContactConversationCount(companiesId) {
    try {
        const integrationIds = await getCompanyIntegrationIds(companiesId);
        if (integrationIds.length === 0) {
            return 0;
        }
        const { start, end } = getCurrentMonthRange();
        const { data, error } = await supabase_1.supabase
            .from('tb_whatsapp_messages')
            .select('whatsapp_contact_id')
            .in('integrations_id', integrationIds)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString());
        if (error) {
            logger_1.default.warn(`[getCurrentMonthConversationCount] Erro: ${error.message}`);
            return 0;
        }
        const unique = new Set((data || [])
            .map((row) => String(row.whatsapp_contact_id || '').trim())
            .filter(Boolean));
        return unique.size;
    }
    catch (err) {
        logger_1.default.error('[getCurrentMonthConversationCount] Erro:', err);
        return 0;
    }
}
async function getCurrentMonthConversationCount(companiesId) {
    const { getMonthlyAtendimentoCount } = await Promise.resolve().then(() => __importStar(require('./service-session.service')));
    return getMonthlyAtendimentoCount(companiesId);
}
async function hasOpenServiceSession(companiesId, whatsappContactId, integrationId) {
    const contactId = String(whatsappContactId || '').trim();
    if (!contactId)
        return false;
    let query = supabase_1.supabase
        .from('tb_service_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('companies_id', companiesId)
        .eq('whatsapp_contact_id', contactId)
        .eq('status', 'open');
    if (integrationId) {
        query = query.eq('integrations_id', integrationId);
    }
    const { count, error } = await query;
    if (error) {
        logger_1.default.warn('[hasOpenServiceSession] Erro:', error.message);
        return false;
    }
    return (count || 0) > 0;
}
/** @deprecated Sessões substituem contagem por contato/mês */
async function hasContactConversationThisMonth(companiesId, whatsappContactId) {
    try {
        const contactId = String(whatsappContactId || '').trim();
        if (!contactId)
            return false;
        const integrationIds = await getCompanyIntegrationIds(companiesId);
        if (integrationIds.length === 0) {
            return false;
        }
        const { start, end } = getCurrentMonthRange();
        const { count, error } = await supabase_1.supabase
            .from('tb_whatsapp_messages')
            .select('*', { count: 'exact', head: true })
            .in('integrations_id', integrationIds)
            .eq('whatsapp_contact_id', contactId)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString());
        if (error) {
            logger_1.default.warn(`[hasContactConversationThisMonth] Erro: ${error.message}`);
            return false;
        }
        return (count || 0) > 0;
    }
    catch (err) {
        logger_1.default.error('[hasContactConversationThisMonth] Erro:', err);
        return false;
    }
}
async function incrementMessageCount(companiesId) {
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthStartISO = monthStart.toISOString().split('T')[0]; // YYYY-MM-DD
        // Primeiro, buscar registro existente
        const { data: existing, error: fetchError } = await supabase_1.supabase
            .from('tb_usage_metrics')
            .select('id, message_count')
            .eq('companies_id', companiesId)
            .eq('month_start', monthStartISO)
            .maybeSingle();
        if (fetchError && fetchError.code !== 'PGRST116') {
            // PGRST116 = no rows found (registro não existe)
            logger_1.default.warn(`[incrementMessageCount] Erro ao buscar métricas: ${fetchError.message}`);
        }
        // Se existe, atualizar incrementando
        if (existing) {
            const newCount = (existing.message_count || 0) + 1;
            const { error: updateError } = await supabase_1.supabase
                .from('tb_usage_metrics')
                .update({
                message_count: newCount,
                updated_at: new Date().toISOString()
            })
                .eq('id', existing.id);
            if (updateError) {
                logger_1.default.error(`[incrementMessageCount] Erro ao atualizar métricas: ${updateError.message}`);
                return;
            }
            logger_1.default.log(`[incrementMessageCount] ✅ Contador incrementado para ${companiesId} em ${monthStartISO} (${newCount})`);
        }
        else {
            // Se não existe, criar novo
            const { error: insertError } = await supabase_1.supabase
                .from('tb_usage_metrics')
                .insert({
                companies_id: companiesId,
                month_start: monthStartISO,
                message_count: 1,
                agent_count: 0 // Será atualizado separadamente se necessário
            })
                .select('id')
                .maybeSingle();
            if (insertError) {
                logger_1.default.error(`[incrementMessageCount] Erro ao criar métricas: ${insertError.message}`);
                return;
            }
            logger_1.default.log(`[incrementMessageCount] ✅ Métricas criadas para ${companiesId} em ${monthStartISO}`);
        }
    }
    catch (err) {
        logger_1.default.error('[incrementMessageCount] Erro inesperado:', err);
    }
}
