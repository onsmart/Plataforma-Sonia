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
const KB_BUCKET = 'sonia-kb';
const KB_MAX_BYTES = 10 * 1024 * 1024;
class FilesController {
    async upload(req, res) {
        const email = req.user?.email;
        if (!email) {
            return res.status(401).json({ error: 'User email is required' });
        }
        const { fileName, mimeType, contentBase64, purpose = 'rag', } = req.body;
        if (!fileName?.trim() || !contentBase64?.trim()) {
            return res.status(400).json({ error: 'fileName and contentBase64 are required' });
        }
        const filePurpose = String(purpose).toLowerCase() === 'skills' ? 'skills' : 'rag';
        let buffer;
        try {
            buffer = Buffer.from(contentBase64, 'base64');
        }
        catch {
            return res.status(400).json({ error: 'Invalid file payload (base64)' });
        }
        if (buffer.length === 0) {
            return res.status(400).json({ error: 'Empty file' });
        }
        if (buffer.length > KB_MAX_BYTES) {
            return res.status(413).json({
                error: `Arquivo excede o limite de ${KB_MAX_BYTES / (1024 * 1024)} MB`,
            });
        }
        try {
            const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(email);
            if (!companiesId) {
                return res.status(403).json({ error: 'Empresa não encontrada para o usuário' });
            }
            const timestamp = Date.now();
            const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
            const filePath = `${companiesId}/${timestamp}_${sanitizedName}`;
            const resolvedMime = mimeType?.trim() || 'application/octet-stream';
            const uploadOptions = { upsert: false };
            if (!resolvedMime.startsWith('image/')) {
                uploadOptions.contentType = resolvedMime;
            }
            const { error: uploadError } = await supabase_1.supabase.storage
                .from(KB_BUCKET)
                .upload(filePath, buffer, uploadOptions);
            if (uploadError) {
                logger_1.default.error(`[FilesController.upload] Storage: ${uploadError.message}`);
                return res.status(500).json({
                    error: 'Erro ao fazer upload no storage',
                    details: uploadError.message,
                });
            }
            const { data: fileId, error: dbError } = await supabase_1.supabase.rpc('sp_create_file', {
                p_email: email.trim(),
                p_bucket: KB_BUCKET,
                p_path: filePath,
                p_original_name: fileName,
                p_mime_type: resolvedMime,
                p_size_bytes: buffer.length,
                p_file_purpose: filePurpose,
            });
            if (dbError) {
                await supabase_1.supabase.storage.from(KB_BUCKET).remove([filePath]);
                logger_1.default.error(`[FilesController.upload] sp_create_file: ${dbError.message}`);
                return res.status(500).json({
                    error: 'Erro ao salvar registro do arquivo',
                    details: dbError.message,
                });
            }
            return res.status(201).json({
                success: true,
                fileId,
                path: filePath,
                bucket: KB_BUCKET,
                originalName: fileName,
                mimeType: resolvedMime,
                sizeBytes: buffer.length,
                purpose: filePurpose,
            });
        }
        catch (error) {
            logger_1.default.error(`[FilesController.upload] Erro: ${error.message}`);
            return res.status(500).json({ error: error.message });
        }
    }
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
    async delete(req, res) {
        const { fileId } = req.params;
        const emailHeader = req.headers['x-user-email'];
        const email = (req.user?.email || (Array.isArray(emailHeader) ? emailHeader[0] : emailHeader) || req.body.email);
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
            const { data: file, error: fileError } = await supabase_1.supabase
                .from('tb_files')
                .select('id, bucket, path, original_name')
                .eq('id', fileId)
                .eq('companies_id', companiesId)
                .maybeSingle();
            if (fileError) {
                logger_1.default.error(`[FilesController.delete] Erro ao buscar arquivo: ${fileError.message}`);
                return res.status(500).json({ error: fileError.message });
            }
            if (!file) {
                return res.status(404).json({ error: 'File not found' });
            }
            if (file.bucket && file.path) {
                const { error: storageError } = await supabase_1.supabase.storage
                    .from(file.bucket)
                    .remove([file.path]);
                if (storageError) {
                    logger_1.default.error(`[FilesController.delete] Erro ao remover storage: ${storageError.message}`);
                    return res.status(500).json({
                        error: 'Failed to delete file from storage',
                        details: storageError.message
                    });
                }
            }
            const dependentDeletes = [
                {
                    label: 'tb_agent_files',
                    run: () => supabase_1.supabase
                        .from('tb_agent_files')
                        .delete()
                        .eq('file_id', fileId)
                        .eq('companies_id', companiesId)
                },
                {
                    label: 'tb_file_sections',
                    run: () => supabase_1.supabase
                        .from('tb_file_sections')
                        .delete()
                        .eq('file_id', fileId)
                        .eq('companies_id', companiesId)
                },
                {
                    label: 'tb_file_skills',
                    run: () => supabase_1.supabase
                        .from('tb_file_skills')
                        .delete()
                        .eq('file_id', fileId)
                        .eq('companies_id', companiesId)
                }
            ];
            for (const item of dependentDeletes) {
                const { error } = await item.run();
                if (error) {
                    logger_1.default.error(`[FilesController.delete] Erro ao limpar ${item.label}: ${error.message}`);
                    return res.status(500).json({
                        error: `Failed to delete related records from ${item.label}`,
                        details: error.message
                    });
                }
            }
            const { error: deleteFileError } = await supabase_1.supabase
                .from('tb_files')
                .delete()
                .eq('id', fileId)
                .eq('companies_id', companiesId);
            if (deleteFileError) {
                logger_1.default.error(`[FilesController.delete] Erro ao deletar arquivo: ${deleteFileError.message}`);
                return res.status(500).json({ error: deleteFileError.message });
            }
            logger_1.default.info(`[FilesController.delete] Arquivo deletado definitivamente`, {
                fileId,
                companiesId,
                originalName: file.original_name
            });
            return res.json({
                success: true,
                deleted_file_id: fileId,
                deleted_from_storage: Boolean(file.bucket && file.path)
            });
        }
        catch (error) {
            logger_1.default.error(`[FilesController.delete] Erro: ${error.message}`);
            return res.status(500).json({ error: error.message });
        }
    }
}
exports.FilesController = FilesController;
