import { Router } from 'express'
import {
  listFlows,
  executeFlow,
  getFlow,
  createFlow,
  updateFlow,
  publishFlow,
  deleteFlow,
  generateFlowMvp,
  generateConditionalSwitchTestFlowController,
  refineFlowDescriptionClaude,
  refineFlowDescriptionStatus,
} from '../controllers/flows.controller'
import { requireAuth, requireWorkspace, requireAdmin } from '../../middleware/auth.middleware'

const router = Router()

// ✅ Listar e ver flows: qualquer usuário autenticado
router.get('/', requireAuth, requireWorkspace, listFlows)
router.get('/refine-description/status', requireAuth, requireWorkspace, requireAdmin, refineFlowDescriptionStatus)
router.get('/:id', requireAuth, requireWorkspace, getFlow)

// ✅ Executar flow: qualquer usuário autenticado
router.post('/execute', requireAuth, requireWorkspace, executeFlow)

// ✅ SÓ ADMIN: Criar, atualizar e deletar flows
router.post('/generate-mvp', requireAuth, requireWorkspace, requireAdmin, generateFlowMvp)
router.post('/generate-test-conditional-switch', requireAuth, requireWorkspace, requireAdmin, generateConditionalSwitchTestFlowController)
router.post('/refine-description', requireAuth, requireWorkspace, requireAdmin, refineFlowDescriptionClaude)
router.post('/', requireAuth, requireWorkspace, requireAdmin, createFlow)
router.put('/:id', requireAuth, requireWorkspace, requireAdmin, updateFlow)
router.post('/:id/publish', requireAuth, requireWorkspace, requireAdmin, publishFlow)
router.delete('/:id', requireAuth, requireWorkspace, requireAdmin, deleteFlow)

export default router
