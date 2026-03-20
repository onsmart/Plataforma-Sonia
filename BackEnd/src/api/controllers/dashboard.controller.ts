import { Request, Response } from 'express'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

/**
 * GET /dashboard
 * Alinhado ao Cockpit / Edge: lista de agentes + stats mínimos (o Cockpit enriquece com RPCs no cliente).
 */
export async function getDashboard(req: Request, res: Response) {
  try {
    const email = req.user?.email
    if (!email) {
      return res.status(401).json({
        error: 'Email é obrigatório',
        details: 'Token de autenticação inválido'
      })
    }

    const { data: agentsData, error: agentsError } = await supabase.rpc('sp_list_agents_by_email', {
      p_email: email
    })

    if (agentsError) {
      logger.error('[getDashboard] sp_list_agents_by_email:', agentsError)
    }

    const agentsList: Array<{ id: string; nome: string; status_id: number | null }> = []
    if (agentsData && Array.isArray(agentsData)) {
      for (const agent of agentsData as any[]) {
        let statusId: number | null = null
        if (agent.status_id !== null && agent.status_id !== undefined) {
          statusId = typeof agent.status_id === 'string' ? parseInt(agent.status_id, 10) : Number(agent.status_id)
          if (isNaN(statusId)) statusId = null
        }
        agentsList.push({
          id: String(agent.id),
          nome: agent.nome || 'Sem nome',
          status_id: statusId
        })
      }
    }

    const activeAgents = agentsList.filter((a) => a.status_id === 1).length

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
    })
  } catch (error: any) {
    logger.error('[getDashboard] Erro:', error)
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
    })
  }
}
