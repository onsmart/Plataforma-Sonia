"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAgents = listAgents;
const agents_1 = require("../../services/agents");
async function listAgents(req, res) {
    try {
        const agents = await (0, agents_1.getAgents)();
        return res.json(agents);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro ao buscar agentes' });
    }
}
