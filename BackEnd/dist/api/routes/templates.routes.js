"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const templates_controller_1 = require("../controllers/templates.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ✅ Listar templates (qualquer usuário autenticado - mostra da empresa + globais)
router.get('/', auth_middleware_1.requireAuth, templates_controller_1.listTemplates);
// ✅ SÓ ADMIN: Criar template
router.post('/', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, templates_controller_1.createTemplate);
// ✅ SÓ ADMIN: Atualizar template
router.put('/:id', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, templates_controller_1.updateTemplate);
// ✅ SÓ ADMIN: Deletar template
router.delete('/:id', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, templates_controller_1.deleteTemplate);
exports.default = router;
