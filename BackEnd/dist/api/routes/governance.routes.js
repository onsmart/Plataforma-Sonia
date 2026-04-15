"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const governance_controller_1 = require("../controllers/governance.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ✅ Buscar configuração: qualquer usuário autenticado
router.get('/', auth_middleware_1.requireAuth, governance_controller_1.getGovernanceConfig);
// ✅ Simular teste de regras (jailbreak / anti-alucinação)
router.post('/test', auth_middleware_1.requireAuth, governance_controller_1.postGovernanceTest);
// ✅ SÓ ADMIN: Atualizar configuração
router.put('/', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, governance_controller_1.updateGovernanceConfig);
exports.default = router;
