"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listNotifications = listNotifications;
exports.markNotificationRead = markNotificationRead;
exports.testNotification = testNotification;
const supabase_1 = require("../../lib/supabase");
const company_helper_1 = require("../../utils/company-helper");
const logger_1 = __importDefault(require("../../lib/logger"));
/**
 * Lista notificações in-app da empresa do usuário autenticado.
 */
async function listNotifications(req, res) {
    try {
        const email = req.user?.email;
        if (!email) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(email);
        if (!companiesId) {
            return res.json({ notifications: [] });
        }
        const { data, error } = await supabase_1.supabase
            .from('tb_notifications')
            .select('id, type, title, body, read, metadata, created_at')
            .eq('companies_id', companiesId)
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) {
            logger_1.default.warn('[listNotifications] Erro:', error.message);
            return res.json({ notifications: [] });
        }
        const notifications = (data || []).map((row) => ({
            id: row.id,
            type: row.type,
            title: row.title,
            message: row.body,
            read: row.read,
            metadata: row.metadata,
            createdAt: row.created_at,
        }));
        return res.json({ notifications });
    }
    catch (err) {
        logger_1.default.error('[listNotifications] Erro:', err);
        return res.status(500).json({ error: 'Erro ao listar notificações' });
    }
}
async function markNotificationRead(req, res) {
    try {
        const email = req.user?.email;
        if (!email) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(email);
        if (!companiesId) {
            return res.json({ success: true });
        }
        const id = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
        if (id === 'all') {
            await supabase_1.supabase
                .from('tb_notifications')
                .update({ read: true })
                .eq('companies_id', companiesId)
                .eq('read', false);
        }
        else if (id) {
            await supabase_1.supabase
                .from('tb_notifications')
                .update({ read: true })
                .eq('companies_id', companiesId)
                .eq('id', id);
        }
        return res.json({ success: true });
    }
    catch (err) {
        logger_1.default.error('[markNotificationRead] Erro:', err);
        return res.status(500).json({ error: 'Erro ao marcar notificação' });
    }
}
async function testNotification(_req, res) {
    return res.json({ success: true });
}
