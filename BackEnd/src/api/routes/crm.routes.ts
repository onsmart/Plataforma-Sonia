import { Router } from 'express'
import { requireAuth, requireWorkspace } from '../../middleware/auth.middleware'
import {
  deleteCRMIntegration,
  listCRMIntegrations,
  testCRMDraftConnection,
  testCRMIntegration,
  upsertCRMIntegration,
} from '../controllers/crm.controller'

const router = Router()

router.get('/integrations', requireAuth, requireWorkspace, listCRMIntegrations)
router.post('/integrations', requireAuth, requireWorkspace, upsertCRMIntegration)
router.delete('/integrations/:id', requireAuth, requireWorkspace, deleteCRMIntegration)
router.post('/integrations/test', requireAuth, requireWorkspace, testCRMDraftConnection)
router.post('/integrations/:id/test', requireAuth, requireWorkspace, testCRMIntegration)

export default router
