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
exports.generateFlowMvp = generateFlowMvp;
exports.refineFlowDescriptionClaude = refineFlowDescriptionClaude;
exports.refineFlowDescriptionStatus = refineFlowDescriptionStatus;
const flows_1 = require("../../services/flows");
const company_helper_1 = require("../../utils/company-helper");
const supabase_1 = require("../../lib/supabase");
const logger_1 = __importDefault(require("../../lib/logger"));
const flow_channel_runtime_1 = require("../../services/flows/flow-channel-runtime");
const flow_generate_mvp_service_1 = require("../../services/flows/flow-generate-mvp.service");
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
        if (!flow.companies_id) {
            return res.status(403).json({
                error: 'Fluxo global',
                details: 'Fluxos globais da plataforma não podem ser excluídos.',
                code: 'FLOW_GLOBAL',
            });
        }
        if (flow.companies_id !== companiesId) {
            return res.status(403).json({
                error: 'Flow não pertence à sua empresa',
                details: 'Você não pode deletar flows de outras empresas',
            });
        }
        const { data: linkedInts, error: linkedErr } = await supabase_1.supabase
            .from('tb_integrations')
            .select('provider, phone_number')
            .eq('companies_id', companiesId)
            .eq('linked_flow_id', id);
        if (!linkedErr && linkedInts && linkedInts.length > 0) {
            const labels = linkedInts.map((row) => {
                const p = row.provider || 'integração';
                return row.phone_number ? `${p} (${row.phone_number})` : p;
            });
            return res.status(409).json({
                error: 'Fluxo em uso',
                details: `Desvincule o fluxo nas integrações antes de excluir: ${labels.join('; ')}`,
                code: 'FLOW_LINKED_INTEGRATION',
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
/**
 * Gera rascunho de fluxo a partir de texto: modo estruturado (classificador + Se/Senão + ramos) quando há templates,
 * ou fluxo simples (Início → 1 agente/template → Fim). Refino da descrição via OpenAI e/ou Claude conforme env.
 */
async function generateFlowMvp(req, res) {
    try {
        const email = req.user?.email || req.body.email;
        if (!email) {
            return res.status(401).json({
                error: 'Email é obrigatório',
                details: 'Token de autenticação inválido ou email não fornecido',
            });
        }
        const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
        const language = typeof req.body.language === 'string' && req.body.language.trim()
            ? req.body.language.trim()
            : 'pt-BR';
        if (!description) {
            return res.status(400).json({
                error: 'Descrição obrigatória',
                details: 'Envie "description" com o que o fluxo deve fazer.',
            });
        }
        if (description.length > 8000) {
            return res.status(400).json({
                error: 'Descrição muito longa',
                details: 'Use no máximo 8000 caracteres.',
            });
        }
        const result = await (0, flow_generate_mvp_service_1.generateMvpFlowFromDescription)(email, description, language);
        return res.json(result);
    }
    catch (error) {
        logger_1.default.error('[generateFlowMvp] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao gerar fluxo',
            details: error?.message || 'Falha desconhecida',
        });
    }
}
/**
 * Refina só o texto com Claude (modal “Melhorar descrição”) — não cria agentes nem fluxo.
 * POST /flows/refine-description
 */
async function refineFlowDescriptionClaude(req, res) {
    try {
        const email = req.user?.email || req.body.email;
        if (!email) {
            return res.status(401).json({
                error: 'Email é obrigatório',
                details: 'Token de autenticação inválido ou email não fornecido',
            });
        }
        const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
        const language = typeof req.body.language === 'string' && req.body.language.trim()
            ? req.body.language.trim()
            : 'pt-BR';
        if (!description) {
            return res.status(400).json({
                error: 'Descrição obrigatória',
                details: 'Envie "description" com o texto a refinar.',
            });
        }
        if (description.length > 8000) {
            return res.status(400).json({
                error: 'Descrição muito longa',
                details: 'Use no máximo 8000 caracteres.',
            });
        }
        if (!(0, flow_generate_mvp_service_1.isAnthropicConfiguredForFlowRefine)()) {
            return res.status(503).json({
                error: 'Claude não configurado',
                details: 'Configure ANTHROPIC_API_KEY ou CLAUDE_API_KEY no servidor.',
                code: 'ANTHROPIC_MISSING',
            });
        }
        const refined = await (0, flow_generate_mvp_service_1.refineFlowDescriptionWithClaudeForGeneration)(description, language);
        if (!refined) {
            return res.status(502).json({
                error: 'Não foi possível refinar com Claude',
                details: 'Verifique modelo, cota da API ou tente novamente.',
                code: 'CLAUDE_REFINE_FAILED',
            });
        }
        return res.json({
            success: true,
            refinedDescription: refined,
            refinementProvider: 'claude',
        });
    }
    catch (error) {
        logger_1.default.error('[refineFlowDescriptionClaude] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao refinar descrição',
            details: error instanceof Error ? error.message : 'Falha desconhecida',
        });
    }
}
/** GET /flows/refine-description/status — se Claude está disponível (para habilitar botão no front). */
async function refineFlowDescriptionStatus(req, res) {
    try {
        const email = req.user?.email || req.query.email;
        if (!email) {
            return res.status(401).json({
                error: 'Email é obrigatório',
                details: 'Token de autenticação inválido ou email não fornecido',
            });
        }
        return res.json({
            claudeAvailable: (0, flow_generate_mvp_service_1.isAnthropicConfiguredForFlowRefine)(),
        });
    }
    catch (error) {
        logger_1.default.error('[refineFlowDescriptionStatus] Erro:', error);
        return res.status(500).json({ error: 'Erro ao consultar status' });
    }
}
