import { Router } from 'express'
import { listAgents, agentChat } from '../controllers/agents.controller'

const router = Router()

// GET /agents → lista agentes
router.get('/', listAgents)

// POST /agents/chat → conversa com o agente
router.post('/chat', agentChat)

export default router
