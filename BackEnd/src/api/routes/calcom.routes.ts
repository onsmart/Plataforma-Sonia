import { Router } from 'express'
import { requireAuth, requireWorkspace } from '../../middleware/auth.middleware'
import {
  activateCalComIntegration,
  createCalComIntegration,
  deactivateCalComIntegration,
  deleteCalComIntegration,
  listCalComEventTypes,
  listCalComIntegrations,
  saveCalComMappings,
  setDefaultCalComIntegration,
  syncCalComWebhook,
  testCalComIntegration,
  updateCalComIntegration,
} from '../controllers/calcom.controller'

const router = Router()

router.get('/integrations', requireAuth, requireWorkspace, listCalComIntegrations)
router.post('/integrations', requireAuth, requireWorkspace, createCalComIntegration)
router.put('/integrations/:id', requireAuth, requireWorkspace, updateCalComIntegration)
router.post('/integrations/:id/test', requireAuth, requireWorkspace, testCalComIntegration)
router.post('/integrations/:id/default', requireAuth, requireWorkspace, setDefaultCalComIntegration)
router.post('/integrations/:id/activate', requireAuth, requireWorkspace, activateCalComIntegration)
router.post('/integrations/:id/deactivate', requireAuth, requireWorkspace, deactivateCalComIntegration)
router.delete('/integrations/:id', requireAuth, requireWorkspace, deleteCalComIntegration)
router.get('/integrations/:id/event-types', requireAuth, requireWorkspace, listCalComEventTypes)
router.post('/integrations/:id/mappings', requireAuth, requireWorkspace, saveCalComMappings)
router.post('/integrations/:id/webhook/sync', requireAuth, requireWorkspace, syncCalComWebhook)

// NOTA: /calcom/webhook/:id está registrado diretamente em index.ts com express.raw()
// para preservar o body raw necessário para validação HMAC. Não registrar aqui.

export default router
