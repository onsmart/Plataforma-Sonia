"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAgentSystemPrompt = buildAgentSystemPrompt;
const agent_language_1 = require("../../utils/agent-language");
/**
 * Constrói o prompt de sistema final do agente combinando a personalidade
 * com a parte técnica do template e a política de idioma.
 */
function buildAgentSystemPrompt(personalityPrompt, templateRole, primaryLanguage, extraFeatures) {
    const personalityPart = personalityPrompt?.trim() || '';
    const technicalPart = templateRole?.trim() || '';
    const extraFeaturesPart = extraFeatures?.trim()
        ? `FUNCIONALIDADES EXTRAS DO AGENTE:\n${extraFeatures.trim()}`
        : '';
    const languageInstruction = (0, agent_language_1.buildAgentLanguageInstruction)(primaryLanguage);
    const parts = [personalityPart, technicalPart, extraFeaturesPart, languageInstruction].filter(Boolean);
    if (parts.length > 0) {
        return parts.join('\n\n');
    }
    return `Você é um assistente virtual útil.\n\n${languageInstruction}`;
}
