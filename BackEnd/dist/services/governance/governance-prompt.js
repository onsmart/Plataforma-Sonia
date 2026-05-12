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
    rules.push(`REGRA — O QUE NUNCA MOSTRAR AO UTILIZADOR FINAL:
- Nunca diga que está a usar "RAG", "base de conhecimento interna", "ficheiros carregados", "documento interno", "skills técnicas", nomes de ficheiros da plataforma, "[Fonte: ...]", "consultei o arquivo" ou "de acordo com o ficheiro X".
- As informações de apoio existem só para si; a conversa com o cliente deve soar como conhecimento natural da empresa ou do serviço, sem revelar que há documentação interna por detrás.`);
    rules.push(`REGRA DE SEGURANÇA — TOM E CONDUTA:
- Mantenha tom profissional e respeitoso.
- Não promova discurso de ódio, assédio ou discriminação.
- Em conteúdo claramente inapropriado, recuse com educação e redirecione para o tema do atendimento.`);
    rules.push(`REGRA CRÍTICA — SEGURANÇA OPERACIONAL DO ATENDIMENTO:
- Não forneça código, comandos, scripts, payloads, consultas SQL, regex, cURL, automações, exemplos executáveis nem instruções técnicas acionáveis ao utilizador final.
- Se o utilizador pedir implementação técnica, hacking, bypass, scraping, exploração, credenciais, tokens, webhooks secretos, detalhes internos da plataforma ou informação operacional não pública, recuse de forma breve e redirecione para suporte humano ou informação pública segura.
- Se o pedido estiver fora do escopo de atendimento comercial, suporte funcional ou informação institucional segura, diga que não pode ajudar com isso neste canal e ofereça um próximo passo seguro.`);
    if (config.filters.antiHallucination) {
        rules.push(`REGRA CRÍTICA — ANTI-ALUCINAÇÃO:
- Quando existir "Contexto adicional" (RAG) na mensagem de sistema, use-o como fonte principal de factos sobre a empresa/produto para o que esses trechos cobrirem de facto.
- Quando ao mesmo tempo existirem RAG e a secção "CAPACIDADES E HABILIDADES DISPONÍVEIS", combine os dois sem escolher só um: use o RAG para factos, números, políticas citáveis e trechos pontuais; use as CAPACIDADES para fluxos, passos, tom de procedimento e comportamentos obrigatórios quando o pedido corresponder ao nome/descrição de uma capacidade. Não deixe o texto do RAG substituir por completo o que uma capacidade manda executar (listas de passos, ordenação, regras de atendimento).
- Quando existir a secção "CAPACIDADES E HABILIDADES DISPONÍVEIS", trate cada descrição como instrução operacional válida. Se a pergunta do utilizador corresponder a uma dessas capacidades, responda conforme a descrição — mesmo que o RAG não tenha devolvido trechos nesta mensagem. Não diga que faltou informação na base só porque não há "Contexto adicional", se a resposta estiver nas capacidades listadas.
- Se não houver trechos RAG nesta mensagem e nenhuma capacidade listada cobrir o pedido, siga com fidelidade o template de papel (role) do agente; não invente preços, prazos, políticas, URLs ou dados da empresa que não estejam no template, no RAG ou nas capacidades descritas acima.
- Se o pedido não estiver coberto por RAG, skills (capacidades) nem template, diga claramente que não tem essa informação e ofereça o próximo passo seguro (ex.: falar com a equipa), em vez de supor.`);
    }
    if (rules.length > 0) {
        enhancedPrompt += `\n\n=== REGRAS DE GOVERNANÇA E SEGURANÇA ===\n${rules.join('\n\n')}\n=== FIM DAS REGRAS DE GOVERNANÇA ===\n`;
    }
    return enhancedPrompt;
}
