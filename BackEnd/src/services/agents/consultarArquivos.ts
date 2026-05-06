
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { generateEmbedding } from '../rag/embeddings.service'
import { canUseRAG } from '../../utils/plan-helper'

/**
 * Busca conteúdo de arquivos vinculados a um agente usando busca vetorial (RAG)
 */
export async function consultarArquivos(
  agent_id: string,
  companies_id: string,
  user_message: string,
  linkedFileIds?: string[]
): Promise<{ context: string | null; sources: string[]; sourceNames: string[]; error?: string }> {
  console.log('[consultarArquivos] 🚀 FUNÇÃO CHAMADA (VECTOR SEARCH)', {
    agent_id,
    companies_id,
    user_message_length: user_message?.length || 0
  })

  try {
    // Verificar se o plano permite RAG
    const ragCheck = await canUseRAG(companies_id)
    if (!ragCheck.allowed) {
      logger.warn('[consultarArquivos] 🚫 RAG não permitido para este plano:', {
        companiesId: companies_id,
        reason: ragCheck.reason
      })
      return { 
        context: null, 
        sources: [], 
        sourceNames: [],
        error: ragCheck.reason || 'A funcionalidade RAG Knowledge Base está disponível apenas no plano Pro ou superior.'
      }
    }

    if (!user_message || user_message.trim().length === 0) {
      return { context: null, sources: [], sourceNames: [] }
    }

    let fileIds: string[] = Array.isArray(linkedFileIds) ? linkedFileIds.filter(Boolean) : []

    if (fileIds.length === 0) {
      const { data: agentFiles, error: agentFilesError } = await supabase
        .from('tb_agent_files')
        .select('file_id')
        .eq('agent_id', agent_id)
        .eq('companies_id', companies_id)

      if (agentFilesError) {
        logger.info('[consultarArquivos] Erro ao buscar arquivos vinculados ao agente', {
          error: agentFilesError.message,
        })
        return { context: null, sources: [], sourceNames: [] }
      }

      fileIds = (agentFiles || []).map(af => af.file_id)
    }

    if (fileIds.length === 0) {
      logger.info('[consultarArquivos] Nenhum arquivo vinculado ao agente')
      return { context: null, sources: [], sourceNames: [] }
    }

    const { data: fileMeta, error: metaError } = await supabase
      .from('tb_files')
      .select('id, file_purpose')
      .in('id', fileIds)

    if (metaError) {
      logger.warn('[consultarArquivos] Falha ao filtrar arquivos por finalidade', {
        message: metaError.message,
      })
      return { context: null, sources: [], sourceNames: [] }
    }

    const ragFileIds = (fileMeta || [])
      .filter((f: any) => !f.file_purpose || f.file_purpose === 'rag')
      .map((f: any) => f.id as string)

    if (ragFileIds.length === 0) {
      logger.info('[consultarArquivos] Nenhum arquivo RAG vinculado ao agente (apenas skills ou sem finalidade)')
      return { context: null, sources: [], sourceNames: [] }
    }

    // 2️⃣ Gerar embedding da pergunta
    const { embedding } = await generateEmbedding(user_message)

    // 3️⃣ Buscar chunks mais similares (RPC match_file_sections)
    const { data: chunks, error: matchError } = await supabase.rpc('match_file_sections', {
      query_embedding: embedding,
      match_threshold: 0.3, // Similaridade mínima (reduzida para testes)
      match_count: 5,       // Top 5 chunks
      filter_companies_id: companies_id,
      filter_file_ids: ragFileIds
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
    const uniqueFileIds: string[] = Array.from(new Set(chunks.map((c: any) => c.file_id as string)))
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

    const sourceNames = Array.from(fileMap.values()).filter((name): name is string => !!name)

    return { context, sources: uniqueFileIds, sourceNames }

  } catch (error: any) {
    logger.error('[consultarArquivos] Erro inesperado', { error: error.message })
    return { context: null, sources: [], sourceNames: [] }
  }
}
