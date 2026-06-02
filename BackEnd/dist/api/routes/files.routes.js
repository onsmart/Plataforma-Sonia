"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const files_controller_1 = require("../controllers/files.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const filesRoutes = (0, express_1.Router)();
const filesController = new files_controller_1.FilesController();
/** @deprecated Prefer POST /files/create-text — upload legado (.txt/.pdf) */
filesRoutes.post('/upload', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, (0, auth_middleware_1.requirePermission)('basic.write'), (req, res) => filesController.upload(req, res));
filesRoutes.post('/create-text', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, (0, auth_middleware_1.requirePermission)('basic.write'), (req, res) => filesController.createText(req, res));
filesRoutes.post('/:fileId/process', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, (0, auth_middleware_1.requirePermission)('basic.write'), (req, res) => filesController.process(req, res));
filesRoutes.get('/:fileId/skills', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, (0, auth_middleware_1.requirePermission)('basic.read'), (req, res) => filesController.getSkills(req, res));
filesRoutes.get('/:fileId/readiness', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, (0, auth_middleware_1.requirePermission)('basic.read'), (req, res) => filesController.readiness(req, res));
filesRoutes.delete('/:fileId', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, (0, auth_middleware_1.requirePermission)('basic.write'), (req, res) => filesController.delete(req, res));
exports.default = filesRoutes;
