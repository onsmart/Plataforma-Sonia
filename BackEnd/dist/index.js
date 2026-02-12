"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const agents_routes_1 = __importDefault(require("./api/routes/agents.routes"));
const auth_routes_1 = __importDefault(require("./api/routes/auth.routes"));
const flows_routes_1 = __importDefault(require("./api/routes/flows.routes"));
const whatsapp_routes_1 = __importDefault(require("./api/routes/whatsapp.routes"));
const cache_routes_1 = __importDefault(require("./api/routes/cache.routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
// Aumentar limite para suportar webhooks grandes do Evolution API
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// Rotas de agentes (execução direta - mantido para compatibilidade)
app.use('/agents', agents_routes_1.default);
// Rotas de flows (orquestração central - NOVO)
app.use('/flows', flows_routes_1.default);
// Rotas de Chat (Atalho para /agents/chat para compatibilidade com Frontend)
const agents_controller_1 = require("./api/controllers/agents.controller");
app.post('/chat', agents_controller_1.agentChat);
// Rotas de autenticação
app.use('/auth/outlook', auth_routes_1.default);
// Rotas de WhatsApp (Evolution API)
app.use('/whatsapp', whatsapp_routes_1.default);
// Rotas de Cache
app.use('/cache', cache_routes_1.default);
// Rotas de Arquivos (RAG)
const files_routes_1 = __importDefault(require("./api/routes/files.routes"));
app.use('/files', files_routes_1.default);
// Inicia worker de fila para processar respostas do WhatsApp
let queueWorkerStarted = false;
async function startQueueWorkerIfNeeded() {
    if (queueWorkerStarted)
        return;
    try {
        const { startQueueWorker } = await Promise.resolve().then(() => __importStar(require('./services/integrations/whatsapp/whatsapp.queue.worker')));
        startQueueWorker(2000); // Processa a cada 2 segundos
        queueWorkerStarted = true;
        console.log('✅ Worker de fila WhatsApp iniciado');
    }
    catch (error) {
        console.error('❌ Erro ao iniciar worker de fila:', error?.message);
    }
}
app.listen(3333, async () => {
    console.log('🚀 Backend rodando em http://localhost:3333');
    console.log('📊 Flows disponíveis em /flows');
    console.log('🤖 Agentes disponíveis em /agents');
    console.log('📱 WhatsApp disponível em /whatsapp');
    console.log('🧹 Cache disponível em /cache');
    // Inicia worker de fila
    await startQueueWorkerIfNeeded();
});
