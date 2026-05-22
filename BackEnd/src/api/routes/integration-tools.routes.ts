import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import {
  getAgentEnabledTools,
  listIntegrationToolsCatalog,
  listIntegrationToolsCatalogForSetup,
  runIntegrationTool,
} from '../controllers/integration-tools.controller'

const router = Router()

router.get('/catalog', requireAuth, listIntegrationToolsCatalog)
router.get('/catalog/for-setup', requireAuth, listIntegrationToolsCatalogForSetup)
router.get('/agent/:agentId/enabled', requireAuth, getAgentEnabledTools)
router.post('/execute', requireAuth, runIntegrationTool)

export default router

