import { Router } from 'express'
import { requireAuth, requireWorkspace } from '../../middleware/auth.middleware'
import {
  getAgentEnabledTools,
  listIntegrationToolsCatalog,
  listIntegrationToolsCatalogForSetup,
  runIntegrationTool,
} from '../controllers/integration-tools.controller'

const router = Router()

router.get('/catalog', requireAuth, requireWorkspace, listIntegrationToolsCatalog)
router.get('/catalog/for-setup', requireAuth, requireWorkspace, listIntegrationToolsCatalogForSetup)
router.get('/agent/:agentId/enabled', requireAuth, requireWorkspace, getAgentEnabledTools)
router.post('/execute', requireAuth, requireWorkspace, runIntegrationTool)

export default router

