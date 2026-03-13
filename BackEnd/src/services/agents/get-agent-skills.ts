import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

/**
 * Busca skills extraídos dos arquivos vinculados a um agente
 * Retorna lista de skills únicos (por nome) com suas descrições
 */
export async function getAgentSkills(
  agentId: string,
  companiesId: string
): Promise<Array<{ name: string; description: string | null; type: string | null }>> {
  try {
    logger.info(`[getAgentSkills] Buscando skills do agente ${agentId}`)

    // 1. Buscar arquivos vinculados ao agente
    const { data: agentFiles, error: agentFilesError } = await supabase
      .from('tb_agent_files')
      .select('file_id')
      .eq('agent_id', agentId)
      .eq('companies_id', companiesId)

    if (agentFilesError) {
      logger.warn(`[getAgentSkills] Erro ao buscar arquivos do agente: ${agentFilesError.message}`)
      return []
    }

    if (!agentFiles || agentFiles.length === 0) {
      logger.info(`[getAgentSkills] Nenhum arquivo vinculado ao agente`)
      return []
    }

    const fileIds: string[] = agentFiles.map(af => af.file_id)

    // 2. Buscar skills desses arquivos (apenas skills, não RAG)
    const { data: skills, error: skillsError } = await supabase
      .from('tb_file_skills')
      .select('skill_name, skill_description, skill_type')
      .in('file_id', fileIds)
      .eq('companies_id', companiesId)

    if (skillsError) {
      logger.warn(`[getAgentSkills] Erro ao buscar skills: ${skillsError.message}`)
      return []
    }

    if (!skills || skills.length === 0) {
      logger.info(`[getAgentSkills] Nenhum skill encontrado nos arquivos do agente`)
      return []
    }

    // 3. Remover duplicatas (mesmo nome) e manter o mais completo
    const skillsMap = new Map<string, { name: string; description: string | null; type: string | null }>()
    
    for (const skill of skills) {
      const name = skill.skill_name?.trim()
      if (!name) continue

      // Se já existe, mantém o que tem descrição mais completa
      if (skillsMap.has(name)) {
        const existing = skillsMap.get(name)!
        if (!existing.description && skill.skill_description) {
          skillsMap.set(name, {
            name,
            description: skill.skill_description,
            type: skill.skill_type || existing.type
          })
        }
      } else {
        skillsMap.set(name, {
          name,
          description: skill.skill_description || null,
          type: skill.skill_type || null
        })
      }
    }

    const uniqueSkills = Array.from(skillsMap.values())
    
    logger.info(`[getAgentSkills] ${uniqueSkills.length} skills únicos encontrados para o agente`)
    
    return uniqueSkills

  } catch (error: any) {
    logger.error(`[getAgentSkills] Erro fatal: ${error.message}`)
    return []
  }
}
