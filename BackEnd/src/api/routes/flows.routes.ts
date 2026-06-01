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
import { requireAuth, requireWorkspace, requirePermission } from '../../middleware/auth.middleware'

const router = Router()

router.get('/', requireAuth, requireWorkspace, requirePermission('basic.read'), listFlows)
router.get('/refine-description/status', requireAuth, requireWorkspace, requirePermission('basic.write'), refineFlowDescriptionStatus)
router.get('/:id', requireAuth, requireWorkspace, requirePermission('basic.read'), getFlow)
router.post('/execute', requireAuth, requireWorkspace, requirePermission('basic.read'), executeFlow)
router.post('/generate-mvp', requireAuth, requireWorkspace, requirePermission('basic.write'), generateFlowMvp)
router.post('/generate-test-conditional-switch', requireAuth, requireWorkspace, requirePermission('basic.write'), generateConditionalSwitchTestFlowController)
router.post('/refine-description', requireAuth, requireWorkspace, requirePermission('basic.write'), refineFlowDescriptionClaude)
router.post('/', requireAuth, requireWorkspace, requirePermission('basic.write'), createFlow)
router.put('/:id', requireAuth, requireWorkspace, requirePermission('basic.write'), updateFlow)
router.post('/:id/publish', requireAuth, requireWorkspace, requirePermission('basic.write'), publishFlow)
router.delete('/:id', requireAuth, requireWorkspace, requirePermission('basic.write'), deleteFlow)

export default router
