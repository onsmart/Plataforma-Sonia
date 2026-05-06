"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.consultarArquivos = consultarArquivos;
const supabase_1 = require("../../lib/supabase");
const logger_1 = __importDefault(require("../../lib/logger"));
const embeddings_service_1 = require("../rag/embeddings.service");
const plan_helper_1 = require("../../utils/plan-helper");
/**
 * Busca conteúdo de arquivos vinculados a um agente usando busca vetorial (RAG)
 */
async function consultarArquivos(agent_id, companies_id, user_message, linkedFileIds) {
    console.log('[consultarArquivos] 🚀 FUNÇÃO CHAMADA (VECTOR SEARCH)', {
        agent_id,
        companies_id,
        user_message_length: user_message?.length || 0
    });
    try {
        // Verificar se o plano permite RAG
        const ragCheck = await (0, plan_helper_1.canUseRAG)(companies_id);
        if (!ragCheck.allowed) {
            logger_1.default.warn('[consultarArquivos] 🚫 RAG não permitido para este plano:', {
                companiesId: companies_id,
                reason: ragCheck.reason
            });
            return {
                context: null,
                sources: [],
                sourceNames: [],
                error: ragCheck.reason || 'A funcionalidade RAG Knowledge Base está disponível apenas no plano Pro ou superior.'
            };
        }
        if (!user_message || user_message.trim().length === 0) {
            return { context: null, sources: [], sourceNames: [] };
        }
        let fileIds = Array.isArray(linkedFileIds) ? linkedFileIds.filter(Boolean) : [];
        if (fileIds.length === 0) {
            const { data: agentFiles, error: agentFilesError } = await supabase_1.supabase
                .from('tb_agent_files')
                .select('file_id')
                .eq('agent_id', agent_id)
                .eq('companies_id', companies_id);
            if (agentFilesError) {
                logger_1.default.info('[consultarArquivos] Erro ao buscar arquivos vinculados ao agente', {
                    error: agentFilesError.message,
                });
                return { context: null, sources: [], sourceNames: [] };
            }
            fileIds = (agentFiles || []).map(af => af.file_id);
        }
        if (fileIds.length === 0) {
            logger_1.default.info('[consultarArquivos] Nenhum arquivo vinculado ao agente');
            return { context: null, sources: [], sourceNames: [] };
        }
        // 2️⃣ Gerar embedding da pergunta
        const { embedding } = await (0, embeddings_service_1.generateEmbedding)(user_message);
        // 3️⃣ Buscar chunks mais similares (RPC match_file_sections)
        const { data: chunks, error: matchError } = await supabase_1.supabase.rpc('match_file_sections', {
            query_embedding: embedding,
            match_threshold: 0.3, // Similaridade mínima (reduzida para testes)
            match_count: 5, // Top 5 chunks
            filter_companies_id: companies_id,
            filter_file_ids: fileIds
        });
        if (matchError) {
            logger_1.default.error('[consultarArquivos] Erro na busca vetorial', { error: matchError });
            return { context: null, sources: [], sourceNames: [] };
        }
        if (!chunks || chunks.length === 0) {
            logger_1.default.info('[consultarArquivos] Nenhum trecho relevante encontrado');
            return { context: null, sources: [], sourceNames: [] };
        }
        logger_1.default.info(`[consultarArquivos] ${chunks.length} chunks relevantes encontrados`);
        // 4️⃣ Buscar nomes dos arquivos para referência
        const uniqueFileIds = Array.from(new Set(chunks.map((c) => c.file_id)));
        const { data: files } = await supabase_1.supabase
            .from('tb_files')
            .select('id, original_name')
            .in('id', uniqueFileIds);
        const fileMap = new Map(files?.map(f => [f.id, f.original_name]) || []);
        // 5️⃣ Montar contexto
        const context = chunks
            .map((chunk) => {
            const fileName = fileMap.get(chunk.file_id) || 'arquivo desconhecido';
            return `[Fonte: ${fileName}]\n${chunk.content}`;
        })
            .join('\n\n---\n\n');
        const sourceNames = Array.from(fileMap.values()).filter((name) => !!name);
        return { context, sources: uniqueFileIds, sourceNames };
    }
    catch (error) {
        logger_1.default.error('[consultarArquivos] Erro inesperado', { error: error.message });
        return { context: null, sources: [], sourceNames: [] };
    }
}
