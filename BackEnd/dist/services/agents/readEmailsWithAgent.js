"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readEmailsWithAgent = readEmailsWithAgent;
const index_1 = require("./index");
const getagentfromcache_1 = require("./getagentfromcache");
const outlook_service_1 = require("../integrations/email_reader/outlook/outlook.service");
async function readEmailsWithAgent(email, agentId, provider, limit) {
    console.log('[readEmailsWithAgent] Parâmetros:', { email, agentId, provider, limit });
    const agents = await (0, index_1.getAgentsByEmail)(email);
    console.log('[readEmailsWithAgent] Agentes encontrados:', agents?.length || 0);
    const agent = (0, getagentfromcache_1.getAgentFromCache)(agents, agentId);
    console.log('[readEmailsWithAgent] Agente selecionado:', {
        id: agent?.id,
        nome: agent?.nome,
        integrations_id: agent?.integrations_id,
        integrations_id_type: typeof agent?.integrations_id
    });
    if (!agent) {
        throw new Error(`Agente com id ${agentId} não encontrado`);
    }
    if (!agent.integrations_id) {
        throw new Error(`Agente ${agentId} não possui integration_id configurado`);
    }
    if (provider === 'outlook') {
        return await (0, outlook_service_1.readOutlookEmails)(agent.integrations_id, limit);
    }
    throw new Error('Provider de email não suportado');
}
