"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const files_controller_1 = require("../controllers/files.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const filesRoutes = (0, express_1.Router)();
const filesController = new files_controller_1.FilesController();
// Upload KB via service role (contorna RLS do Storage no browser)
// POST /files/upload
filesRoutes.post('/upload', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, (req, res) => filesController.upload(req, res));
// Rota para processar vetorização de arquivo
// POST /files/:fileId/process
filesRoutes.post('/:fileId/process', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, (req, res) => filesController.process(req, res));
// Rota para listar skills de um arquivo
// GET /files/:fileId/skills
filesRoutes.get('/:fileId/skills', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, (req, res) => filesController.getSkills(req, res));
// GET /files/:fileId/readiness — arquivo processado e pronto para o agente
filesRoutes.get('/:fileId/readiness', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, (req, res) => filesController.readiness(req, res));
// Rota para deletar arquivo definitivamente (Storage + metadados + chunks + vínculos)
// DELETE /files/:fileId
filesRoutes.delete('/:fileId', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, (req, res) => filesController.delete(req, res));
exports.default = filesRoutes;
