"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const flows_controller_1 = require("../controllers/flows.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ✅ Listar e ver flows: qualquer usuário autenticado
router.get('/', auth_middleware_1.requireAuth, flows_controller_1.listFlows);
router.get('/refine-description/status', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, flows_controller_1.refineFlowDescriptionStatus);
router.get('/:id', auth_middleware_1.requireAuth, flows_controller_1.getFlow);
// ✅ Executar flow: qualquer usuário autenticado
router.post('/execute', auth_middleware_1.requireAuth, flows_controller_1.executeFlow);
// ✅ SÓ ADMIN: Criar, atualizar e deletar flows
router.post('/generate-mvp', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, flows_controller_1.generateFlowMvp);
router.post('/refine-description', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, flows_controller_1.refineFlowDescriptionClaude);
router.post('/', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, flows_controller_1.createFlow);
router.put('/:id', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, flows_controller_1.updateFlow);
router.delete('/:id', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, flows_controller_1.deleteFlow);
exports.default = router;
