/**
 * Constrói o prompt de sistema final do agente combinando a parte técnica (template) 
 * com a personalidade (instruções específicas do agente).
 */
export function buildAgentSystemPrompt(personalityPrompt: string | null | undefined, templateRole: string | null | undefined): string {
    const technicalPart = templateRole?.trim() || "";
    const personalityPart = personalityPrompt?.trim() || "";

    // Se ambos existirem, concatena com espaçamento. 
    // Se apenas um existir, retorna ele limpo.
    if (technicalPart && personalityPart) {
        return `${technicalPart}\n\n${personalityPart}`;
    }

    return technicalPart || personalityPart || "Você é um assistente virtual útil.";
}
