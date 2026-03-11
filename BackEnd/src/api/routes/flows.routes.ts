import { Router } from 'express'
import { listFlows, executeFlow, getFlow } from '../controllers/flows.controller'
import { requireAuth } from '../../middleware/auth.middleware'

const router = Router()

// ✅ Todas as rotas de flows requerem autenticação
router.get('/', requireAuth, listFlows)
router.get('/:id', requireAuth, getFlow)
router.post('/execute', requireAuth, executeFlow)

export default router
