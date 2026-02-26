"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAgentSystemPrompt = buildAgentSystemPrompt;
/**
 * Constrói o prompt de sistema final do agente combinando a parte técnica (template)
 * com a personalidade (instruções específicas do agente).
 */
function buildAgentSystemPrompt(personalityPrompt, templateRole) {
    const technicalPart = templateRole?.trim() || "";
    const personalityPart = personalityPrompt?.trim() || "";
    // Se ambos existirem, concatena com espaçamento. 
    // Se apenas um existir, retorna ele limpo.
    if (technicalPart && personalityPart) {
        return `${technicalPart}\n\n${personalityPart}`;
    }
    return technicalPart || personalityPart || "Você é um assistente virtual útil.";
}
