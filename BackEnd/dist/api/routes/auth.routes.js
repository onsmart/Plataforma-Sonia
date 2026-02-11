"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const outlook_auth_controller_1 = require("../controllers/outlook-auth.controller");
const router = (0, express_1.Router)();
// A rota já está prefixada com '/auth/outlook' no index.ts, então aqui é apenas '/callback'
router.get('/callback', outlook_auth_controller_1.outlookCallback);
exports.default = router;
