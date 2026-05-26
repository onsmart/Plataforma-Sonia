"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processFileForRAG = processFileForRAG;
const supabase_1 = require("../../lib/supabase");
const logger_1 = __importDefault(require("../../lib/logger"));
const embeddings_service_1 = require("../rag/embeddings.service");
const mammoth_1 = __importDefault(require("mammoth"));
// Importação para pdf-parse (v2 API - CommonJS)
const { PDFParse } = require('pdf-parse');
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
        // 3. Extrair texto (suporte para text/plain, md, csv, json, PDF e DOCX)
        let textContent = '';
        // Logs de debug
        logger_1.default.info(`[ProcessFile] Informações do arquivo:`, {
            id: fileId,
            nome: file.original_name,
            mime_type: file.mime_type,
            tamanho: file.size_bytes,
            bucket: file.bucket,
            path: file.path
        });
        const isPdfByMime = file.mime_type === 'application/pdf';
        const isPdfByExt = file.original_name?.toLowerCase().endsWith('.pdf');
        logger_1.default.info(`[ProcessFile] Detecção PDF - MIME: ${isPdfByMime}, Extensão: ${isPdfByExt}`);
        // PDF
        if (isPdfByMime || isPdfByExt) {
            let parser = null;
            try {
                logger_1.default.info(`[ProcessFile] Processando arquivo PDF: ${file.original_name}`);
                const pdfBuffer = await fileData.arrayBuffer();
                logger_1.default.info(`[ProcessFile] Buffer PDF obtido: ${pdfBuffer.byteLength} bytes`);
                // Nova API do pdf-parse v2
                parser = new PDFParse({ data: Buffer.from(pdfBuffer) });
                const result = await parser.getText();
                textContent = result.text;
                logger_1.default.info(`[ProcessFile] PDF processado com sucesso: ${textContent.length} caracteres extraídos, ${result.total || 'N/A'} páginas`);
            }
            catch (error) {
                logger_1.default.error(`[ProcessFile] Erro detalhado ao processar PDF:`, error);
                throw new Error(`Erro ao processar PDF: ${error.message}`);
            }
            finally {
                // Limpar recursos do parser
                if (parser) {
                    try {
                        await parser.destroy();
                    }
                    catch (destroyError) {
                        logger_1.default.warn(`[ProcessFile] Erro ao destruir parser PDF: ${destroyError.message}`);
                    }
                }
            }
        }
        // DOCX
        else if (file.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.original_name?.toLowerCase().endsWith('.docx')) {
            try {
                logger_1.default.info(`[ProcessFile] Processando arquivo DOCX: ${file.original_name}`);
                const docxBuffer = await fileData.arrayBuffer();
                const result = await mammoth_1.default.extractRawText({ arrayBuffer: docxBuffer });
                textContent = result.value;
                logger_1.default.info(`[ProcessFile] DOCX processado: ${textContent.length} caracteres extraídos`);
            }
            catch (error) {
                throw new Error(`Erro ao processar DOCX: ${error.message}`);
            }
        }
        // Texto simples (txt, md, csv, json)
        else if (file.mime_type === 'text/plain' ||
            file.mime_type === 'text/markdown' ||
            file.mime_type === 'text/csv' ||
            file.mime_type === 'application/json' ||
            file.mime_type?.startsWith('text/') ||
            file.original_name?.endsWith('.txt') ||
            file.original_name?.endsWith('.md') ||
            file.original_name?.endsWith('.csv') ||
            file.original_name?.endsWith('.json')) {
            logger_1.default.info(`[ProcessFile] Processando arquivo de texto: ${file.original_name}`);
            textContent = await fileData.text();
            logger_1.default.info(`[ProcessFile] Texto extraído: ${textContent.length} caracteres`);
        }
        else {
            // Tenta ler como texto de qualquer jeito
            logger_1.default.warn(`[ProcessFile] Tipo de arquivo não reconhecido, tentando ler como texto. MIME: ${file.mime_type}, Nome: ${file.original_name}`);
            try {
                textContent = await fileData.text();
                if (textContent && textContent.trim().length > 0) {
                    logger_1.default.info(`[ProcessFile] Arquivo lido como texto com sucesso: ${textContent.length} caracteres`);
                }
                else {
                    throw new Error('Arquivo vazio ou sem texto extraível');
                }
            }
            catch (err) {
                logger_1.default.error(`[ProcessFile] Falha ao ler arquivo como texto: ${err.message}`);
                throw new Error(`Formato de arquivo não suportado para vetorização. Formatos suportados: TXT, MD, CSV, JSON, PDF, DOCX. Erro: ${err.message}`);
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
        if (savedChunks === 0) {
            return {
                success: false,
                chunks: 0,
                error: 'Nenhum trecho indexado. Verifique se o arquivo tem texto útil para RAG.',
            };
        }
        return { success: true, chunks: savedChunks };
    }
    catch (error) {
        logger_1.default.error(`[ProcessFile] Erro fatal: ${error.message}`);
        return { success: false, chunks: 0, error: error.message };
    }
}
