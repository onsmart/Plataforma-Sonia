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
const crypto_1 = require("crypto");
const supabase_1 = require("../../lib/supabase");
const logger_1 = __importDefault(require("../../lib/logger"));
const company_helper_1 = require("../../utils/company-helper");
const index_1 = require("./index");
const flow_data_repair_1 = require("./flow-data-repair");
function readFlowNodes(raw) {
    if (!raw || typeof raw !== 'object')
        return [];
    const flow = raw;
    return Array.isArray(flow.nodes) ? flow.nodes : [];
}
function readFlowMeta(raw) {
    if (!raw || typeof raw !== 'object')
        return {};
    const meta = raw.meta;
    return meta && typeof meta === 'object' ? meta : {};
}
function extractSubflowRefs(raw) {
    return readFlowNodes(raw)
        .filter((node) => node && typeof node === 'object' && node.type === 'subflow')
        .map((node) => {
        const data = node.data || {};
        return {
            flowId: String(data.subflowId || data.flowId || '').trim(),
            flowName: String(data.subflowName || data.flowName || '').trim(),
            nodeId: String(node.id || '').trim(),
            nodeLabel: String(data.label || 'Subfluxo').trim(),
        };
    })
        .filter((ref) => ref.flowId);
}
class FlowService {
    static async getFlow(flowId, userEmail) {
        try {
            const { getCompanyIdByEmail } = await Promise.resolve().then(() => __importStar(require('../../utils/company-helper')));
            const companiesId = await getCompanyIdByEmail(userEmail);
            let query = supabase_1.supabase
                .from('tb_flows')
                .select('nodes')
                .eq('id', flowId);
            if (companiesId) {
                query = query.or(`companies_id.eq.${companiesId},companies_id.is.null`);
            }
            else {
                query = query.is('companies_id', null);
            }
            const { data, error } = await query.single();
            if (error) {
                logger_1.default.error(`[FlowService] Erro ao buscar flow ${flowId}:`, error);
                return null;
            }
            let flowData = data?.nodes;
            if (flowData) {
                flowData = await (0, flow_data_repair_1.repairFlowDataForExecution)(flowData, companiesId);
                logger_1.default.log('[FlowService] Flow carregado:', {
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
    static async executeFlow(flowId, userEmail, initialData = {}, options = {}) {
        try {
            logger_1.default.info(`[FlowService] Iniciando execucao do flow ${flowId} para ${userEmail}`);
            const flowData = await this.getFlow(flowId, userEmail);
            if (!flowData) {
                throw new Error(`Flow ${flowId} nao encontrado ou nao pertence ao usuario`);
            }
            let userId = '';
            let companiesId = '';
            try {
                logger_1.default.log(`[FlowService] Buscando user_id e companies_id para email: ${userEmail}`);
                const userCompanyData = await (0, company_helper_1.getUserIdAndCompanyIdByEmail)(userEmail);
                if (userCompanyData.userId) {
                    userId = userCompanyData.userId;
                }
                if (userCompanyData.companyId) {
                    companiesId = userCompanyData.companyId;
                }
            }
            catch (error) {
                logger_1.default.error(`[FlowService] Erro ao buscar user_id/companies_id: ${error.message}`, error);
            }
            const executionMode = options.executionMode || 'live';
            const contextData = {
                ...initialData,
                __flow_execution_mode: executionMode
            };
            if (initialData.message && !initialData.originalMessage && !initialData.userMessage) {
                if (!String(initialData.message).includes('Execute sua tarefa como agente')) {
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
            const executionId = options.executionId || (0, crypto_1.randomUUID)();
            const resumeFromNodeId = String(options.resumeFromNodeId || '').trim();
            if (resumeFromNodeId) {
                contextData.__resume_from_node_id = resumeFromNodeId;
            }
            const context = {
                flowId,
                userId,
                companiesId,
                userEmail,
                executionId,
                data: contextData,
                executionHistory: Array.isArray(options.executionHistory) ? [...options.executionHistory] : []
            };
            logger_1.default.log('[FlowService] Contexto criado:', {
                flowId,
                userId,
                companiesId,
                userEmail,
                executionId,
                executionMode,
                resumeFromNodeId: resumeFromNodeId || null,
                hasCompaniesId: !!companiesId
            });
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
    static async listFlows(userEmail) {
        try {
            const { getCompanyIdByEmail } = await Promise.resolve().then(() => __importStar(require('../../utils/company-helper')));
            const companiesId = await getCompanyIdByEmail(userEmail);
            let query = supabase_1.supabase
                .from('tb_flows')
                .select('id, name, created_at, companies_id, nodes')
                .order('created_at', { ascending: false });
            if (companiesId) {
                query = query.or(`companies_id.eq.${companiesId},companies_id.is.null`);
            }
            else {
                query = query.is('companies_id', null);
            }
            const { data, error } = await query;
            if (error) {
                logger_1.default.error('[FlowService] Erro ao listar flows:', error);
                return [];
            }
            const rows = data || [];
            const existingIds = new Set(rows.map((row) => String(row.id)));
            const referencedBy = new Map();
            for (const row of rows) {
                for (const ref of extractSubflowRefs(row.nodes)) {
                    if (!referencedBy.has(ref.flowId)) {
                        referencedBy.set(ref.flowId, {
                            parentFlowId: String(row.id),
                            parentFlowName: String(row.name || ''),
                            nodeId: ref.nodeId,
                            nodeLabel: ref.nodeLabel,
                        });
                    }
                }
            }
            const enriched = rows.map((row) => {
                const meta = readFlowMeta(row.nodes);
                const inferredParent = referencedBy.get(String(row.id));
                const subflowRefs = extractSubflowRefs(row.nodes).map((ref) => ({
                    ...ref,
                    connected: existingIds.has(ref.flowId),
                }));
                const explicitKind = String(meta.kind || '').trim();
                const flowKind = explicitKind === 'subflow' || inferredParent ? 'subflow' : 'main';
                return {
                    id: row.id,
                    name: row.name,
                    created_at: row.created_at,
                    companies_id: row.companies_id,
                    flowKind,
                    parentFlowId: meta.parentFlowId || inferredParent?.parentFlowId || null,
                    parentFlowName: meta.parentFlowName || inferredParent?.parentFlowName || null,
                    subflowKey: meta.subflowKey || null,
                    subflowOrder: typeof meta.subflowOrder === 'number' ? meta.subflowOrder : null,
                    referencedByNodeId: inferredParent?.nodeId || null,
                    referencedByNodeLabel: inferredParent?.nodeLabel || null,
                    subflowRefs,
                };
            });
            logger_1.default.log(`[FlowService] ${enriched.length} flows encontrados (empresa: ${companiesId || 'sem empresa'})`);
            return enriched;
        }
        catch (error) {
            logger_1.default.error(`[FlowService] Erro ao listar flows: ${error.message}`, error);
            return [];
        }
    }
}
exports.FlowService = FlowService;
