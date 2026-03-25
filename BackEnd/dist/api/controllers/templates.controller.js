"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTemplates = listTemplates;
exports.createTemplate = createTemplate;
exports.updateTemplate = updateTemplate;
exports.deleteTemplate = deleteTemplate;
const supabase_1 = require("../../lib/supabase");
const company_helper_1 = require("../../utils/company-helper");
const logger_1 = __importDefault(require("../../lib/logger"));
/**
 * Lista templates de agente (da empresa + globais)
 * GET /templates
 */
async function listTemplates(req, res) {
    try {
        const email = req.user?.email || req.query.email;
        if (!email) {
            return res.status(401).json({
                error: 'Email é obrigatório',
                details: 'Token de autenticação inválido ou email não fornecido'
            });
        }
        // Buscar companies_id (pode ser null se usuário não tem empresa)
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(email);
        // Buscar templates: da empresa (se tiver) + globais (companies_id IS NULL)
        let query = supabase_1.supabase
            .from('tb_agents_templates')
            .select('*')
            .order('created_at', { ascending: false });
        if (companiesId) {
            // Se tem empresa, busca templates da empresa OU globais
            // Usar .or() com sintaxe correta do Supabase
            query = query.or(`companies_id.eq.${companiesId},companies_id.is.null`);
        }
        else {
            // Se não tem empresa, busca apenas globais (companies_id IS NULL)
            query = query.is('companies_id', null);
        }
        const { data, error } = await query;
        if (error) {
            logger_1.default.error('[listTemplates] Erro ao buscar templates:', error);
            return res.status(500).json({
                error: 'Erro ao buscar templates',
                details: error.message
            });
        }
        const templates = (data || []);
        logger_1.default.log(`[listTemplates] ✅ ${templates.length} templates encontrados`);
        const ids = templates.map((t) => t.id).filter(Boolean);
        const skillsByTemplate = {};
        const channelsByTemplate = {};
        if (ids.length > 0) {
            const skillsRes = await supabase_1.supabase
                .from('tb_template_skills')
                .select('template_id, skill_name')
                .in('template_id', ids);
            if (!skillsRes.error && skillsRes.data) {
                for (const row of skillsRes.data) {
                    if (!skillsByTemplate[row.template_id])
                        skillsByTemplate[row.template_id] = [];
                    if (row.skill_name)
                        skillsByTemplate[row.template_id].push(row.skill_name);
                }
            }
            else if (skillsRes.error) {
                logger_1.default.warn('[listTemplates] Junction tb_template_skills (opcional):', skillsRes.error.message);
            }
            const chRes = await supabase_1.supabase
                .from('tb_template_channels')
                .select('template_id, channel_name')
                .in('template_id', ids);
            if (!chRes.error && chRes.data) {
                for (const row of chRes.data) {
                    if (!channelsByTemplate[row.template_id])
                        channelsByTemplate[row.template_id] = [];
                    if (row.channel_name)
                        channelsByTemplate[row.template_id].push(row.channel_name);
                }
            }
            else if (chRes.error) {
                logger_1.default.warn('[listTemplates] Junction tb_template_channels (opcional):', chRes.error.message);
            }
        }
        const enriched = templates.map((t) => ({
            ...t,
            skills: skillsByTemplate[t.id] || [],
            defaultChannels: channelsByTemplate[t.id]?.length > 0 ? channelsByTemplate[t.id] : ['webchat']
        }));
        return res.json(enriched);
    }
    catch (error) {
        logger_1.default.error('[listTemplates] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao buscar templates',
            details: error.message
        });
    }
}
/**
 * Cria um novo template de agente
 * POST /templates
 */
async function createTemplate(req, res) {
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
        const { p_name, p_role, p_description, p_icon, p_complexity, p_channel_names, p_skill_names } = req.body;
        if (!p_name || !p_role) {
            return res.status(400).json({
                error: 'Campos obrigatórios faltando',
                details: 'p_name e p_role são obrigatórios'
            });
        }
        // Chamar RPC do banco
        const { data, error } = await supabase_1.supabase.rpc('sp_create_agent_template', {
            p_name: p_name.trim(),
            p_role: p_role.trim(),
            p_description: p_description || '',
            p_icon: p_icon || 'bot',
            p_complexity: p_complexity || 'Intermediate',
            p_channel_names: p_channel_names || [],
            p_skill_names: p_skill_names || [],
            p_email: email
        });
        if (error) {
            logger_1.default.error('[createTemplate] Erro na RPC:', error);
            return res.status(500).json({
                error: 'Erro ao criar template',
                details: error.message
            });
        }
        logger_1.default.log(`[createTemplate] ✅ Template criado com sucesso`);
        return res.json({
            success: true,
            template: data
        });
    }
    catch (error) {
        logger_1.default.error('[createTemplate] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao criar template',
            details: error.message
        });
    }
}
/**
 * Atualiza um template de agente
 * PUT /templates/:id
 */
async function updateTemplate(req, res) {
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
                error: 'ID do template é obrigatório'
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
        // Verificar se o template pertence à empresa
        const { data: template, error: templateError } = await supabase_1.supabase
            .from('tb_agents_templates')
            .select('id, companies_id')
            .eq('id', id)
            .eq('companies_id', companiesId)
            .maybeSingle();
        if (templateError || !template) {
            return res.status(404).json({
                error: 'Template não encontrado',
                details: 'Template não existe ou não pertence à sua empresa'
            });
        }
        // Preparar payload (remover email se vier no body)
        const { email: _, ...updatePayload } = req.body;
        // Atualizar template
        const { data: updatedTemplate, error: updateError } = await supabase_1.supabase
            .from('tb_agents_templates')
            .update(updatePayload)
            .eq('id', id)
            .eq('companies_id', companiesId)
            .select()
            .single();
        if (updateError) {
            logger_1.default.error('[updateTemplate] Erro ao atualizar template:', updateError);
            return res.status(500).json({
                error: 'Erro ao atualizar template',
                details: updateError.message
            });
        }
        logger_1.default.log(`[updateTemplate] ✅ Template ${id} atualizado com sucesso`);
        return res.json({
            success: true,
            template: updatedTemplate
        });
    }
    catch (error) {
        logger_1.default.error('[updateTemplate] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao atualizar template',
            details: error.message
        });
    }
}
/**
 * Deleta um template de agente
 * DELETE /templates/:id
 */
async function deleteTemplate(req, res) {
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
                error: 'ID do template é obrigatório'
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
        // Verificar se o template pertence à empresa
        const { data: template, error: templateError } = await supabase_1.supabase
            .from('tb_agents_templates')
            .select('id, companies_id')
            .eq('id', id)
            .eq('companies_id', companiesId)
            .maybeSingle();
        if (templateError || !template) {
            return res.status(404).json({
                error: 'Template não encontrado',
                details: 'Template não existe ou não pertence à sua empresa'
            });
        }
        // Deletar template
        const { error: deleteError } = await supabase_1.supabase
            .from('tb_agents_templates')
            .delete()
            .eq('id', id)
            .eq('companies_id', companiesId);
        if (deleteError) {
            logger_1.default.error('[deleteTemplate] Erro ao deletar template:', deleteError);
            return res.status(500).json({
                error: 'Erro ao deletar template',
                details: deleteError.message
            });
        }
        logger_1.default.log(`[deleteTemplate] ✅ Template ${id} deletado com sucesso`);
        return res.json({
            success: true,
            message: 'Template deletado com sucesso'
        });
    }
    catch (error) {
        logger_1.default.error('[deleteTemplate] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao deletar template',
            details: error.message
        });
    }
}
