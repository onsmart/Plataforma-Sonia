"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listNotifications = listNotifications;
exports.markNotificationRead = markNotificationRead;
exports.testNotification = testNotification;
/**
 * Rotas mínimas para o NotificationCenter do front (persistência pode ser adicionada depois).
 */
async function listNotifications(_req, res) {
    return res.json({ notifications: [] });
}
async function markNotificationRead(_req, res) {
    return res.json({ success: true });
}
async function testNotification(_req, res) {
    return res.json({ success: true });
}
