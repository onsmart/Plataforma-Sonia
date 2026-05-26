import { Router } from 'express'
import {
  verifyWhatsAppWebhook,
  getWhatsAppStatus,
  listWhatsAppIntegrations,
  getCurrentWhatsAppIntegration,
  listCurrentWhatsAppConversations,
  listStuckWhatsAppConversations,
  getCurrentWhatsAppConversationMessages,
  deleteWhatsAppConversationHistory,
  upsertCurrentWhatsAppIntegration,
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

router.get('/integrations', requireAuth, listWhatsAppIntegrations)
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
router.get('/conversations/stuck', requireAuth, listStuckWhatsAppConversations)
router.get('/conversations/current', requireAuth, listCurrentWhatsAppConversations)
router.get('/conversations/current/:contactId/messages', requireAuth, getCurrentWhatsAppConversationMessages)
router.get('/status', requireAuth, getWhatsAppStatus)
router.get('/history', requireAuth, getWhatsAppHistoryEndpoint)
router.get('/unread', requireAuth, getUnreadWhatsAppMessages)
router.post('/process-pending', requireAuth, processPendingWhatsAppConversations)
router.post('/process-queue', requireAuth, requireAdmin, processQueueManually)
router.get('/queue-stats', requireAuth, getQueueStatsEndpoint)
router.get('/webhook', verifyWhatsAppWebhook)
// POST /webhook: registrado em src/index.ts (raw body + HMAC Meta) antes do express.json()

export default router