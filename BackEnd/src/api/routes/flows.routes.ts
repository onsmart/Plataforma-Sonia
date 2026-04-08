import { Router } from 'express'
import {
  listFlows,
  executeFlow,
  getFlow,
  createFlow,
  updateFlow,
  deleteFlow,
  generateFlowMvp,
} from '../controllers/flows.controller'
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware'

const router = Router()

// ✅ Listar e ver flows: qualquer usuário autenticado
router.get('/', requireAuth, listFlows)
router.get('/:id', requireAuth, getFlow)

// ✅ Executar flow: qualquer usuário autenticado
router.post('/execute', requireAuth, executeFlow)

// ✅ SÓ ADMIN: Criar, atualizar e deletar flows
router.post('/generate-mvp', requireAuth, requireAdmin, generateFlowMvp)
router.post('/', requireAuth, requireAdmin, createFlow)
router.put('/:id', requireAuth, requireAdmin, updateFlow)
router.delete('/:id', requireAuth, requireAdmin, deleteFlow)

export default router
