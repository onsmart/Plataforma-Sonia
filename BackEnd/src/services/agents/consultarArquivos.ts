import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

/**
 * Busca conteúdo de arquivos vinculados a um agente e retorna texto para uso no prompt
 * 
 * @param agent_id - ID do agente
 * @param companies_id - ID da empresa (para multi-tenancy)
 * @param user_message - Mensagem do usuário para filtrar relevância
 * @returns Contexto extraído dos arquivos ou null se não houver arquivos relevantes
 */
export async function consultarArquivos(
  agent_id: string,
  companies_id: string,
  user_message: string
): Promise<{ context: string | null }> {
  console.log('[consultarArquivos] 🚀 FUNÇÃO CHAMADA', {
    agent_id,
    companies_id,
    user_message_length: user_message?.length || 0,
    user_message_preview: user_message?.substring(0, 100) || 'vazia'
  })
  
  try {
    logger.info('[consultarArquivos] Iniciando busca de arquivos', {
      agent_id,
      companies_id,
      user_message_length: user_message?.length || 0
    })
    console.log('[consultarArquivos] 📝 Iniciando busca de arquivos', {
      agent_id,
      companies_id,
      user_message_length: user_message?.length || 0
    })

    // 1️⃣ Buscar arquivos permitidos vinculados ao agente
    // Primeiro, buscar os file_ids vinculados ao agente
    const { data: agentFiles, error: agentFilesError } = await supabase
      .from('tb_agent_files')
      .select('file_id')
      .eq('agent_id', agent_id)
      .eq('companies_id', companies_id)

    if (agentFilesError) {
      logger.error('[consultarArquivos] Erro ao buscar vínculos de arquivos', { error: agentFilesError })
      return { context: null }
    }

    if (!agentFiles || agentFiles.length === 0) {
      logger.info('[consultarArquivos] Nenhum arquivo vinculado ao agente', {
        agent_id,
        companies_id
      })
      console.log('[consultarArquivos] ⚠️ Nenhum arquivo vinculado ao agente', {
        agent_id,
        companies_id,
        agentFilesCount: agentFiles?.length || 0
      })
      return { context: null }
    }
    
    logger.info('[consultarArquivos] Arquivos encontrados vinculados ao agente', {
      agent_id,
      companies_id,
      fileCount: agentFiles.length,
      fileIds: agentFiles.map(af => af.file_id)
    })
    console.log('[consultarArquivos] ✅ Arquivos encontrados vinculados ao agente', {
      agent_id,
      companies_id,
      fileCount: agentFiles.length,
      fileIds: agentFiles.map(af => af.file_id)
    })

    const fileIds = agentFiles.map(af => af.file_id)

    // Agora buscar os arquivos
    const { data: files, error: filesError } = await supabase
      .from('tb_files')
      .select(`
        id,
        bucket,
        path,
        original_name,
        mime_type
      `)
      .eq('companies_id', companies_id)
      .eq('is_deleted', false)
      .in('id', fileIds)

    if (filesError) {
      logger.error('[consultarArquivos] Erro ao buscar arquivos', { error: filesError })
      return { context: null }
    }

    if (!files || files.length === 0) {
      logger.info('[consultarArquivos] Nenhum arquivo vinculado ao agente')
      return { context: null }
    }

    logger.info('[consultarArquivos] Arquivos encontrados', { count: files.length })

    // 2️⃣ Baixar conteúdo dos arquivos e filtrar por relevância
    const relevantFiles: Array<{ id: string; content: string }> = []

    for (const file of files) {
      try {
        // Baixar arquivo do Supabase Storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(file.bucket)
          .download(file.path)

        if (downloadError) {
          logger.warn('[consultarArquivos] Erro ao baixar arquivo', {
            file_id: file.id,
            path: file.path,
            error: downloadError.message
          })
          continue
        }

        // Converter para texto
        let textContent = ''
        if (file.mime_type?.startsWith('text/') || 
            file.mime_type === 'application/json' ||
            file.original_name?.endsWith('.txt') ||
            file.original_name?.endsWith('.md') ||
            file.original_name?.endsWith('.csv')) {
          textContent = await fileData.text()
        } else {
          // Para outros tipos, tentar como texto
          try {
            textContent = await fileData.text()
          } catch {
            logger.warn('[consultarArquivos] Arquivo não é texto, ignorando', {
              file_id: file.id,
              mime_type: file.mime_type
            })
            continue
          }
        }

        // 3️⃣ Filtrar por relevância (comparação simples de palavras-chave)
        const isRelevant = filtrarPorRelevancia(textContent, user_message)

        if (isRelevant) {
          relevantFiles.push({
            id: file.id,
            content: textContent
          })
          logger.info('[consultarArquivos] Arquivo relevante encontrado', {
            file_id: file.id,
            original_name: file.original_name
          })
        }
      } catch (error: any) {
        logger.error('[consultarArquivos] Erro ao processar arquivo', {
          file_id: file.id,
          error: error.message
        })
        continue
      }
    }

    if (relevantFiles.length === 0) {
      logger.info('[consultarArquivos] Nenhum arquivo relevante encontrado')
      return { context: null }
    }

    // 4️⃣ Registrar uso dos arquivos em tb_file_usage
    for (const file of relevantFiles) {
      try {
        // Inserir registro de uso (a tabela pode ter agent_id ou usar context_id)
        const usageData: any = {
          companies_id,
          file_id: file.id,
          context: 'agent_knowledge',
          context_id: agent_id,
          user_message: user_message ? user_message.substring(0, 1000) : null // Limitar tamanho
        }

        const { error: usageError } = await supabase
          .from('tb_file_usage')
          .insert(usageData)

        if (usageError) {
          logger.warn('[consultarArquivos] Erro ao registrar uso do arquivo', {
            file_id: file.id,
            error: usageError.message
          })
        } else {
          logger.info('[consultarArquivos] Uso do arquivo registrado', { file_id: file.id })
        }
      } catch (error: any) {
        logger.warn('[consultarArquivos] Erro ao registrar uso', {
          file_id: file.id,
          error: error.message
        })
      }
    }

    // 5️⃣ Concatenar conteúdo dos arquivos relevantes
    const context = relevantFiles
      .map(file => file.content)
      .join('\n\n---\n\n')
      .trim()

    logger.info('[consultarArquivos] Contexto gerado', {
      files_count: relevantFiles.length,
      context_length: context.length
    })

    return { context }
  } catch (error: any) {
    logger.error('[consultarArquivos] Erro inesperado', {
      error: error.message,
      stack: error.stack
    })
    return { context: null }
  }
}

/**
 * Filtra arquivos por relevância baseado na mensagem do usuário
 * Usa uma abordagem melhorada com:
 * - Extração inteligente de palavras-chave
 * - Contagem de ocorrências (TF simples)
 * - Remoção de stop words em português
 * - Score de relevância baseado em múltiplos fatores
 */
function filtrarPorRelevancia(
  fileContent: string,
  userMessage: string
): boolean {
  if (!userMessage || userMessage.trim() === '') {
    // Se não há mensagem, retorna todos os arquivos
    return true
  }

  // Normalizar textos (minúsculas, remover acentos, pontuação)
  const normalizeText = (text: string): string => {
    return text.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ') // Remove pontuação
      .replace(/\s+/g, ' ') // Normaliza espaços
      .trim()
  }

  const normalizedContent = normalizeText(fileContent)
  const normalizedMessage = normalizeText(userMessage)

  // Stop words em português (palavras comuns que não agregam significado)
  const stopWords = new Set([
    'como', 'qual', 'quando', 'onde', 'porque', 'porque', 'que', 'quem',
    'para', 'com', 'de', 'da', 'do', 'em', 'na', 'no', 'a', 'o', 'e', 'ou',
    'mas', 'se', 'não', 'mais', 'muito', 'mais', 'também', 'já', 'ainda',
    'são', 'ser', 'estar', 'ter', 'fazer', 'poder', 'ver', 'saber', 'dar',
    'dizer', 'ir', 'vir', 'chegar', 'ficar', 'passar', 'deixar', 'levar',
    'trazer', 'encontrar', 'conseguir', 'precisar', 'querer', 'gostar',
    'este', 'esta', 'isso', 'aquele', 'aquela', 'um', 'uma', 'uns', 'umas'
  ])

  // Extrair palavras-chave da mensagem (palavras significativas)
  const extractKeywords = (text: string): string[] => {
    return text
      .split(/\s+/)
      .filter(word => word.length >= 3) // Mínimo 3 caracteres
      .filter(word => !stopWords.has(word)) // Remove stop words
      .filter(word => !/^\d+$/.test(word)) // Remove números puros
      .filter((word, index, arr) => arr.indexOf(word) === index) // Remove duplicatas
  }

  const keywords = extractKeywords(normalizedMessage)

  if (keywords.length === 0) {
    // Se não há palavras-chave significativas, retorna todos
    return true
  }

  // Calcular score de relevância
  let relevanceScore = 0
  let matchedKeywords = 0

  for (const keyword of keywords) {
    // Contar ocorrências da palavra-chave no conteúdo
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
    const matches = normalizedContent.match(regex)
    const count = matches ? matches.length : 0

    if (count > 0) {
      matchedKeywords++
      // Score baseado na frequência (logarítmico para evitar dominância de uma palavra)
      relevanceScore += Math.log(1 + count)
    }
  }

  // Calcular porcentagem de palavras-chave encontradas
  const matchRatio = matchedKeywords / keywords.length

  // Critérios de relevância:
  // 1. Pelo menos 30% das palavras-chave devem aparecer
  // 2. Score mínimo de 1.0 (pelo menos uma ocorrência de uma palavra-chave)
  const isRelevant = matchRatio >= 0.3 && relevanceScore >= 1.0

  logger.info('[filtrarPorRelevancia] Análise de relevância', {
    totalKeywords: keywords.length,
    matchedKeywords,
    matchRatio: (matchRatio * 100).toFixed(1) + '%',
    relevanceScore: relevanceScore.toFixed(2),
    isRelevant
  })

  return isRelevant
}
