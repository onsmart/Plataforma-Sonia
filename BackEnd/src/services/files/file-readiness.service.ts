import { supabase } from '../../lib/supabase'

export type FileReadiness = {
  fileId: string
  purpose: 'rag' | 'skills'
  ready: boolean
  reason?: string
}

/**
 * Arquivo está pronto para uso no agente quando foi processado com sucesso
 * (chunks para RAG ou skills extraídas).
 */
export async function getFileReadiness(
  fileId: string,
  companiesId: string
): Promise<FileReadiness> {
  const { data: file, error } = await supabase
    .from('tb_files')
    .select('id, file_purpose')
    .eq('id', fileId)
    .eq('companies_id', companiesId)
    .maybeSingle()

  if (error || !file) {
    return { fileId, purpose: 'rag', ready: false, reason: 'Arquivo não encontrado' }
  }

  const purpose = file.file_purpose === 'skills' ? 'skills' : 'rag'

  if (purpose === 'skills') {
    const { count } = await supabase
      .from('tb_file_skills')
      .select('id', { count: 'exact', head: true })
      .eq('file_id', fileId)
      .eq('companies_id', companiesId)

    if (!count || count === 0) {
      return {
        fileId,
        purpose,
        ready: false,
        reason: 'Skill não processada ou sem regras extraídas. Processe o arquivo na Base de Conhecimento.',
      }
    }
    return { fileId, purpose, ready: true }
  }

  const { count } = await supabase
    .from('tb_file_sections')
    .select('id', { count: 'exact', head: true })
    .eq('file_id', fileId)
    .eq('companies_id', companiesId)

  if (!count || count === 0) {
    return {
      fileId,
      purpose,
      ready: false,
      reason: 'RAG não indexado. Envie um arquivo válido e aguarde o processamento.',
    }
  }

  return { fileId, purpose, ready: true }
}

export async function filterReadyFileIds(
  fileIds: string[],
  companiesId: string
): Promise<{ readyIds: string[]; blocked: FileReadiness[] }> {
  const blocked: FileReadiness[] = []
  const readyIds: string[] = []

  for (const id of fileIds) {
    const status = await getFileReadiness(id, companiesId)
    if (status.ready) readyIds.push(id)
    else blocked.push(status)
  }

  return { readyIds, blocked }
}
