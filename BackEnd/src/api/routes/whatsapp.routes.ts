import { Router } from 'express'
import {
  verifyWhatsAppWebhook,
  getWhatsAppQRCode,
  getWhatsAppStatus,
  listWhatsAppIntegrations,
  receiveWhatsAppWebhook,
  getWhatsAppHistoryEndpoint,
  getUnreadWhatsAppMessages,
  processPendingWhatsAppConversations,
  processQueueManually,
  getQueueStatsEndpoint
} from '../controllers/whatsapp.controller'

const router = Router()

router.get('/integrations', listWhatsAppIntegrations)
router.get('/qrcode', getWhatsAppQRCode)
router.get('/status', getWhatsAppStatus)
router.get('/history', getWhatsAppHistoryEndpoint)
router.get('/unread', getUnreadWhatsAppMessages)
router.post('/process-pending', processPendingWhatsAppConversations)
router.post('/process-queue', processQueueManually)
router.get('/queue-stats', getQueueStatsEndpoint)
router.get('/webhook', verifyWhatsAppWebhook)
router.post('/webhook', receiveWhatsAppWebhook)

export default router
