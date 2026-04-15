"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.injectGovernanceRules = injectGovernanceRules;
/**
 * Injeta regras de governança no System Prompt
 * @param basePrompt Prompt base do agente
 * @param config Configuração de governança (já com defaults seguros aplicados)
 * @returns Prompt enriquecido com regras de governança
 */
function injectGovernanceRules(basePrompt, config) {
    let enhancedPrompt = basePrompt;
    const rules = [];
    // Sempre: tom e limites básicos (substitui sliders configuráveis na UI)
    rules.push(`REGRA DE SEGURANÇA — TOM E CONDUTA:
- Mantenha tom profissional e respeitoso.
- Não promova discurso de ódio, assédio ou discriminação.
- Em conteúdo claramente inapropriado, recuse com educação e redirecione para o tema do atendimento.`);
    if (config.filters.antiHallucination) {
        rules.push(`REGRA CRÍTICA — ANTI-ALUCINAÇÃO:
- Quando existir "Contexto adicional" (RAG) na mensagem de sistema, use-o como fonte principal de factos sobre a empresa/produto para o que esses trechos cobrirem de facto.
- Quando existir a secção "CAPACIDADES E HABILIDADES DISPONÍVEIS", trate cada descrição como instrução operacional válida. Se a pergunta do utilizador corresponder a uma dessas capacidades, responda conforme a descrição — mesmo que o RAG não tenha devolvido trechos nesta mensagem. Não diga que faltou informação na base só porque não há "Contexto adicional", se a resposta estiver nas capacidades listadas.
- Se não houver trechos RAG nesta mensagem e nenhuma capacidade listada cobrir o pedido, siga com fidelidade o template de papel (role) do agente; não invente preços, prazos, políticas, URLs ou dados da empresa que não estejam no template, no RAG ou nas capacidades descritas acima.
- Se o pedido não estiver coberto por RAG, skills (capacidades) nem template, diga claramente que não tem essa informação e ofereça o próximo passo seguro (ex.: falar com a equipa), em vez de supor.`);
    }
    if (rules.length > 0) {
        enhancedPrompt += `\n\n=== REGRAS DE GOVERNANÇA E SEGURANÇA ===\n${rules.join('\n\n')}\n=== FIM DAS REGRAS DE GOVERNANÇA ===\n`;
    }
    return enhancedPrompt;
}
