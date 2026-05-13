import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import { listIntegrationToolsCatalog, runIntegrationTool } from '../controllers/integration-tools.controller'

const router = Router()

router.get('/catalog', requireAuth, listIntegrationToolsCatalog)
router.post('/execute', requireAuth, runIntegrationTool)

export default router

