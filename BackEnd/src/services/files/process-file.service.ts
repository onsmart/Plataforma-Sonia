
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { generateEmbedding, chunkText } from '../rag/embeddings.service'

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

        // 3. Extrair texto (suporte básico para text/plain, md, csv, json)
        // TODO: Adicionar suporte a PDF (pdf-parse) e DOCX depois se necessário
        let textContent = ''
        if (file.mime_type?.startsWith('text/') ||
            file.mime_type === 'application/json' ||
            file.original_name?.endsWith('.txt') ||
            file.original_name?.endsWith('.md') ||
            file.original_name?.endsWith('.csv')) {
            textContent = await fileData.text()
        } else {
            // Tenta ler como texto de qualquer jeito
            try {
                textContent = await fileData.text()
            } catch {
                throw new Error('Formato de arquivo não suportado para vetorização (apenas texto por enquanto)')
            }
        }

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
        return { success: true, chunks: savedChunks }

    } catch (error: any) {
        logger.error(`[ProcessFile] Erro fatal: ${error.message}`)
        return { success: false, chunks: 0, error: error.message }
    }
}
