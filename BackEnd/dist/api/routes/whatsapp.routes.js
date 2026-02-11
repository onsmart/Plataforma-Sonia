"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const whatsapp_controller_1 = require("../controllers/whatsapp.controller");
const router = (0, express_1.Router)();
// GET /whatsapp/integrations → lista integrações WhatsApp do usuário
router.get('/integrations', whatsapp_controller_1.listWhatsAppIntegrations);
// GET /whatsapp/qrcode → obtém QR Code em base64
router.get('/qrcode', whatsapp_controller_1.getWhatsAppQRCode);
// GET /whatsapp/status → verifica status da conexão
router.get('/status', whatsapp_controller_1.getWhatsAppStatus);
// GET /whatsapp/history → busca histórico de mensagens
router.get('/history', whatsapp_controller_1.getWhatsAppHistoryEndpoint);
// GET /whatsapp/unread → busca mensagens não lidas (usando timestamp)
router.get('/unread', whatsapp_controller_1.getUnreadWhatsAppMessages);
// POST /whatsapp/process-pending → processa conversas pendentes manualmente
router.post('/process-pending', whatsapp_controller_1.processPendingWhatsAppConversations);
// POST /whatsapp/process-queue → processa fila de respostas manualmente
router.post('/process-queue', whatsapp_controller_1.processQueueManually);
// GET /whatsapp/queue-stats → obtém estatísticas da fila
router.get('/queue-stats', whatsapp_controller_1.getQueueStatsEndpoint);
// POST /whatsapp/webhook → recebe webhooks da Evolution API
router.post('/webhook', whatsapp_controller_1.receiveWhatsAppWebhook);
exports.default = router;
