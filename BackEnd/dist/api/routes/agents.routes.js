"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// GET /agents
router.get('/', async (req, res) => {
    return res.json({
        message: 'Agents route is working 🚀'
    });
});
exports.default = router;
