import { Router } from 'express'
import { 
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

// GET /whatsapp/integrations → lista integrações WhatsApp do usuário
router.get('/integrations', listWhatsAppIntegrations)

// GET /whatsapp/qrcode → obtém QR Code em base64
router.get('/qrcode', getWhatsAppQRCode)

// GET /whatsapp/status → verifica status da conexão
router.get('/status', getWhatsAppStatus)

// GET /whatsapp/history → busca histórico de mensagens
router.get('/history', getWhatsAppHistoryEndpoint)

// GET /whatsapp/unread → busca mensagens não lidas (usando timestamp)
router.get('/unread', getUnreadWhatsAppMessages)

// POST /whatsapp/process-pending → processa conversas pendentes manualmente
router.post('/process-pending', processPendingWhatsAppConversations)

// POST /whatsapp/process-queue → processa fila de respostas manualmente
router.post('/process-queue', processQueueManually)

// GET /whatsapp/queue-stats → obtém estatísticas da fila
router.get('/queue-stats', getQueueStatsEndpoint)

// POST /whatsapp/webhook → recebe webhooks da Evolution API
router.post('/webhook', receiveWhatsAppWebhook)

export default router
