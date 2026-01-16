import { Request, Response } from 'express'
import { getAgentsByEmail } from '../../services/agents'
import { chatWithAgent } from '../../services/agents/chatwithAgent'

export async function listAgents(req: Request, res: Response) {
  try {
    const email = req.query.email as string

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' })
    }

    const agents = await getAgentsByEmail(email)
    return res.json(agents)
  } catch (error) {
    console.error('ERRO REAL DO SUPABASE:', error)

    return res.status(500).json({
      error: 'Erro ao buscar agentes',
      details: error instanceof Error ? error.message : error
    })
  }
}


export async function agentChat(req: Request, res: Response) {
    try {
      const { email, agent_id, message } = req.body
  
      if (!email || !agent_id) {
        return res
          .status(400)
          .json({ error: 'email e agent_id são obrigatórios' })
      }
  
      const reply = await chatWithAgent(
        email,
        agent_id,
        message
      )
  
      return res.json({ reply })
    } catch (error: any) {
      console.error(error)
      return res.status(500).json({
        error: 'Erro ao conversar com o agente',
        details: error.message,
      })
    }
  }
