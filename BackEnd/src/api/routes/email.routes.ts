import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import {
  getCurrentEmailIntegration,
  listEmailIntegrations,
  testCurrentEmailIntegration,
  upsertCurrentEmailIntegration,
} from '../controllers/email.controller'

const router = Router()

router.get('/integrations', requireAuth, listEmailIntegrations)
router.get('/integration/current', requireAuth, getCurrentEmailIntegration)
router.post('/integration/current', requireAuth, upsertCurrentEmailIntegration)
router.post('/integration/current/test', requireAuth, testCurrentEmailIntegration)

export default router
