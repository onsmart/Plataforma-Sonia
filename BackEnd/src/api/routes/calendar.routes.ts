import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import {
  activateCalendlyIntegration,
  createCalendlyIntegration,
  deactivateCalendlyIntegration,
  deleteCalendlyIntegration,
  listCalendlyEventTypes,
  listCalendlyIntegrations,
  receiveCalendlyWebhook,
  saveCalendlyMappings,
  setDefaultCalendlyIntegration,
  syncCalendlyWebhook,
  testCalendlyIntegration,
  updateCalendlyIntegration,
} from '../controllers/calendar.controller'

const router = Router()

router.get('/integrations', requireAuth, listCalendlyIntegrations)
router.post('/integrations', requireAuth, createCalendlyIntegration)
router.put('/integrations/:id', requireAuth, updateCalendlyIntegration)
router.post('/integrations/:id/test', requireAuth, testCalendlyIntegration)
router.post('/integrations/:id/default', requireAuth, setDefaultCalendlyIntegration)
router.post('/integrations/:id/activate', requireAuth, activateCalendlyIntegration)
router.post('/integrations/:id/deactivate', requireAuth, deactivateCalendlyIntegration)
router.delete('/integrations/:id', requireAuth, deleteCalendlyIntegration)
router.get('/integrations/:id/event-types', requireAuth, listCalendlyEventTypes)
router.post('/integrations/:id/mappings', requireAuth, saveCalendlyMappings)
router.post('/integrations/:id/webhook/sync', requireAuth, syncCalendlyWebhook)
router.post('/webhook/:id', receiveCalendlyWebhook)

export default router

