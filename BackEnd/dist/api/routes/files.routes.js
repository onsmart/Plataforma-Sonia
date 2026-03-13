"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const files_controller_1 = require("../controllers/files.controller");
const filesRoutes = (0, express_1.Router)();
const filesController = new files_controller_1.FilesController();
// Rota para processar vetorização de arquivo
// POST /files/:fileId/process
filesRoutes.post('/:fileId/process', (req, res) => filesController.process(req, res));
// Rota para listar skills de um arquivo
// GET /files/:fileId/skills
filesRoutes.get('/:fileId/skills', (req, res) => filesController.getSkills(req, res));
exports.default = filesRoutes;
