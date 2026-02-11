"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentFromCache = getAgentFromCache;
function getAgentFromCache(agents, agentId) {
    // Procura o agente pelo id
    const agent = agents.find(a => a.id === agentId);
    // Se não encontrar, lança erro com mais informações
    if (!agent) {
        const availableIds = agents.map(a => a.id).join(', ');
        const availableNames = agents.map(a => a.nome || a.id).join(', ');
        throw new Error(`Agente com id "${agentId}" não encontrado. ` +
            `Agentes disponíveis (${agents.length}): ${availableNames || 'nenhum'}. ` +
            `IDs: ${availableIds || 'nenhum'}`);
    }
    return agent;
}
