export { 
  sendWhatsApp, 
  checkConnectionStatus
} from './whatsapp.dispatcher'
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

// Queue system for async message processing
export {
  enqueueResponse,
  dequeueNextMessage,
  markMessageCompleted,
  requeueMessageForRetry,
  getQueueStats,
  cleanOldMessages,
  getPendingMessagesByLid
} from './whatsapp.queue'
export type { QueuedMessage } from './whatsapp.queue'

// Queue worker
export {
  processQueue,
  startQueueWorker,
  stopQueueWorker,
  getWorkerStatus
} from './whatsapp.queue.worker'

// Contacts management
export {
  createOrUpdateContact,
  getContactByLid,
  getContactByPhoneNumber,
  updateContactPhoneNumber
} from './whatsapp.contacts'
export type { WhatsAppContact } from './whatsapp.contacts'

// Utils
export {
  extractPhoneNumberFromText,
  isValidPhoneNumber
} from './whatsapp.utils'
