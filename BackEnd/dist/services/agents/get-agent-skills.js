"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentSkills = getAgentSkills;
const supabase_1 = require("../../lib/supabase");
const logger_1 = __importDefault(require("../../lib/logger"));
/**
 * Busca skills extraídos dos arquivos vinculados a um agente
 * Retorna lista de skills únicos (por nome) com suas descrições
 */
async function getAgentSkills(agentId, companiesId) {
    try {
        logger_1.default.info(`[getAgentSkills] Buscando skills do agente ${agentId}`);
        // 1. Buscar arquivos vinculados ao agente
        const { data: agentFiles, error: agentFilesError } = await supabase_1.supabase
            .from('tb_agent_files')
            .select('file_id')
            .eq('agent_id', agentId)
            .eq('companies_id', companiesId);
        if (agentFilesError) {
            logger_1.default.warn(`[getAgentSkills] Erro ao buscar arquivos do agente: ${agentFilesError.message}`);
            return [];
        }
        if (!agentFiles || agentFiles.length === 0) {
            logger_1.default.info(`[getAgentSkills] Nenhum arquivo vinculado ao agente`);
            return [];
        }
        const fileIds = agentFiles.map(af => af.file_id);
        // 2. Buscar skills desses arquivos (apenas skills, não RAG)
        const { data: skills, error: skillsError } = await supabase_1.supabase
            .from('tb_file_skills')
            .select('skill_name, skill_description, skill_type')
            .in('file_id', fileIds)
            .eq('companies_id', companiesId);
        if (skillsError) {
            logger_1.default.warn(`[getAgentSkills] Erro ao buscar skills: ${skillsError.message}`);
            return [];
        }
        if (!skills || skills.length === 0) {
            logger_1.default.info(`[getAgentSkills] Nenhum skill encontrado nos arquivos do agente`);
            return [];
        }
        // 3. Remover duplicatas (mesmo nome) e manter o mais completo
        const skillsMap = new Map();
        for (const skill of skills) {
            const name = skill.skill_name?.trim();
            if (!name)
                continue;
            // Se já existe, mantém o que tem descrição mais completa
            if (skillsMap.has(name)) {
                const existing = skillsMap.get(name);
                if (!existing.description && skill.skill_description) {
                    skillsMap.set(name, {
                        name,
                        description: skill.skill_description,
                        type: skill.skill_type || existing.type
                    });
                }
            }
            else {
                skillsMap.set(name, {
                    name,
                    description: skill.skill_description || null,
                    type: skill.skill_type || null
                });
            }
        }
        const uniqueSkills = Array.from(skillsMap.values());
        logger_1.default.info(`[getAgentSkills] ${uniqueSkills.length} skills únicos encontrados para o agente`);
        return uniqueSkills;
    }
    catch (error) {
        logger_1.default.error(`[getAgentSkills] Erro fatal: ${error.message}`);
        return [];
    }
}
