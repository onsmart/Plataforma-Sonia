import { Router } from 'express'
import { requireAuth, requireWorkspace } from '../../middleware/auth.middleware'
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

router.get('/integrations', requireAuth, requireWorkspace, listEmailIntegrations)
router.post('/integrations', requireAuth, requireWorkspace, createEmailIntegration)
router.put('/integrations/:id', requireAuth, requireWorkspace, updateEmailIntegration)
router.post('/integrations/:id/test', requireAuth, requireWorkspace, testEmailIntegration)
router.post('/integrations/:id/default', requireAuth, requireWorkspace, setDefaultEmailIntegration)
router.post('/integrations/:id/activate', requireAuth, requireWorkspace, activateEmailIntegration)
router.post('/integrations/:id/deactivate', requireAuth, requireWorkspace, deactivateEmailIntegration)
router.delete('/integrations/:id', requireAuth, requireWorkspace, deleteEmailIntegration)
router.get('/oauth/microsoft365/authorize-url', requireAuth, requireWorkspace, getMicrosoft365AuthorizeUrl)
router.get('/integration/current', requireAuth, requireWorkspace, getCurrentEmailIntegration)
router.post('/integration/current', requireAuth, requireWorkspace, upsertCurrentEmailIntegration)
router.post('/integration/current/test', requireAuth, requireWorkspace, testCurrentEmailIntegration)

export default router
