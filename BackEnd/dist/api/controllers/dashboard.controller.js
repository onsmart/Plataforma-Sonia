"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboard = getDashboard;
const supabase_1 = require("../../lib/supabase");
const logger_1 = __importDefault(require("../../lib/logger"));
/**
 * GET /dashboard
 * Alinhado ao Cockpit / Edge: lista de agentes + stats mínimos (o Cockpit enriquece com RPCs no cliente).
 */
async function getDashboard(req, res) {
    try {
        const email = req.user?.email;
        if (!email) {
            return res.status(401).json({
                error: 'Email é obrigatório',
                details: 'Token de autenticação inválido'
            });
        }
        const { data: agentsData, error: agentsError } = await supabase_1.supabase.rpc('sp_list_agents_by_email', {
            p_email: email
        });
        if (agentsError) {
            logger_1.default.error('[getDashboard] sp_list_agents_by_email:', agentsError);
        }
        const agentsList = [];
        if (agentsData && Array.isArray(agentsData)) {
            for (const agent of agentsData) {
                let statusId = null;
                if (agent.status_id !== null && agent.status_id !== undefined) {
                    statusId = typeof agent.status_id === 'string' ? parseInt(agent.status_id, 10) : Number(agent.status_id);
                    if (isNaN(statusId))
                        statusId = null;
                }
                agentsList.push({
                    id: String(agent.id),
                    nome: agent.nome || 'Sem nome',
                    status_id: statusId
                });
            }
        }
        const activeAgents = agentsList.filter((a) => a.status_id === 1).length;
        return res.json({
            stats: {
                totalInteractions: 0,
                activeLeads: 0,
                avgResponseTime: 0,
                meetingsBooked: 0,
                activeAgents,
                lastUpdated: new Date().toISOString()
            },
            activityFeed: [],
            agents: agentsList
        });
    }
    catch (error) {
        logger_1.default.error('[getDashboard] Erro:', error);
        return res.status(500).json({
            stats: {
                totalInteractions: 0,
                activeLeads: 0,
                avgResponseTime: 0,
                meetingsBooked: 0,
                activeAgents: 0,
                lastUpdated: new Date().toISOString()
            },
            activityFeed: [],
            agents: []
        });
    }
}
