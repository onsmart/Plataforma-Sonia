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
import { requireAuth, requireWorkspace, requireAdmin } from '../../middleware/auth.middleware'

const router = Router()

router.get('/integrations', requireAuth, requireWorkspace, listWhatsAppIntegrations)
router.get('/integration/current', requireAuth, requireWorkspace, getCurrentWhatsAppIntegration)
router.post('/integration/current', requireAuth, requireWorkspace, upsertCurrentWhatsAppIntegration)
router.post('/integration/:integrationId/templates/sync', requireAuth, requireWorkspace, syncWhatsAppTemplatesForIntegration)
router.get('/integration/:integrationId/templates', requireAuth, requireWorkspace, listWhatsAppTemplatesForIntegration)
router.post('/integration/:integrationId/messages/template', requireAuth, requireWorkspace, sendWhatsAppTemplateMessage)
router.get(
  '/integration/:integrationId/contacts/:contactId/session-window',
  requireAuth, requireWorkspace,
  getWhatsAppCustomerCareWindow
)
router.post('/integration/:integrationId/campaigns', requireAuth, requireWorkspace, createWhatsAppCampaign)
router.post('/integration/:integrationId/campaigns/:campaignId/enqueue', requireAuth, requireWorkspace, enqueueWhatsAppCampaign)
router.get('/integration/:integrationId/usage-report', requireAuth, requireWorkspace, getWhatsAppUsageReport)
router.delete(
  '/integration/:integrationId/conversations/:contactId/history',
  requireAuth, requireWorkspace,
  requireAdmin,
  deleteWhatsAppConversationHistory
)
router.get('/conversations/stuck', requireAuth, requireWorkspace, listStuckWhatsAppConversations)
router.get('/conversations/current', requireAuth, requireWorkspace, listCurrentWhatsAppConversations)
router.get('/conversations/current/:contactId/messages', requireAuth, requireWorkspace, getCurrentWhatsAppConversationMessages)
router.get('/status', requireAuth, requireWorkspace, getWhatsAppStatus)
router.get('/history', requireAuth, requireWorkspace, getWhatsAppHistoryEndpoint)
router.get('/unread', requireAuth, requireWorkspace, getUnreadWhatsAppMessages)
router.post('/process-pending', requireAuth, requireWorkspace, processPendingWhatsAppConversations)
router.post('/process-queue', requireAuth, requireWorkspace, requireAdmin, processQueueManually)
router.get('/queue-stats', requireAuth, requireWorkspace, getQueueStatsEndpoint)
router.get('/webhook', verifyWhatsAppWebhook)
// POST /webhook: registrado em src/index.ts (raw body + HMAC Meta) antes do express.json()

export default router