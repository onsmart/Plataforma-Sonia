"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readEmailsWithAgent = readEmailsWithAgent;
const index_1 = require("./index");
const getagentfromcache_1 = require("./getagentfromcache");
const mail_1 = require("../integrations/mail");
async function readEmailsWithAgent(email, agentId, provider, limit) {
    console.log('[readEmailsWithAgent] Parâmetros:', { email, agentId, provider, limit });
    const agents = await (0, index_1.getAgentsByEmail)(email);
    console.log('[readEmailsWithAgent] Agentes encontrados:', agents?.length || 0);
    const agent = (0, getagentfromcache_1.getAgentFromCache)(agents, agentId);
    console.log('[readEmailsWithAgent] Agente selecionado:', {
        id: agent?.id,
        nome: agent?.nome,
        integrations_id: agent?.integrations_id,
        integrations_id_type: typeof agent?.integrations_id,
    });
    if (!agent) {
        throw new Error(`Agente com id ${agentId} não encontrado`);
    }
    if (!agent.integrations_id) {
        throw new Error(`Agente ${agentId} não possui integration_id configurado`);
    }
    const messages = await (0, mail_1.readInboxMessages)(agent.integrations_id, limit);
    return messages.map((message) => ({
        id: message.external_message_id,
        from: message.from[0]?.address || '',
        subject: message.subject,
        preview: message.preview || message.body_text || '',
        receivedAt: message.received_at || '',
    }));
}
