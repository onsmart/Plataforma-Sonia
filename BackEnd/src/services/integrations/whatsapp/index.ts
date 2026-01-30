export { 
  sendWhatsApp, 
  getQRCode, 
  checkConnectionStatus,
  resolveConversationId
} from './whatsapp.service'
export type { SendWhatsAppInput, WhatsAppMessage, ResolvedConversationId } from './whatsapp.service'

// Redis functions (histórico temporário)
export {
  saveMessageToHistory,
  getHistoryFromRedis,
  getUnreadConversations,
  clearHistory,
  markConversationAsRead
} from './whatsapp.redis'
export type { ConversationMessage } from './whatsapp.redis'

// Conversation management
export {
  createOrUpdateConversation,
  linkLidToPhoneNumber,
  getPendingConversations,
  getConversationByIdentifier
} from './whatsapp.conversations'
export type { ConversationData } from './whatsapp.conversations'

// Worker for processing pending conversations
export {
  processPendingConversation,
  processPendingConversations
} from './whatsapp.worker'

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
