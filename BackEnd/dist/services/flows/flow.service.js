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
exports.FlowService = void 0;
const supabase_1 = require("../../lib/supabase");
const index_1 = require("./index");
const logger_1 = __importDefault(require("../../lib/logger"));
const company_helper_1 = require("../../utils/company-helper");
const crypto_1 = require("crypto");
/**
 * Serviço para gerenciar e executar flows
 */
class FlowService {
    /**
     * Busca um flow do banco de dados
     */
    static async getFlow(flowId, userEmail) {
        try {
            // 1. Buscar companies_id a partir do user_email
            const { getCompanyIdByEmail } = await Promise.resolve().then(() => __importStar(require('../../utils/company-helper')));
            const companiesId = await getCompanyIdByEmail(userEmail);
            if (!companiesId) {
                logger_1.default.warn(`[FlowService] companies_id não encontrado para ${userEmail}`);
                return null;
            }
            // 2. Buscar flow por id e companies_id
            const { data, error } = await supabase_1.supabase
                .from('tb_flows')
                .select('nodes')
                .eq('id', flowId)
                .eq('companies_id', companiesId)
                .single();
            if (error) {
                logger_1.default.error(`[FlowService] Erro ao buscar flow ${flowId}:`, error);
                return null;
            }
            // Extrai os dados do JSON
            const flowData = data?.nodes;
            if (flowData) {
                logger_1.default.log(`[FlowService] Flow carregado:`, {
                    startNodeId: flowData.startNodeId,
                    nodesCount: flowData.nodes?.length || 0,
                    edgesCount: flowData.edges?.length || 0
                });
            }
            return flowData;
        }
        catch (error) {
            logger_1.default.error(`[FlowService] Erro ao buscar flow: ${error.message}`, error);
            return null;
        }
    }
    /**
     * Executa um flow
     * @param flowId ID do flow no banco
     * @param userEmail Email do usuário
     * @param initialData Dados iniciais para o primeiro node (ex: { nome: "João", email: "joao@example.com" })
     */
    static async executeFlow(flowId, userEmail, initialData = {}) {
        try {
            logger_1.default.info(`[FlowService] Iniciando execução do flow ${flowId} para ${userEmail}`);
            // Busca o flow do banco
            const flowData = await this.getFlow(flowId, userEmail);
            if (!flowData) {
                throw new Error(`Flow ${flowId} não encontrado ou não pertence ao usuário`);
            }
            // 🎯 Buscar user_id e companies_id da tabela tb_users pelo email (necessário para salvar fallbacks)
            let userId = '';
            let companiesId = '';
            try {
                logger_1.default.log(`[FlowService] Buscando user_id e companies_id para email: ${userEmail}`);
                const userCompanyData = await (0, company_helper_1.getUserIdAndCompanyIdByEmail)(userEmail);
                if (userCompanyData.userId) {
                    userId = userCompanyData.userId;
                    logger_1.default.log(`[FlowService] ✅ user_id encontrado para ${userEmail}: ${userId}`);
                }
                else {
                    logger_1.default.warn(`[FlowService] ⚠️ user_id não encontrado para ${userEmail}. Verifique se o email está correto na tabela tb_users.`);
                }
                if (userCompanyData.companyId) {
                    companiesId = userCompanyData.companyId;
                    logger_1.default.log(`[FlowService] ✅ companies_id encontrado para ${userEmail}: ${companiesId}`);
                }
                else {
                    logger_1.default.warn(`[FlowService] ⚠️ companies_id não encontrado para ${userEmail}. Fallbacks podem não ser salvos corretamente.`);
                }
            }
            catch (err) {
                logger_1.default.error(`[FlowService] Erro ao buscar user_id/companies_id: ${err.message}`, err);
            }
            // Cria o contexto de execução
            // 🎯 IMPORTANTE: Preserva a mensagem original do usuário no contexto
            // A mensagem original pode estar em initialData.message, initialData.originalMessage, ou initialData.userMessage
            const contextData = { ...initialData };
            // Se houver uma mensagem original, garante que esteja em originalMessage e userMessage
            if (initialData.message && !initialData.originalMessage && !initialData.userMessage) {
                // Se message não parece ser uma instrução do flow, assume que é a mensagem original
                if (!initialData.message.includes('Execute sua tarefa como agente')) {
                    contextData.originalMessage = initialData.message;
                    contextData.userMessage = initialData.message;
                }
            }
            else if (initialData.originalMessage && !initialData.userMessage) {
                contextData.userMessage = initialData.originalMessage;
            }
            else if (initialData.userMessage && !initialData.originalMessage) {
                contextData.originalMessage = initialData.userMessage;
            }
            // ✅ Gerar executionId único para rastreamento
            const executionId = (0, crypto_1.randomUUID)();
            const context = {
                flowId,
                userId, // ✅ Agora preenchido com o user_id da tabela tb_users
                companiesId, // ✅ Adicionado para multi-tenant
                userEmail,
                executionId, // ✅ ID único da execução
                data: contextData, // Dados iniciais (ex: nome, email do usuário) + mensagem original preservada
                executionHistory: []
            };
            logger_1.default.log(`[FlowService] Contexto criado:`, {
                flowId,
                userId,
                companiesId,
                userEmail,
                executionId,
                hasCompaniesId: !!companiesId
            });
            logger_1.default.log(`[FlowService] Contexto criado com mensagem original:`, {
                hasOriginalMessage: !!(contextData.originalMessage || contextData.userMessage),
                originalMessage: (contextData.originalMessage || contextData.userMessage || 'não encontrada')?.substring(0, 100),
                contextKeys: Object.keys(contextData)
            });
            // Cria e executa o executor
            const executor = new index_1.FlowExecutor(flowData, context);
            const result = await executor.execute();
            logger_1.default.info(`[FlowService] Flow ${flowId} executado com sucesso`);
            return result;
        }
        catch (error) {
            logger_1.default.error(`[FlowService] Erro ao executar flow: ${error.message}`, error);
            throw error;
        }
    }
    /**
     * Lista flows do usuário (filtrado por companies_id)
     */
    static async listFlows(userEmail) {
        try {
            // 1. Buscar companies_id a partir do user_email
            const { getCompanyIdByEmail } = await Promise.resolve().then(() => __importStar(require('../../utils/company-helper')));
            const companiesId = await getCompanyIdByEmail(userEmail);
            if (!companiesId) {
                logger_1.default.warn(`[FlowService] companies_id não encontrado para ${userEmail}`);
                return [];
            }
            // 2. Filtrar por companies_id
            const { data, error } = await supabase_1.supabase
                .from('tb_flows')
                .select('id, name, created_at')
                .eq('companies_id', companiesId)
                .order('created_at', { ascending: false });
            if (error) {
                logger_1.default.error(`[FlowService] Erro ao listar flows:`, error);
                return [];
            }
            return data || [];
        }
        catch (error) {
            logger_1.default.error(`[FlowService] Erro ao listar flows: ${error.message}`, error);
            return [];
        }
    }
}
exports.FlowService = FlowService;
