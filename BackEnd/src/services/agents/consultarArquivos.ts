
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { generateEmbedding } from '../rag/embeddings.service'

/**
 * Busca conteúdo de arquivos vinculados a um agente usando busca vetorial (RAG)
 */
export async function consultarArquivos(
  agent_id: string,
  companies_id: string,
  user_message: string
): Promise<{ context: string | null; sources: string[]; sourceNames: string[] }> {
  console.log('[consultarArquivos] 🚀 FUNÇÃO CHAMADA (VECTOR SEARCH)', {
    agent_id,
    companies_id,
    user_message_length: user_message?.length || 0
  })

  try {
    if (!user_message || user_message.trim().length === 0) {
      return { context: null, sources: [], sourceNames: [] }
    }

    // 1️⃣ Buscar arquivos vinculados ao agente
    const { data: agentFiles, error: agentFilesError } = await supabase
      .from('tb_agent_files')
      .select('file_id')
      .eq('agent_id', agent_id)
      .eq('companies_id', companies_id)

    if (agentFilesError || !agentFiles || agentFiles.length === 0) {
      logger.info('[consultarArquivos] Nenhum arquivo vinculado ao agente')
      return { context: null, sources: [], sourceNames: [] }
    }

    const fileIds: string[] = agentFiles.map(af => af.file_id)

    // 2️⃣ Gerar embedding da pergunta
    const { embedding } = await generateEmbedding(user_message)

    // 3️⃣ Buscar chunks mais similares (RPC match_file_sections)
    const { data: chunks, error: matchError } = await supabase.rpc('match_file_sections', {
      query_embedding: embedding,
      match_threshold: 0.3, // Similaridade mínima (reduzida para testes)
      match_count: 5,       // Top 5 chunks
      filter_companies_id: companies_id,
      filter_file_ids: fileIds
    })

    if (matchError) {
      logger.error('[consultarArquivos] Erro na busca vetorial', { error: matchError })
      return { context: null, sources: [], sourceNames: [] }
    }

    if (!chunks || chunks.length === 0) {
      logger.info('[consultarArquivos] Nenhum trecho relevante encontrado')
      return { context: null, sources: [], sourceNames: [] }
    }

    logger.info(`[consultarArquivos] ${chunks.length} chunks relevantes encontrados`)

    // 4️⃣ Buscar nomes dos arquivos para referência
    const uniqueFileIds = [...new Set(chunks.map((c: any) => c.file_id))]
    const { data: files } = await supabase
      .from('tb_files')
      .select('id, original_name')
      .in('id', uniqueFileIds)

    const fileMap = new Map(files?.map(f => [f.id, f.original_name]) || [])

    // 5️⃣ Montar contexto
    const context = chunks
      .map((chunk: any) => {
        const fileName = fileMap.get(chunk.file_id) || 'arquivo desconhecido'
        return `[Fonte: ${fileName}]\n${chunk.content}`
      })
      .join('\n\n---\n\n')

    const sourceNames = Array.from(fileMap.values())

    return { context, sources: uniqueFileIds, sourceNames }

  } catch (error: any) {
    logger.error('[consultarArquivos] Erro inesperado', { error: error.message })
    return { context: null, sources: [], sourceNames: [] }
  }
}
