import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import {
  deleteCRMIntegration,
  listCRMIntegrations,
  testCRMDraftConnection,
  testCRMIntegration,
  upsertCRMIntegration,
} from '../controllers/crm.controller'

const router = Router()

router.get('/integrations', requireAuth, listCRMIntegrations)
router.post('/integrations', requireAuth, upsertCRMIntegration)
router.delete('/integrations/:id', requireAuth, deleteCRMIntegration)
router.post('/integrations/test', requireAuth, testCRMDraftConnection)
router.post('/integrations/:id/test', requireAuth, testCRMIntegration)

export default router
