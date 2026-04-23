import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import {
  activateEmailIntegration,
  createEmailIntegration,
  deactivateEmailIntegration,
  deleteEmailIntegration,
  getCurrentEmailIntegration,
  getMicrosoft365AuthorizeUrl,
  listEmailIntegrations,
  setDefaultEmailIntegration,
  testEmailIntegration,
  testCurrentEmailIntegration,
  updateEmailIntegration,
  upsertCurrentEmailIntegration,
} from '../controllers/email.controller'

const router = Router()

router.get('/integrations', requireAuth, listEmailIntegrations)
router.post('/integrations', requireAuth, createEmailIntegration)
router.put('/integrations/:id', requireAuth, updateEmailIntegration)
router.post('/integrations/:id/test', requireAuth, testEmailIntegration)
router.post('/integrations/:id/default', requireAuth, setDefaultEmailIntegration)
router.post('/integrations/:id/activate', requireAuth, activateEmailIntegration)
router.post('/integrations/:id/deactivate', requireAuth, deactivateEmailIntegration)
router.delete('/integrations/:id', requireAuth, deleteEmailIntegration)
router.get('/oauth/microsoft365/authorize-url', requireAuth, getMicrosoft365AuthorizeUrl)
router.get('/integration/current', requireAuth, getCurrentEmailIntegration)
router.post('/integration/current', requireAuth, upsertCurrentEmailIntegration)
router.post('/integration/current/test', requireAuth, testCurrentEmailIntegration)

export default router
