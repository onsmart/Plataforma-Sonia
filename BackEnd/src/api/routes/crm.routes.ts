import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import { testCRMDraftConnection, testCRMIntegration } from '../controllers/crm.controller'

const router = Router()

router.post('/integrations/test', requireAuth, testCRMDraftConnection)
router.post('/integrations/:id/test', requireAuth, testCRMIntegration)

export default router
