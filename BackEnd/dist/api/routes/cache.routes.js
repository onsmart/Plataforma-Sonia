"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cache_controller_1 = require("../controllers/cache.controller");
const router = (0, express_1.Router)();
// POST /cache/clear → limpa o cache do Supabase
router.post('/clear', cache_controller_1.clearCache);
// GET /cache/status → verifica o status do cache
router.get('/status', cache_controller_1.getCacheStatus);
exports.default = router;
