import { Router } from 'express'
import { listFlows, executeFlow, getFlow } from '../controllers/flows.controller'

const router = Router()

// GET /flows → lista flows do usuário
router.get('/', listFlows)

// GET /flows/:id → busca um flow específico
router.get('/:id', getFlow)

// POST /flows/execute → executa um flow (orquestração central)
router.post('/execute', executeFlow)

export default router
