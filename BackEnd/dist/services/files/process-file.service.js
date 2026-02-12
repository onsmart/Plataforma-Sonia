"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processFileForRAG = processFileForRAG;
const supabase_1 = require("../../lib/supabase");
const logger_1 = __importDefault(require("../../lib/logger"));
const embeddings_service_1 = require("../rag/embeddings.service");
/**
 * Processa um arquivo para gerar embeddings e salvar no banco
 */
async function processFileForRAG(fileId, companiesId) {
    try {
        logger_1.default.info(`[ProcessFile] Iniciando processamento do arquivo ${fileId}`);
        // 1. Buscar metadados do arquivo
        const { data: file, error: fileError } = await supabase_1.supabase
            .from('tb_files')
            .select('*')
            .eq('id', fileId)
            .eq('companies_id', companiesId)
            .single();
        if (fileError || !file) {
            throw new Error(`Arquivo não encontrado: ${fileError?.message}`);
        }
        // 2. Baixar conteúdo do arquivo
        const { data: fileData, error: downloadError } = await supabase_1.supabase.storage
            .from(file.bucket)
            .download(file.path);
        if (downloadError) {
            throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`);
        }
        // 3. Extrair texto (suporte básico para text/plain, md, csv, json)
        // TODO: Adicionar suporte a PDF (pdf-parse) e DOCX depois se necessário
        let textContent = '';
        if (file.mime_type?.startsWith('text/') ||
            file.mime_type === 'application/json' ||
            file.original_name?.endsWith('.txt') ||
            file.original_name?.endsWith('.md') ||
            file.original_name?.endsWith('.csv')) {
            textContent = await fileData.text();
        }
        else {
            // Tenta ler como texto de qualquer jeito
            try {
                textContent = await fileData.text();
            }
            catch {
                throw new Error('Formato de arquivo não suportado para vetorização (apenas texto por enquanto)');
            }
        }
        if (!textContent || textContent.trim().length === 0) {
            throw new Error('Arquivo vazio ou sem texto extraível');
        }
        // 4. Quebrar em chunks
        const chunks = (0, embeddings_service_1.chunkText)(textContent);
        logger_1.default.info(`[ProcessFile] Arquivo quebrado em ${chunks.length} chunks`);
        // 5. Gerar embeddings e salvar
        let savedChunks = 0;
        // Limpa chunks antigos deste arquivo se houver (reprocessamento)
        await supabase_1.supabase.from('tb_file_sections').delete().eq('file_id', fileId);
        for (const chunk of chunks) {
            try {
                const { embedding } = await (0, embeddings_service_1.generateEmbedding)(chunk);
                const { error: insertError } = await supabase_1.supabase
                    .from('tb_file_sections')
                    .insert({
                    file_id: fileId,
                    companies_id: companiesId,
                    content: chunk,
                    token_count: Math.ceil(chunk.length / 4), // Estimativa grosseira
                    embedding: embedding
                });
                if (insertError) {
                    logger_1.default.warn(`[ProcessFile] Erro ao salvar chunk: ${insertError.message}`);
                }
                else {
                    savedChunks++;
                }
            }
            catch (err) {
                logger_1.default.error(`[ProcessFile] Erro ao gerar embedding para chunk: ${err.message}`);
            }
        }
        logger_1.default.info(`[ProcessFile] Processamento concluído. ${savedChunks}/${chunks.length} chunks salvos.`);
        return { success: true, chunks: savedChunks };
    }
    catch (error) {
        logger_1.default.error(`[ProcessFile] Erro fatal: ${error.message}`);
        return { success: false, chunks: 0, error: error.message };
    }
}
