"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAgentSystemPrompt = buildAgentSystemPrompt;
/**
 * Constrói o prompt de sistema final do agente combinando a personalidade (instruções específicas do agente)
 * com a parte técnica (template/system_prompt).
 *
 * Ordem: personality_prompt PRIMEIRO + description do template SEGUNDO
 */
function buildAgentSystemPrompt(personalityPrompt, templateRole) {
    const personalityPart = personalityPrompt?.trim() || "";
    const technicalPart = templateRole?.trim() || "";
    // Se ambos existirem, concatena com personality PRIMEIRO, depois template
    if (personalityPart && technicalPart) {
        return `${personalityPart}\n\n${technicalPart}`;
    }
    // Se apenas um existir, retorna ele limpo (prioriza personality se existir)
    return personalityPart || technicalPart || "Você é um assistente virtual útil.";
}
