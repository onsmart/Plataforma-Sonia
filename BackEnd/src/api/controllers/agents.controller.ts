import { Request, Response } from 'express'
import { getAgentsByEmail } from '../../services/agents'

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
