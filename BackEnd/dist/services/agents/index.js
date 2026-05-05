"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentsByEmail = getAgentsByEmail;
const supabase_1 = require("../../lib/supabase");
const agent_language_1 = require("../../utils/agent-language");
const logger_1 = __importDefault(require("../../lib/logger"));
async function getAgentsByEmail(email) {
    logger_1.default.info('[getAgentsByEmail] Buscando agentes do usuario', {
        emailHash: email ? `[redacted chars=${email.length}]` : '',
    });
    const { data, error } = await supabase_1.supabase.rpc('fn_get_agents_with_api_key', { p_user_email: email });
    if (error) {
        logger_1.default.error('[getAgentsByEmail] Erro na RPC', {
            error: error.message,
            code: error.code,
        });
        throw new Error('Failed to fetch agents');
    }
    const normalizedAgents = Array.isArray(data) ? [...data] : [];
    if (normalizedAgents.length > 0) {
        const missingLanguageIds = normalizedAgents
            .filter(agent => !String(agent?.primary_language || '').trim())
            .map(agent => agent.id);
        if (missingLanguageIds.length > 0) {
            const { data: languageRows, error: languageError } = await supabase_1.supabase
                .from('tb_agents')
                .select('id, primary_language')
                .in('id', missingLanguageIds);
            if (languageError) {
                logger_1.default.warn('[getAgentsByEmail] Erro ao complementar primary_language', {
                    error: languageError.message,
                });
            }
            else if (Array.isArray(languageRows)) {
                const languageMap = new Map(languageRows.map(row => [row.id, row.primary_language]));
                for (const agent of normalizedAgents) {
                    const fallbackLanguage = languageMap.get(agent.id);
                    agent.primary_language = (0, agent_language_1.normalizeAgentLanguageCode)(agent.primary_language || fallbackLanguage, 'pt-BR');
                }
            }
        }
        for (const agent of normalizedAgents) {
            agent.primary_language = (0, agent_language_1.normalizeAgentLanguageCode)(agent.primary_language, 'pt-BR');
        }
    }
    logger_1.default.info('[getAgentsByEmail] Agentes retornados', {
        count: normalizedAgents.length || 0,
    });
    if (normalizedAgents.length > 0) {
        const agentIds = normalizedAgents.map(agent => agent.id);
        logger_1.default.log('[getAgentsByEmail] IDs dos agentes disponiveis', { agentIds });
        logger_1.default.log('[getAgentsByEmail] Primeiro agente', {
            id: normalizedAgents[0].id,
            nome: normalizedAgents[0].nome,
            integrations_id: normalizedAgents[0].integrations_id,
            integrations_id_type: typeof normalizedAgents[0].integrations_id,
            crm_integration_id: normalizedAgents[0].crm_integration_id,
            crm_integration_id_type: typeof normalizedAgents[0].crm_integration_id,
            primary_language: normalizedAgents[0].primary_language
        });
    }
    else {
        logger_1.default.warn('[getAgentsByEmail] Nenhum agente retornado para o email', {
            emailHash: email ? `[redacted chars=${email.length}]` : '',
        });
    }
    return normalizedAgents;
}
