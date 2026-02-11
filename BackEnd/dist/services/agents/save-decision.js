"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveBlockedDecision = saveBlockedDecision;
const supabase_1 = require("../../lib/supabase");
const company_helper_1 = require("../../utils/company-helper");
async function saveBlockedDecision(agentId, userId, originalMessage, decision, context, channel, integrationsId, contactId, userEmail // Para buscar companies_id automaticamente
) {
    try {
        // 🎯 PADRÃO MULTI-TENANT: buscar companies_id se tiver userEmail
        let companyId = null;
        if (userEmail) {
            companyId = await (0, company_helper_1.getCompanyIdByEmail)(userEmail);
        }
        console.log('[saveBlockedDecision] Salvando decisão bloqueada:', {
            agentId,
            userId,
            companies_id: companyId,
            confidence: decision.confidence_score,
            reason: decision.reason,
            channel
        });
        const { data, error } = await supabase_1.supabase
            .from('tb_agent_decisions')
            .insert({
            agent_id: agentId,
            user_id: userId, // Mantém para auditoria
            companies_id: companyId, // Filtro principal agora
            original_message: originalMessage,
            answer: decision.answer,
            confidence_score: decision.confidence_score,
            reason: decision.reason,
            sources: decision.sources || null,
            status: 'pending_approval',
            metadata: decision.metadata || {},
            context: context || {},
            channel: channel,
            integrations_id: integrationsId,
            contact_id: contactId
        })
            .select('id')
            .single();
        if (error) {
            console.error('[saveBlockedDecision] ❌ Erro ao salvar:', error);
            console.error('[saveBlockedDecision] Detalhes do erro:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            });
            return { success: false, error: error.message };
        }
        console.log('[saveBlockedDecision] ✅ Decisão salva com sucesso!');
        console.log('[saveBlockedDecision] ID da decisão:', data.id);
        console.log('[saveBlockedDecision] Dados salvos:', {
            agent_id: agentId,
            user_id: userId,
            status: 'pending_approval',
            confidence: decision.confidence_score,
            reason: decision.reason,
            channel: channel || 'webchat'
        });
        return { success: true, id: data.id };
    }
    catch (err) {
        console.error('[saveBlockedDecision] Erro:', err);
        return { success: false, error: err.message };
    }
}
