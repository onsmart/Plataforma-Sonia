import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import {
  getCurrentEmailIntegration,
  getMicrosoft365AuthorizeUrl,
  listEmailIntegrations,
  testCurrentEmailIntegration,
  upsertCurrentEmailIntegration,
} from '../controllers/email.controller'

const router = Router()

router.get('/integrations', requireAuth, listEmailIntegrations)
router.get('/oauth/microsoft365/authorize-url', requireAuth, getMicrosoft365AuthorizeUrl)
router.get('/integration/current', requireAuth, getCurrentEmailIntegration)
router.post('/integration/current', requireAuth, upsertCurrentEmailIntegration)
router.post('/integration/current/test', requireAuth, testCurrentEmailIntegration)

export default router
