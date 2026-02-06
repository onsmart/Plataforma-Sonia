import { Router } from 'express'
import { listAgents, agentChat, approveDecision, rejectDecision } from '../controllers/agents.controller'

const router = Router()

// GET /agents → lista agentes
router.get('/', listAgents)

// POST /agents/chat → conversa com o agente
router.post('/chat', agentChat)

// POST /agents/decisions/:id/approve → aprovar decisão
router.post('/decisions/:id/approve', approveDecision)

// POST /agents/decisions/:id/reject → rejeitar decisão
router.post('/decisions/:id/reject', rejectDecision)

export default router
