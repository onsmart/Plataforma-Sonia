import { Router } from 'express'
import { 
  getWhatsAppQRCode, 
  getWhatsAppStatus, 
  listWhatsAppIntegrations,
  receiveWhatsAppWebhook,
  getWhatsAppHistoryEndpoint,
  getUnreadWhatsAppMessages
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

// POST /whatsapp/webhook → recebe webhooks da Evolution API
router.post('/webhook', receiveWhatsAppWebhook)

export default router
