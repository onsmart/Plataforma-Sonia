"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agents_controller_1 = require("../controllers/agents.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const voice_controller_1 = require("../../modules/voice/controllers/voice.controller");
const router = (0, express_1.Router)();
router.post('/chat', auth_middleware_1.requireAuth, agents_controller_1.agentChat);
// ✅ Rotas ADMINISTRATIVAS (com auth obrigatória)
router.get('/', auth_middleware_1.requireAuth, agents_controller_1.listAgents);
router.get('/:id/skills', auth_middleware_1.requireAuth, agents_controller_1.getAgentSkillsForRequest);
router.get('/:id/setup-health', auth_middleware_1.requireAuth, agents_controller_1.getAgentSetupHealthController);
// ✅ SÓ ADMIN: Criar agente
router.post('/create', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, agents_controller_1.createAgent);
router.post('/provision-onsmart-demo', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, agents_controller_1.provisionOnsmartDemoController);
// ✅ SÓ ADMIN: Atualizar agente
router.put('/:id', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, agents_controller_1.updateAgent);
router.get('/:agentId/voice-profile', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, voice_controller_1.getAgentVoiceProfileController);
router.put('/:agentId/voice-profile', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, voice_controller_1.updateAgentVoiceProfileController);
router.post('/:agentId/voice-preview', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, voice_controller_1.createAgentVoicePreviewController);
router.post('/:agentId/generate-voice-response', auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin, voice_controller_1.generateAgentVoiceResponseController);
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
