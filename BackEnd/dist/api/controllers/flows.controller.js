"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFlows = listFlows;
exports.executeFlow = executeFlow;
exports.getFlow = getFlow;
const flows_1 = require("../../services/flows");
/**
 * Lista flows do usuário
 */
async function listFlows(req, res) {
    try {
        const email = req.query.email;
        if (!email) {
            return res.status(400).json({ error: 'Email é obrigatório' });
        }
        const flows = await flows_1.FlowService.listFlows(email);
        return res.json(flows);
    }
    catch (error) {
        console.error('[FlowsController] Erro ao listar flows:', error);
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
        const result = await flows_1.FlowService.executeFlow(flow_id, email, initialData);
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
        const email = req.query.email;
        if (!email) {
            return res.status(400).json({ error: 'Email é obrigatório' });
        }
        const flow = await flows_1.FlowService.getFlow(flowId, email);
        if (!flow) {
            return res.status(404).json({ error: 'Flow não encontrado' });
        }
        return res.json(flow);
    }
    catch (error) {
        console.error('[FlowsController] Erro ao buscar flow:', error);
        return res.status(500).json({
            error: 'Erro ao buscar flow',
            details: error.message
        });
    }
}
