"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agents_controller_1 = require("../controllers/agents.controller");
const router = (0, express_1.Router)();
// GET /agents → lista agentes
router.get('/', agents_controller_1.listAgents);
// POST /agents/chat → conversa com o agente
router.post('/chat', agents_controller_1.agentChat);
// POST /agents/decisions/:id/approve → aprovar decisão
router.post('/decisions/:id/approve', agents_controller_1.approveDecision);
// POST /agents/decisions/:id/reject → rejeitar decisão
router.post('/decisions/:id/reject', agents_controller_1.rejectDecision);
exports.default = router;
