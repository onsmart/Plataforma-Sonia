"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentsByEmail = getAgentsByEmail;
const supabase_1 = require("../../lib/supabase");
async function getAgentsByEmail(email) {
    console.log('[getAgentsByEmail] Buscando agentes para email:', email);
    const { data, error } = await supabase_1.supabase.rpc('fn_get_agents_with_api_key', { p_user_email: email });
    if (error) {
        console.error('[getAgentsByEmail] Erro na RPC:', error);
        throw new Error('Failed to fetch agents');
    }
    console.log('[getAgentsByEmail] Agentes retornados:', data?.length || 0);
    if (data && Array.isArray(data) && data.length > 0) {
        const agentIds = data.map(a => a.id);
        console.log('[getAgentsByEmail] IDs dos agentes disponíveis:', agentIds);
        console.log('[getAgentsByEmail] Primeiro agente:', {
            id: data[0].id,
            nome: data[0].nome,
            integrations_id: data[0].integrations_id,
            integrations_id_type: typeof data[0].integrations_id,
            crm_integration_id: data[0].crm_integration_id,
            crm_integration_id_type: typeof data[0].crm_integration_id
        });
        // Log completo do primeiro agente para debug
        console.log('[getAgentsByEmail] Primeiro agente completo:', JSON.stringify(data[0], null, 2));
    }
    else {
        console.warn('[getAgentsByEmail] ⚠️ Nenhum agente retornado para o email:', email);
    }
    return data || [];
}
