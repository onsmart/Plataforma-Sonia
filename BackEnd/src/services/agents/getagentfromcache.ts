import { Agent } from '../../models/Agent'

export function getAgentFromCache(
  agents: Agent[],
  agentId: string
): Agent {
  // Procura o agente pelo id
  const agent = agents.find(a => a.id === agentId)

  // Se não encontrar, lança erro com mais informações
  if (!agent) {
    const availableIds = agents.map(a => a.id).join(', ')
    const availableNames = agents.map(a => a.nome || a.id).join(', ')
    throw new Error(
      `Agente com id "${agentId}" não encontrado. ` +
      `Agentes disponíveis (${agents.length}): ${availableNames || 'nenhum'}. ` +
      `IDs: ${availableIds || 'nenhum'}`
    )
  }

  return agent
}
