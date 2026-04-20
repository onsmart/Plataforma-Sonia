import { Router } from 'express'
import {
  verifyWhatsAppWebhook,
  getWhatsAppStatus,
  listWhatsAppIntegrations,
  getCurrentWhatsAppIntegration,
  listCurrentWhatsAppConversations,
  getCurrentWhatsAppConversationMessages,
  deleteWhatsAppConversationHistory,
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
  getWhatsAppCustomerCareWindow,
  createWhatsAppCampaign,
  enqueueWhatsAppCampaign,
  getWhatsAppUsageReport
} from '../controllers/whatsapp.controller'
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware'

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
router.post('/integration/:integrationId/campaigns', requireAuth, createWhatsAppCampaign)
router.post('/integration/:integrationId/campaigns/:campaignId/enqueue', requireAuth, enqueueWhatsAppCampaign)
router.get('/integration/:integrationId/usage-report', requireAuth, getWhatsAppUsageReport)
router.delete(
  '/integration/:integrationId/conversations/:contactId/history',
  requireAuth,
  requireAdmin,
  deleteWhatsAppConversationHistory
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
