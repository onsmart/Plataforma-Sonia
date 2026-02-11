"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const flows_controller_1 = require("../controllers/flows.controller");
const router = (0, express_1.Router)();
// GET /flows → lista flows do usuário
router.get('/', flows_controller_1.listFlows);
// GET /flows/:id → busca um flow específico
router.get('/:id', flows_controller_1.getFlow);
// POST /flows/execute → executa um flow (orquestração central)
router.post('/execute', flows_controller_1.executeFlow);
exports.default = router;
