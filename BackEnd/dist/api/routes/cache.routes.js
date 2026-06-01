"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cache_controller_1 = require("../controllers/cache.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
const cacheAdminEnabled = process.env.ENABLE_CACHE_ADMIN !== 'false';
function cacheAdminDisabled(_req, res) {
    return res.status(404).json({ error: 'Not found' });
}
const cacheGuard = cacheAdminEnabled
    ? [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin]
    : [cacheAdminDisabled];
// POST /cache/clear → limpa o cache do Supabase (admin only)
router.post('/clear', ...cacheGuard, cache_controller_1.clearCache);
// GET /cache/status → verifica o status do cache (admin only)
router.get('/status', ...cacheGuard, cache_controller_1.getCacheStatus);
exports.default = router;
