import { GovernanceConfig } from './governance.service'

/**
 * Injeta regras de governança no System Prompt
 * @param basePrompt Prompt base do agente
 * @param config Configuração de governança (já com defaults seguros aplicados)
 * @returns Prompt enriquecido com regras de governança
 */
export function injectGovernanceRules(basePrompt: string, config: GovernanceConfig): string {
  let enhancedPrompt = basePrompt
  const rules: string[] = []

  // Sempre: tom e limites básicos (substitui sliders configuráveis na UI)
  rules.push(
    `REGRA DE SEGURANÇA — TOM E CONDUTA:
- Mantenha tom profissional e respeitoso.
- Não promova discurso de ódio, assédio ou discriminação.
- Em conteúdo claramente inapropriado, recuse com educação e redirecione para o tema do atendimento.`
  )

  if (config.filters.antiHallucination) {
    rules.push(
      `REGRA CRÍTICA — ANTI-ALUCINAÇÃO:
- Quando existir "Contexto adicional" / documentos (RAG) na mensagem de sistema, use-os como fonte principal de factos sobre a empresa/produto.
- Se NÃO houver contexto RAG nesta conversa, siga com fidelidade o template de papel (role) do agente; não invente preços, prazos, políticas, URLs ou dados da empresa que não estejam escritos nesse template ou no RAG.
- Se o utilizador pedir algo fora do que consta no template ou no RAG, diga claramente que não tem essa informação e ofereça o próximo passo seguro (ex.: falar com a equipa), em vez de supor.`
    )
  }

  if (rules.length > 0) {
    enhancedPrompt += `\n\n=== REGRAS DE GOVERNANÇA E SEGURANÇA ===\n${rules.join('\n\n')}\n=== FIM DAS REGRAS DE GOVERNANÇA ===\n`
  }

  return enhancedPrompt
}
