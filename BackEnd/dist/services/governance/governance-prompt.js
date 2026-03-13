"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.injectGovernanceRules = injectGovernanceRules;
/**
 * Injeta regras de governança no System Prompt
 * @param basePrompt Prompt base do agente
 * @param config Configuração de governança
 * @returns Prompt enriquecido com regras de governança
 */
function injectGovernanceRules(basePrompt, config) {
    let enhancedPrompt = basePrompt;
    const rules = [];
    // 1. Anti-Hallucination (RAG Enforcement)
    if (config.filters.antiHallucination) {
        rules.push(`REGRA CRÍTICA - ANTI-ALUCINAÇÃO:
- Você DEVE responder APENAS com base nas informações fornecidas no contexto (RAG).
- Se não encontrar a informação no contexto fornecido, você DEVE dizer explicitamente: "Não encontrei essa informação na base de conhecimento disponível."
- NUNCA invente, suponha ou crie informações que não estejam no contexto fornecido.
- Se o usuário perguntar algo fora do escopo do contexto, seja honesto e diga que não tem essa informação.`);
    }
    // 2. Competitor Blocking
    if (config.filters.competitorBlocking) {
        rules.push(`REGRA CRÍTICA - BLOQUEIO DE CONCORRENTES:
- Você está PROIBIDO de mencionar, elogiar, recomendar ou discutir sobre concorrentes, plataformas alternativas ou serviços similares.
- Se o usuário perguntar sobre concorrentes, redirecione educadamente: "Não posso discutir sobre outras plataformas. Como posso ajudá-lo com nossos produtos e serviços?"
- Foque sempre em destacar os benefícios e características dos nossos próprios produtos e serviços.`);
    }
    // 3. Safety Thresholds (podem ser usados para ajustar o tom)
    if (config.safetyThresholds.hateSpeech >= 80) {
        rules.push(`REGRA DE SEGURANÇA - CONTEÚDO INAPROPRIADO:
- Você deve manter um tom profissional e respeitoso em todas as interações.
- Não tolerar discurso de ódio, assédio ou conteúdo discriminatório.
- Se detectar conteúdo inapropriado, redirecione educadamente a conversa.`);
    }
    // Adicionar regras ao prompt se houver alguma
    if (rules.length > 0) {
        enhancedPrompt += `\n\n=== REGRAS DE GOVERNANÇA E SEGURANÇA ===\n${rules.join('\n\n')}\n=== FIM DAS REGRAS DE GOVERNANÇA ===\n`;
    }
    return enhancedPrompt;
}
