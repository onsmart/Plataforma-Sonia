"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidPhoneNumber = exports.extractPhoneNumberFromText = exports.updateContactPhoneNumber = exports.getContactByPhoneNumber = exports.getContactByLid = exports.createOrUpdateContact = exports.getWorkerStatus = exports.stopQueueWorker = exports.startQueueWorker = exports.processQueue = exports.getPendingMessagesByLid = exports.cleanOldMessages = exports.getQueueStats = exports.requeueMessageForRetry = exports.markMessageCompleted = exports.dequeueNextMessage = exports.enqueueResponse = exports.markConversationAsRead = exports.clearHistory = exports.getUnreadConversations = exports.getHistoryFromRedis = exports.saveMessageToHistory = exports.checkConnectionStatus = exports.sendWhatsAppTemplate = exports.sendWhatsApp = void 0;
var whatsapp_dispatcher_1 = require("./whatsapp.dispatcher");
Object.defineProperty(exports, "sendWhatsApp", { enumerable: true, get: function () { return whatsapp_dispatcher_1.sendWhatsApp; } });
Object.defineProperty(exports, "sendWhatsAppTemplate", { enumerable: true, get: function () { return whatsapp_dispatcher_1.sendWhatsAppTemplate; } });
Object.defineProperty(exports, "checkConnectionStatus", { enumerable: true, get: function () { return whatsapp_dispatcher_1.checkConnectionStatus; } });
// Redis functions (histórico temporário)
var whatsapp_redis_1 = require("./whatsapp.redis");
Object.defineProperty(exports, "saveMessageToHistory", { enumerable: true, get: function () { return whatsapp_redis_1.saveMessageToHistory; } });
Object.defineProperty(exports, "getHistoryFromRedis", { enumerable: true, get: function () { return whatsapp_redis_1.getHistoryFromRedis; } });
Object.defineProperty(exports, "getUnreadConversations", { enumerable: true, get: function () { return whatsapp_redis_1.getUnreadConversations; } });
Object.defineProperty(exports, "clearHistory", { enumerable: true, get: function () { return whatsapp_redis_1.clearHistory; } });
Object.defineProperty(exports, "markConversationAsRead", { enumerable: true, get: function () { return whatsapp_redis_1.markConversationAsRead; } });
// Queue system for async message processing
var whatsapp_queue_1 = require("./whatsapp.queue");
Object.defineProperty(exports, "enqueueResponse", { enumerable: true, get: function () { return whatsapp_queue_1.enqueueResponse; } });
Object.defineProperty(exports, "dequeueNextMessage", { enumerable: true, get: function () { return whatsapp_queue_1.dequeueNextMessage; } });
Object.defineProperty(exports, "markMessageCompleted", { enumerable: true, get: function () { return whatsapp_queue_1.markMessageCompleted; } });
Object.defineProperty(exports, "requeueMessageForRetry", { enumerable: true, get: function () { return whatsapp_queue_1.requeueMessageForRetry; } });
Object.defineProperty(exports, "getQueueStats", { enumerable: true, get: function () { return whatsapp_queue_1.getQueueStats; } });
Object.defineProperty(exports, "cleanOldMessages", { enumerable: true, get: function () { return whatsapp_queue_1.cleanOldMessages; } });
Object.defineProperty(exports, "getPendingMessagesByLid", { enumerable: true, get: function () { return whatsapp_queue_1.getPendingMessagesByLid; } });
// Queue worker
var whatsapp_queue_worker_1 = require("./whatsapp.queue.worker");
Object.defineProperty(exports, "processQueue", { enumerable: true, get: function () { return whatsapp_queue_worker_1.processQueue; } });
Object.defineProperty(exports, "startQueueWorker", { enumerable: true, get: function () { return whatsapp_queue_worker_1.startQueueWorker; } });
Object.defineProperty(exports, "stopQueueWorker", { enumerable: true, get: function () { return whatsapp_queue_worker_1.stopQueueWorker; } });
Object.defineProperty(exports, "getWorkerStatus", { enumerable: true, get: function () { return whatsapp_queue_worker_1.getWorkerStatus; } });
// Contacts management
var whatsapp_contacts_1 = require("./whatsapp.contacts");
Object.defineProperty(exports, "createOrUpdateContact", { enumerable: true, get: function () { return whatsapp_contacts_1.createOrUpdateContact; } });
Object.defineProperty(exports, "getContactByLid", { enumerable: true, get: function () { return whatsapp_contacts_1.getContactByLid; } });
Object.defineProperty(exports, "getContactByPhoneNumber", { enumerable: true, get: function () { return whatsapp_contacts_1.getContactByPhoneNumber; } });
Object.defineProperty(exports, "updateContactPhoneNumber", { enumerable: true, get: function () { return whatsapp_contacts_1.updateContactPhoneNumber; } });
// Utils
var whatsapp_utils_1 = require("./whatsapp.utils");
Object.defineProperty(exports, "extractPhoneNumberFromText", { enumerable: true, get: function () { return whatsapp_utils_1.extractPhoneNumberFromText; } });
Object.defineProperty(exports, "isValidPhoneNumber", { enumerable: true, get: function () { return whatsapp_utils_1.isValidPhoneNumber; } });
