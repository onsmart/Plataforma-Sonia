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
exports.saveSystemLog = saveSystemLog;
const supabase_1 = require("../lib/supabase");
const logger_1 = __importDefault(require("../lib/logger"));
const company_helper_1 = require("../utils/company-helper");
/**
 * Valida se uma string é um UUID válido
 */
function isValidUUID(str) {
    if (!str)
        return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}
/**
 * Salva um log do sistema na tabela tb_system_logs
 */
async function saveSystemLog(log) {
    try {
        // Validar se node_id é um UUID válido, senão usar null
        const nodeIdValue = isValidUUID(log.node_id) ? log.node_id : null;
        const metadataWithNodeId = {
            ...(log.metadata || {}),
            // Se node_id não for UUID válido, salva como string no metadata
            ...(log.node_id && !isValidUUID(log.node_id) ? { node_id_string: log.node_id } : {})
        };
        // 🎯 PADRÃO MULTI-TENANT: email → user_id → companies_id
        let userIdValue = (log.user_id && log.user_id.trim() !== '') ? log.user_id : null;
        let companyIdValue = log.companies_id || null;
        // Se não tiver companies_id mas tiver user_email, buscar companies_id
        if (!companyIdValue && log.user_email) {
            companyIdValue = await (0, company_helper_1.getCompanyIdByEmail)(log.user_email);
            if (companyIdValue) {
                logger_1.default.log(`[saveSystemLog] ✅ companies_id encontrado via user_email: ${companyIdValue}`);
            }
        }
        // Se não tiver user_id mas tiver user_email, buscar user_id
        if (!userIdValue && log.user_email) {
            userIdValue = await (0, company_helper_1.getUserIdByEmail)(log.user_email);
            if (userIdValue) {
                logger_1.default.log(`[saveSystemLog] ✅ user_id encontrado via user_email: ${userIdValue}`);
            }
        }
        // 🎯 FALLBACK: Se companies_id não foi fornecido mas temos workflow_id, tentar buscar via workflow
        if (!companyIdValue && log.workflow_id) {
            try {
                // Busca companies_id e user_email do workflow
                const { data: flowData, error: flowError } = await supabase_1.supabase
                    .from('tb_flows')
                    .select('companies_id, user_email')
                    .eq('id', log.workflow_id)
                    .maybeSingle();
                if (!flowError && flowData) {
                    // Se tiver companies_id direto, usa ele
                    if (flowData.companies_id) {
                        companyIdValue = flowData.companies_id;
                        logger_1.default.log(`[saveSystemLog] ✅ companies_id encontrado via workflow_id (campo direto): ${companyIdValue}`);
                    }
                    // Se não tiver companies_id mas tiver user_email, busca companies_id e user_id pelo email
                    else if (flowData.user_email) {
                        const { getUserIdAndCompanyIdByEmail } = await Promise.resolve().then(() => __importStar(require('../utils/company-helper')));
                        const userCompanyData = await getUserIdAndCompanyIdByEmail(flowData.user_email);
                        if (userCompanyData.userId && !userIdValue) {
                            userIdValue = userCompanyData.userId;
                            logger_1.default.log(`[saveSystemLog] ✅ user_id encontrado via workflow_id -> user_email: ${userIdValue}`);
                        }
                        if (userCompanyData.companyId) {
                            companyIdValue = userCompanyData.companyId;
                            logger_1.default.log(`[saveSystemLog] ✅ companies_id encontrado via workflow_id -> user_email: ${companyIdValue}`);
                        }
                    }
                }
            }
            catch (err) {
                logger_1.default.warn(`[saveSystemLog] Erro ao buscar companies_id via workflow_id: ${err.message}`);
            }
        }
        logger_1.default.log(`[saveSystemLog] Salvando log:`, {
            log_type: log.log_type,
            user_id: userIdValue || 'null',
            companies_id: companyIdValue || 'null',
            workflow_id: log.workflow_id || 'null',
            impact_level: log.impact_level,
            has_user_id: !!userIdValue,
            has_companies_id: !!companyIdValue
        });
        const { data, error } = await supabase_1.supabase
            .from('tb_system_logs')
            .insert({
            user_id: userIdValue,
            companies_id: companyIdValue,
            agent_id: log.agent_id || null,
            workflow_id: log.workflow_id || null,
            node_id: nodeIdValue,
            conversation_id: log.conversation_id || null,
            execution_id: log.execution_id || null,
            log_type: log.log_type,
            level: log.level,
            message: log.message,
            metadata: metadataWithNodeId,
            impact_level: log.impact_level
        })
            .select('id')
            .single();
        if (error) {
            logger_1.default.error('[saveSystemLog] Erro ao salvar log:', error);
            return { success: false, error: error.message };
        }
        logger_1.default.log(`[saveSystemLog] ✅ Log salvo: ${log.log_type}`, {
            id: data.id,
            message: log.message,
            impact_level: log.impact_level
        });
        return { success: true, id: data.id };
    }
    catch (err) {
        logger_1.default.error('[saveSystemLog] Erro:', err);
        return { success: false, error: err.message };
    }
}
