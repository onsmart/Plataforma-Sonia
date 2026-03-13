"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilesController = void 0;
const process_file_service_1 = require("../../services/files/process-file.service");
const process_file_skills_service_1 = require("../../services/files/process-file-skills.service");
const company_helper_1 = require("../../utils/company-helper");
const supabase_1 = require("../../lib/supabase");
const logger_1 = __importDefault(require("../../lib/logger"));
class FilesController {
    async process(req, res) {
        const { fileId } = req.params;
        // Espera-se que o middleware de auth popule req.user ou que venha no body/header por enquanto
        // Como o frontend manda email no header ou body, vamos simplificar
        // TODO: Usar middleware de auth real
        const emailHeader = req.headers['x-user-email'];
        const email = ((Array.isArray(emailHeader) ? emailHeader[0] : emailHeader) || req.body.email);
        if (!fileId) {
            return res.status(400).json({ error: 'File ID is required' });
        }
        if (!email) {
            return res.status(401).json({ error: 'User email is required for context' });
        }
        try {
            // Validar acesso (basic)
            const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(email);
            if (!companiesId) {
                return res.status(403).json({ error: 'User does not belong to any company' });
            }
            // Ler purpose do body (rag ou skills)
            const { purpose = 'rag' } = req.body;
            // Processar baseado no purpose
            let result;
            if (purpose === 'skills') {
                // Processar como Skills
                result = await (0, process_file_skills_service_1.processFileForSkills)(String(fileId), String(companiesId));
            }
            else {
                // Processar como RAG (comportamento padrão)
                result = await (0, process_file_service_1.processFileForRAG)(String(fileId), String(companiesId));
            }
            if (result.success) {
                return res.json({
                    success: true,
                    message: 'File processed successfully',
                    chunks: 'chunks' in result ? result.chunks : undefined,
                    skills: 'skills' in result ? result.skills : undefined
                });
            }
            else {
                return res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        }
        catch (error) {
            logger_1.default.error(`[FilesController] Erro: ${error.message}`);
            return res.status(500).json({ error: error.message });
        }
    }
    async getSkills(req, res) {
        const { fileId } = req.params;
        const emailHeader = req.headers['x-user-email'];
        const email = ((Array.isArray(emailHeader) ? emailHeader[0] : emailHeader) || req.body.email);
        if (!fileId) {
            return res.status(400).json({ error: 'File ID is required' });
        }
        if (!email) {
            return res.status(401).json({ error: 'User email is required' });
        }
        try {
            const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(email);
            if (!companiesId) {
                return res.status(403).json({ error: 'User does not belong to any company' });
            }
            // Buscar skills do arquivo
            const { data: skills, error } = await supabase_1.supabase
                .from('tb_file_skills')
                .select('*')
                .eq('file_id', fileId)
                .eq('companies_id', companiesId)
                .order('skill_name', { ascending: true });
            if (error) {
                logger_1.default.error(`[FilesController.getSkills] Erro: ${error.message}`);
                return res.status(500).json({ error: error.message });
            }
            return res.json({
                success: true,
                skills: skills || [],
                count: skills?.length || 0
            });
        }
        catch (error) {
            logger_1.default.error(`[FilesController.getSkills] Erro: ${error.message}`);
            return res.status(500).json({ error: error.message });
        }
    }
}
exports.FilesController = FilesController;
