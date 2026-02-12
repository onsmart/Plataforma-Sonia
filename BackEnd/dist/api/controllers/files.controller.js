"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilesController = void 0;
const process_file_service_1 = require("../../services/files/process-file.service");
const company_helper_1 = require("../../utils/company-helper");
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
            // Processar (pode demorar, então idealmente seria async/queue, mas para MVP vamos await)
            const result = await (0, process_file_service_1.processFileForRAG)(String(fileId), String(companiesId));
            if (result.success) {
                return res.json({
                    success: true,
                    message: 'File processed successfully',
                    chunks: result.chunks
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
}
exports.FilesController = FilesController;
