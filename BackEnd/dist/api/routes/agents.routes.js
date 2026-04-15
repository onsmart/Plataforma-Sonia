"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agents_controller_1 = require("../controllers/agents.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ✅ Rotas PÚBLICAS (sem auth) - Chat é público
router.post('/chat', agents_controller_1.agentChat);
// ✅ Rotas ADMINISTRATIVAS (com auth obrigatória)
router.get('/', auth_middleware_1.requireAuth, agents_controller_1.listAgents);
router.get('/:id/skills', auth_middleware_1.requireAuth, agents_controller_1.getAgentSkillsForRequest);
// ✅ SÓ ADMIN: Criar agente
router.post('/create', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, agents_controller_1.createAgent);
// ✅ SÓ ADMIN: Atualizar agente
router.put('/:id', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, agents_controller_1.updateAgent);
// ✅ SÓ ADMIN: Excluir agente permanentemente
router.delete('/:id', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, agents_controller_1.deleteAgent);
// ✅ SÓ ADMIN: Ativar agente
router.put('/:id/activate', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, agents_controller_1.activateAgent);
// ✅ SÓ ADMIN: Atribuir agente a mensagem
router.put('/assign', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, agents_controller_1.assignAgent);
// ✅ SÓ ADMIN: Ver e aprovar/rejeitar decisões
router.post('/decisions/:id/approve', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, agents_controller_1.approveDecision);
router.post('/decisions/:id/reject', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, agents_controller_1.rejectDecision);
exports.default = router;
