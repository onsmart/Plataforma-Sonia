import { Router } from 'express'
import {
  verifyWhatsAppWebhook,
  getWhatsAppStatus,
  listWhatsAppIntegrations,
  getCurrentWhatsAppIntegration,
  listCurrentWhatsAppConversations,
  getCurrentWhatsAppConversationMessages,
  upsertCurrentWhatsAppIntegration,
  receiveWhatsAppWebhook,
  getWhatsAppHistoryEndpoint,
  getUnreadWhatsAppMessages,
  processPendingWhatsAppConversations,
  processQueueManually,
  getQueueStatsEndpoint,
  syncWhatsAppTemplatesForIntegration,
  listWhatsAppTemplatesForIntegration,
  sendWhatsAppTemplateMessage,
  getWhatsAppCustomerCareWindow
} from '../controllers/whatsapp.controller'
import { requireAuth } from '../../middleware/auth.middleware'

const router = Router()

router.get('/integrations', listWhatsAppIntegrations)
router.get('/integration/current', requireAuth, getCurrentWhatsAppIntegration)
router.post('/integration/current', requireAuth, upsertCurrentWhatsAppIntegration)
router.post('/integration/:integrationId/templates/sync', requireAuth, syncWhatsAppTemplatesForIntegration)
router.get('/integration/:integrationId/templates', requireAuth, listWhatsAppTemplatesForIntegration)
router.post('/integration/:integrationId/messages/template', requireAuth, sendWhatsAppTemplateMessage)
router.get(
  '/integration/:integrationId/contacts/:contactId/session-window',
  requireAuth,
  getWhatsAppCustomerCareWindow
)
router.get('/conversations/current', requireAuth, listCurrentWhatsAppConversations)
router.get('/conversations/current/:contactId/messages', requireAuth, getCurrentWhatsAppConversationMessages)
router.get('/status', getWhatsAppStatus)
router.get('/history', getWhatsAppHistoryEndpoint)
router.get('/unread', getUnreadWhatsAppMessages)
router.post('/process-pending', processPendingWhatsAppConversations)
router.post('/process-queue', processQueueManually)
router.get('/queue-stats', getQueueStatsEndpoint)
router.get('/webhook', verifyWhatsAppWebhook)
router.post('/webhook', receiveWhatsAppWebhook)

export default router
