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
const billing_routes_1 = __importDefault(require("./api/routes/billing.routes"));
const billing_routes_2 = require("./api/routes/billing.routes");
const kpis_routes_1 = __importDefault(require("./api/routes/kpis.routes"));
const templates_routes_1 = __importDefault(require("./api/routes/templates.routes"));
const governance_routes_1 = __importDefault(require("./api/routes/governance.routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
// ✅ ENDPOINT DE TESTE - Para verificar se a rota está acessível
app.get('/billing/webhook/test', (req, res) => {
    console.log('✅ [TEST] Endpoint de teste acessado!');
    res.json({
        success: true,
        message: 'Webhook endpoint está acessível',
        timestamp: new Date().toISOString(),
        server: '192.168.15.31:3333'
    });
});
// ✅ CRÍTICO: Registrar webhook do Stripe ANTES de qualquer parsing de JSON
// O Stripe precisa do body raw para verificar a assinatura do webhook
app.post('/billing/webhook', express_1.default.raw({ type: 'application/json' }), (req, res, next) => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔔 [Index] Rota /billing/webhook chamada!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📥 Method:', req.method);
    console.log('📥 URL:', req.url);
    console.log('📥 IP:', req.ip || req.connection.remoteAddress);
    console.log('📥 Headers stripe-signature:', req.headers['stripe-signature'] ? 'presente' : 'ausente');
    console.log('📥 Content-Type:', req.headers['content-type']);
    console.log('📥 Body type:', typeof req.body);
    console.log('📥 Body length:', req.body?.length || 0);
    (0, billing_routes_2.handleStripeWebhook)(req, res);
});
// Aumentar limite para suportar webhooks grandes do Evolution API
// Agora aplicar express.json() para todas as outras rotas
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
// Rotas de Billing (Stripe) - webhook já foi registrado acima, aqui são as outras rotas
app.use('/billing', billing_routes_1.default);
// Rotas de KPIs (Métricas e Analytics)
app.use('/kpis', kpis_routes_1.default);
// Rotas de Templates (Agentes)
app.use('/templates', templates_routes_1.default);
// Rotas de Governance
app.use('/governance', governance_routes_1.default);
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
app.listen(3333, '0.0.0.0', async () => {
    console.log('🚀 Backend rodando em http://0.0.0.0:3333');
    console.log('🌐 Acessível em: http://192.168.15.31:3333');
    console.log('📊 Flows disponíveis em /flows');
    console.log('🤖 Agentes disponíveis em /agents');
    console.log('📱 WhatsApp disponível em /whatsapp');
    console.log('🧹 Cache disponível em /cache');
    console.log('💳 Billing disponível em /billing');
    console.log('💳 Billing Webhook disponível em /billing/webhook');
    console.log('🧪 Teste do Webhook: http://192.168.15.31:3333/billing/webhook/test');
    console.log('📈 KPIs disponíveis em /kpis');
    // Inicia worker de fila
    await startQueueWorkerIfNeeded();
});
