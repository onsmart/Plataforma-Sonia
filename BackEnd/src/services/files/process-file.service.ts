
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { generateEmbedding, chunkText } from '../rag/embeddings.service'
import { extractTextFromBuffer } from './extract-file-text'

/**
 * Processa um arquivo para gerar embeddings e salvar no banco
 */
export async function processFileForRAG(fileId: string, companiesId: string): Promise<{ success: boolean; chunks: number; error?: string }> {
    try {
        logger.info(`[ProcessFile] Iniciando processamento do arquivo ${fileId}`)

        // 1. Buscar metadados do arquivo
        const { data: file, error: fileError } = await supabase
            .from('tb_files')
            .select('*')
            .eq('id', fileId)
            .eq('companies_id', companiesId)
            .single()

        if (fileError || !file) {
            throw new Error(`Arquivo não encontrado: ${fileError?.message}`)
        }

        // 2. Baixar conteúdo do arquivo
        const { data: fileData, error: downloadError } = await supabase.storage
            .from(file.bucket)
            .download(file.path)

        if (downloadError) {
            throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`)
        }

        logger.info(`[ProcessFile] Informações do arquivo:`, {
            id: fileId,
            nome: file.original_name,
            mime_type: file.mime_type,
            tamanho: file.size_bytes,
            bucket: file.bucket,
            path: file.path,
        })

        const fileBuffer = Buffer.from(await fileData.arrayBuffer())
        const textContent = await extractTextFromBuffer({
            buffer: fileBuffer,
            originalName: file.original_name,
            mimeType: file.mime_type,
        })
        logger.info(`[ProcessFile] Texto extraído: ${textContent.length} caracteres`)

        if (!textContent || textContent.trim().length === 0) {
            throw new Error('Arquivo vazio ou sem texto extraível')
        }

        // 4. Quebrar em chunks
        const chunks = chunkText(textContent)
        logger.info(`[ProcessFile] Arquivo quebrado em ${chunks.length} chunks`)

        // 5. Gerar embeddings e salvar
        let savedChunks = 0

        // Limpa chunks antigos deste arquivo se houver (reprocessamento)
        await supabase.from('tb_file_sections').delete().eq('file_id', fileId)

        for (const chunk of chunks) {
            try {
                const { embedding } = await generateEmbedding(chunk)

                const { error: insertError } = await supabase
                    .from('tb_file_sections')
                    .insert({
                        file_id: fileId,
                        companies_id: companiesId,
                        content: chunk,
                        token_count: Math.ceil(chunk.length / 4), // Estimativa grosseira
                        embedding: embedding
                    })

                if (insertError) {
                    logger.warn(`[ProcessFile] Erro ao salvar chunk: ${insertError.message}`)
                } else {
                    savedChunks++
                }
            } catch (err: any) {
                logger.error(`[ProcessFile] Erro ao gerar embedding para chunk: ${err.message}`)
            }
        }

        logger.info(`[ProcessFile] Processamento concluído. ${savedChunks}/${chunks.length} chunks salvos.`)

        if (savedChunks === 0) {
            return {
                success: false,
                chunks: 0,
                error: 'Nenhum trecho indexado. Verifique se o arquivo tem texto útil para RAG.',
            }
        }

        return { success: true, chunks: savedChunks }

    } catch (error: any) {
        logger.error(`[ProcessFile] Erro fatal: ${error.message}`)
        return { success: false, chunks: 0, error: error.message }
    }
}
