export { 
  sendWhatsApp, 
  getQRCode, 
  checkConnectionStatus
} from './whatsapp.service'
export type { SendWhatsAppInput, WhatsAppMessage } from './whatsapp.service'

// Redis functions (histórico temporário)
export {
  saveMessageToHistory,
  getHistoryFromRedis,
  getUnreadConversations,
  clearHistory,
  markConversationAsRead
} from './whatsapp.redis'
export type { ConversationMessage } from './whatsapp.redis'
