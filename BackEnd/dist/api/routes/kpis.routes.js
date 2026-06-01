"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const kpis_controller_1 = require("../controllers/kpis.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ✅ Rotas de KPIs requerem autenticação
router.get('/', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, kpis_controller_1.getKPIs);
router.post('/feedback', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, kpis_controller_1.saveFeedback);
exports.default = router;
