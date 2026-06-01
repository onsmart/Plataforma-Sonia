import { Router } from 'express'
import { requireAuth, requireWorkspace } from '../../middleware/auth.middleware'
import {
  activateCalendlyIntegration,
  getCalendlyPublicConfig,
  createCalendlyIntegration,
  deactivateCalendlyIntegration,
  deleteCalendlyIntegration,
  listCalendlyEventTypes,
  listCalendlyIntegrations,
  saveCalendlyMappings,
  setDefaultCalendlyIntegration,
  syncCalendlyWebhook,
  testCalendlyIntegration,
  updateCalendlyIntegration,
} from '../controllers/calendar.controller'

const router = Router()

router.get('/config', requireAuth, requireWorkspace, getCalendlyPublicConfig)
router.get('/integrations', requireAuth, requireWorkspace, listCalendlyIntegrations)
router.post('/integrations', requireAuth, requireWorkspace, createCalendlyIntegration)
router.put('/integrations/:id', requireAuth, requireWorkspace, updateCalendlyIntegration)
router.post('/integrations/:id/test', requireAuth, requireWorkspace, testCalendlyIntegration)
router.post('/integrations/:id/default', requireAuth, requireWorkspace, setDefaultCalendlyIntegration)
router.post('/integrations/:id/activate', requireAuth, requireWorkspace, activateCalendlyIntegration)
router.post('/integrations/:id/deactivate', requireAuth, requireWorkspace, deactivateCalendlyIntegration)
router.delete('/integrations/:id', requireAuth, requireWorkspace, deleteCalendlyIntegration)
router.get('/integrations/:id/event-types', requireAuth, requireWorkspace, listCalendlyEventTypes)
router.post('/integrations/:id/mappings', requireAuth, requireWorkspace, saveCalendlyMappings)
router.post('/integrations/:id/webhook/sync', requireAuth, requireWorkspace, syncCalendlyWebhook)

export default router

