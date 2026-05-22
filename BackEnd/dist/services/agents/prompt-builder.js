"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAgentSystemPrompt = buildAgentSystemPrompt;
const agent_language_1 = require("../../utils/agent-language");
const agent_integration_tools_prompt_1 = require("./agent-integration-tools-prompt");
/**
 * Prompt de sistema: personalidade + papel do template (editavel) + ferramentas ativas (automatico).
 * Nao despeja JSON de extra_features — comportamento de negocio vem do template.
 */
function buildAgentSystemPrompt(personalityPrompt, templateRole, primaryLanguage, extraFeaturesRaw) {
    const parts = (0, agent_integration_tools_prompt_1.buildAgentSystemPromptSections)({
        personalityPrompt,
        templateRole,
        extraFeaturesRaw,
    });
    const languageInstruction = (0, agent_language_1.buildAgentLanguageInstruction)(primaryLanguage);
    parts.push(languageInstruction);
    if (parts.length > 1) {
        return parts.join('\n\n');
    }
    return `Você é um assistente virtual útil.\n\n${languageInstruction}`;
}
