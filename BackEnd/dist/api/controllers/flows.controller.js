"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFlows = listFlows;
exports.executeFlow = executeFlow;
exports.getFlow = getFlow;
exports.createFlow = createFlow;
exports.updateFlow = updateFlow;
exports.deleteFlow = deleteFlow;
const flows_1 = require("../../services/flows");
const company_helper_1 = require("../../utils/company-helper");
const supabase_1 = require("../../lib/supabase");
const logger_1 = __importDefault(require("../../lib/logger"));
const flow_channel_runtime_1 = require("../../services/flows/flow-channel-runtime");
/**
 * Lista flows do usuário (da empresa + globais)
 */
async function listFlows(req, res) {
    try {
        // ✅ Email vem do middleware (validado) ou fallback para compatibilidade
        const email = req.user?.email || req.query.email;
        if (!email) {
            return res.status(401).json({
                error: 'Email é obrigatório',
                details: 'Token de autenticação inválido ou email não fornecido'
            });
        }
        const flows = await flows_1.FlowService.listFlows(email);
        return res.json(flows);
    }
    catch (error) {
        logger_1.default.error('[FlowsController] Erro ao listar flows:', error);
        return res.status(500).json({
            error: 'Erro ao buscar flows',
            details: error.message
        });
    }
}
/**
 * Executa um flow
 * O Flow é a orquestração central - decide a ordem de execução
 */
async function executeFlow(req, res) {
    try {
        const { flow_id, email, initial_data } = req.body;
        if (!flow_id || !email) {
            return res.status(400).json({
                error: 'flow_id e email são obrigatórios'
            });
        }
        // Dados iniciais para o primeiro node (ex: { nome: "João", email: "joao@example.com" })
        const initialData = initial_data || {};
        // Executa o flow (orquestração central)
        const execution = await (0, flow_channel_runtime_1.executeFlowForChannel)({
            flowId: flow_id,
            userEmail: email,
            initialData,
            deliveryChannel: 'none'
        });
        const result = execution.context;
        // Log para debug: verifica se há QR codes no histórico
        const stepsWithQRCode = result.executionHistory.filter((h) => h.qrCode);
        if (stepsWithQRCode.length > 0) {
            console.log(`[FlowsController] ✅ ${stepsWithQRCode.length} step(s) com QR code no histórico:`, stepsWithQRCode.map((h) => ({ nodeId: h.nodeId, qrCodeLength: h.qrCode?.length || 0 })));
        }
        return res.json({
            success: true,
            flowId: result.flowId,
            executionHistory: result.executionHistory,
            finalData: result.data,
            outboundMessage: execution.outboundMessage,
            nodesExecuted: result.executionHistory.length
        });
    }
    catch (error) {
        console.error('[FlowsController] Erro ao executar flow:', error);
        return res.status(500).json({
            error: 'Erro ao executar flow',
            details: error.message
        });
    }
}
/**
 * Busca um flow específico
 */
async function getFlow(req, res) {
    try {
        const flowId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
        // ✅ Email vem do middleware (validado) ou fallback para compatibilidade
        const email = req.user?.email || req.query.email;
        if (!email) {
            return res.status(401).json({
                error: 'Email é obrigatório',
                details: 'Token de autenticação inválido ou email não fornecido'
            });
        }
        const flow = await flows_1.FlowService.getFlow(flowId, email);
        if (!flow) {
            return res.status(404).json({ error: 'Flow não encontrado' });
        }
        return res.json(flow);
    }
    catch (error) {
        logger_1.default.error('[FlowsController] Erro ao buscar flow:', error);
        return res.status(500).json({
            error: 'Erro ao buscar flow',
            details: error.message
        });
    }
}
/**
 * Cria um novo flow
 * POST /flows
 */
async function createFlow(req, res) {
    try {
        const email = req.user?.email || req.body.email || req.headers['x-user-email'];
        if (!email) {
            return res.status(401).json({
                error: 'Email é obrigatório',
                details: 'Token de autenticação inválido ou email não fornecido'
            });
        }
        // Buscar companies_id
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(email);
        if (!companiesId) {
            return res.status(403).json({
                error: 'Empresa não encontrada',
                details: 'Usuário não pertence a nenhuma empresa'
            });
        }
        const { name, nodes, user_email } = req.body;
        if (!name || !nodes) {
            return res.status(400).json({
                error: 'Campos obrigatórios faltando',
                details: 'name e nodes são obrigatórios'
            });
        }
        // Criar flow
        const payload = {
            name: name.trim(),
            nodes: nodes,
            user_email: user_email || email,
            companies_id: companiesId
        };
        const { data, error } = await supabase_1.supabase
            .from('tb_flows')
            .insert(payload)
            .select()
            .single();
        if (error) {
            logger_1.default.error('[createFlow] Erro ao criar flow:', error);
            return res.status(500).json({
                error: 'Erro ao criar flow',
                details: error.message
            });
        }
        logger_1.default.log(`[createFlow] ✅ Flow criado com sucesso`);
        return res.json({
            success: true,
            flow: data
        });
    }
    catch (error) {
        logger_1.default.error('[createFlow] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao criar flow',
            details: error.message
        });
    }
}
/**
 * Atualiza um flow
 * PUT /flows/:id
 */
async function updateFlow(req, res) {
    try {
        const { id } = req.params;
        const email = req.user?.email || req.body.email || req.headers['x-user-email'];
        if (!email) {
            return res.status(401).json({
                error: 'Email é obrigatório',
                details: 'Token de autenticação inválido ou email não fornecido'
            });
        }
        if (!id) {
            return res.status(400).json({
                error: 'ID do flow é obrigatório'
            });
        }
        // Buscar companies_id
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(email);
        if (!companiesId) {
            return res.status(403).json({
                error: 'Empresa não encontrada',
                details: 'Usuário não pertence a nenhuma empresa'
            });
        }
        // Verificar se o flow pertence à empresa (não pode atualizar globais)
        const { data: flow, error: flowError } = await supabase_1.supabase
            .from('tb_flows')
            .select('id, companies_id')
            .eq('id', id)
            .maybeSingle();
        if (flowError || !flow) {
            return res.status(404).json({
                error: 'Flow não encontrado',
                details: 'Flow não existe'
            });
        }
        // Só pode atualizar flows da própria empresa (não globais)
        if (flow.companies_id && flow.companies_id !== companiesId) {
            return res.status(403).json({
                error: 'Flow não pertence à sua empresa',
                details: 'Você não pode atualizar flows de outras empresas'
            });
        }
        // Preparar payload (remover email se vier no body)
        const { email: _, ...updatePayload } = req.body;
        // Atualizar flow
        const { data: updatedFlow, error: updateError } = await supabase_1.supabase
            .from('tb_flows')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();
        if (updateError) {
            logger_1.default.error('[updateFlow] Erro ao atualizar flow:', updateError);
            return res.status(500).json({
                error: 'Erro ao atualizar flow',
                details: updateError.message
            });
        }
        logger_1.default.log(`[updateFlow] ✅ Flow ${id} atualizado com sucesso`);
        return res.json({
            success: true,
            flow: updatedFlow
        });
    }
    catch (error) {
        logger_1.default.error('[updateFlow] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao atualizar flow',
            details: error.message
        });
    }
}
/**
 * Deleta um flow
 * DELETE /flows/:id
 */
async function deleteFlow(req, res) {
    try {
        const { id } = req.params;
        const email = req.user?.email || req.body.email || req.headers['x-user-email'];
        if (!email) {
            return res.status(401).json({
                error: 'Email é obrigatório',
                details: 'Token de autenticação inválido ou email não fornecido'
            });
        }
        if (!id) {
            return res.status(400).json({
                error: 'ID do flow é obrigatório'
            });
        }
        // Buscar companies_id
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(email);
        if (!companiesId) {
            return res.status(403).json({
                error: 'Empresa não encontrada',
                details: 'Usuário não pertence a nenhuma empresa'
            });
        }
        // Verificar se o flow pertence à empresa (não pode deletar globais)
        const { data: flow, error: flowError } = await supabase_1.supabase
            .from('tb_flows')
            .select('id, companies_id')
            .eq('id', id)
            .maybeSingle();
        if (flowError || !flow) {
            return res.status(404).json({
                error: 'Flow não encontrado',
                details: 'Flow não existe'
            });
        }
        // Só pode deletar flows da própria empresa (não globais)
        if (flow.companies_id && flow.companies_id !== companiesId) {
            return res.status(403).json({
                error: 'Flow não pertence à sua empresa',
                details: 'Você não pode deletar flows de outras empresas'
            });
        }
        // Deletar flow
        const { error: deleteError } = await supabase_1.supabase
            .from('tb_flows')
            .delete()
            .eq('id', id);
        if (deleteError) {
            logger_1.default.error('[deleteFlow] Erro ao deletar flow:', deleteError);
            return res.status(500).json({
                error: 'Erro ao deletar flow',
                details: deleteError.message
            });
        }
        logger_1.default.log(`[deleteFlow] ✅ Flow ${id} deletado com sucesso`);
        return res.json({
            success: true,
            message: 'Flow deletado com sucesso'
        });
    }
    catch (error) {
        logger_1.default.error('[deleteFlow] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao deletar flow',
            details: error.message
        });
    }
}
