import { Agent } from '../../models/Agent'

export function getAgentFromCache(
  agents: Agent[],
  agentId: string
): Agent {
  // Procura o agente pelo id
  const agent = agents.find(a => a.id === agentId)

  // Se não encontrar, lança erro
  if (!agent) {
    throw new Error(`Agente com id "${agentId}" não encontrado`)
  }

  return agent
}
