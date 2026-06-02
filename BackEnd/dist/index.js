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
require("./lib/env");
const flow_team_notify_config_1 = require("./services/flows/flow-team-notify.config");
const platform_email_service_1 = require("./services/platform-email.service");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const agents_routes_1 = __importDefault(require("./api/routes/agents.routes"));
const auth_routes_1 = __importDefault(require("./api/routes/auth.routes"));
const flows_routes_1 = __importDefault(require("./api/routes/flows.routes"));
const whatsapp_routes_1 = __importDefault(require("./api/routes/whatsapp.routes"));
const whatsapp_controller_1 = require("./api/controllers/whatsapp.controller");
const meta_webhook_middleware_1 = require("./middleware/meta-webhook.middleware");
const cache_routes_1 = __importDefault(require("./api/routes/cache.routes"));
const billing_routes_1 = __importDefault(require("./api/routes/billing.routes"));
const billing_routes_2 = require("./api/routes/billing.routes");
const kpis_routes_1 = __importDefault(require("./api/routes/kpis.routes"));
const templates_routes_1 = __importDefault(require("./api/routes/templates.routes"));
const governance_routes_1 = __importDefault(require("./api/routes/governance.routes"));
const settings_routes_1 = __importDefault(require("./api/routes/settings.routes"));
const team_routes_1 = __importDefault(require("./api/routes/team.routes"));
const deletion_blockers_routes_1 = __importDefault(require("./api/routes/deletion-blockers.routes"));
const email_routes_1 = __importDefault(require("./api/routes/email.routes"));
const calendar_routes_1 = __importDefault(require("./api/routes/calendar.routes"));
const crm_routes_1 = __importDefault(require("./api/routes/crm.routes"));
const integration_tools_routes_1 = __importDefault(require("./api/routes/integration-tools.routes"));
const voice_routes_1 = __importDefault(require("./modules/voice/routes/voice.routes"));
const copilot_routes_1 = __importDefault(require("./api/routes/copilot.routes"));
const auth_middleware_1 = require("./middleware/auth.middleware");
const agents_controller_1 = require("./api/controllers/agents.controller");
const dashboard_controller_1 = require("./api/controllers/dashboard.controller");
const insights_api_controller_1 = require("./api/controllers/insights-api.controller");
const notifications_controller_1 = require("./api/controllers/notifications.controller");
const voiceRuntime_service_1 = require("./modules/voice/services/voiceRuntime.service");
const localRealtimeVoiceAgent_service_1 = require("./modules/voice/services/localRealtimeVoiceAgent.service");
const meta_webhook_secret_service_1 = require("./services/integrations/whatsapp/meta-webhook-secret.service");
const calendly_webhook_middleware_1 = require("./middleware/calendly-webhook.middleware");
const calendar_controller_1 = require("./api/controllers/calendar.controller");
const rate_limit_middleware_1 = require("./middleware/rate-limit.middleware");
const error_handler_middleware_1 = require("./middleware/error-handler.middleware");
const admin_routes_1 = __importDefault(require("./api/routes/admin.routes"));
const app = (0, express_1.default)();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY_HTTPS === 'true') {
    // Nginx/reverse proxy na frente do Node (ex.: webhook.onsmart.ai → 127.0.0.1:3333)
    app.set('trust proxy', 1);
}
const corsOrigins = String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
function isAllowedCorsOrigin(origin) {
    if (!origin)
        return true;
    if (corsOrigins.includes(origin))
        return true;
    try {
        const { hostname } = new URL(origin);
        return hostname === 'localhost' || hostname === '127.0.0.1';
    }
    catch {
        return false;
    }
}
(0, voiceRuntime_service_1.registerRealtimeVoiceAgentService)((0, localRealtimeVoiceAgent_service_1.createLocalRealtimeVoiceAgentServiceFromEnv)());
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: process.env.TRUST_PROXY_HTTPS === 'true' ? undefined : false,
}));
app.use((0, cors_1.default)({
    origin(origin, callback) {
        if (isAllowedCorsOrigin(origin)) {
            callback(null, true);
            return;
        }
        callback(null, false);
    },
    credentials: true,
}));
app.use(rate_limit_middleware_1.globalRateLimiter);
if (process.env.NODE_ENV !== 'production') {
    app.get('/billing/webhook/test', (_req, res) => {
        res.json({
            success: true,
            message: 'Webhook endpoint está acessível',
            timestamp: new Date().toISOString(),
        });
    });
}
// ✅ CRÍTICO: Registrar webhook do Stripe ANTES de qualquer parsing de JSON
// O Stripe precisa do body raw para verificar a assinatura do webhook
app.post('/billing/webhook', rate_limit_middleware_1.webhookRateLimiter, express_1.default.raw({ type: 'application/json' }), (req, res) => {
    (0, billing_routes_2.handleStripeWebhook)(req, res);
});
app.post('/calendar/webhook/:id', rate_limit_middleware_1.webhookRateLimiter, express_1.default.raw({ type: 'application/json' }), calendly_webhook_middleware_1.validateCalendlyWebhook, calendar_controller_1.receiveCalendlyWebhook);
app.post('/whatsapp/webhook', rate_limit_middleware_1.webhookRateLimiter, express_1.default.raw({
    type: (req) => String(req.headers['content-type'] || '').includes('application/json'),
}), meta_webhook_middleware_1.validateMetaWhatsAppWebhook, meta_webhook_middleware_1.parseMetaWhatsAppWebhookJson, whatsapp_controller_1.receiveWhatsAppWebhook);
// Aumentar limite para suportar webhooks grandes
// Agora aplicar express.json() para todas as outras rotas
app.use(express_1.default.json({ limit: '12mb' }));
app.use(express_1.default.urlencoded({ limit: '12mb', extended: true }));
// Rotas de agentes (execução direta - mantido para compatibilidade)
app.use('/agents', agents_routes_1.default);
// Rotas de flows (orquestração central - NOVO)
app.use('/flows', flows_routes_1.default);
// Rotas de Chat (Atalho para /agents/chat — requer autenticação)
app.post('/chat', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, rate_limit_middleware_1.agentChatRateLimiter, agents_controller_1.agentChat);
// Rotas de autenticação
app.use('/auth/outlook', auth_routes_1.default);
// Rotas de WhatsApp (Meta Cloud API)
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
app.use('/deletion-blockers', deletion_blockers_routes_1.default);
// Rotas de Governance
app.use('/governance', governance_routes_1.default);
// Rotas de Settings
app.use('/settings', settings_routes_1.default);
// Equipe (membros / convites)
app.use('/team', team_routes_1.default);
// Rotas de Email
app.use('/email', email_routes_1.default);
// Rotas de Calendário / Calendly
app.use('/calendar', calendar_routes_1.default);
app.use('/crm', crm_routes_1.default);
app.use('/integrations/tools', integration_tools_routes_1.default);
// Rotas de Voz dos agentes
app.use('/voice', voice_routes_1.default);
// Sonia Copilot (assistente fixa da plataforma)
app.use('/copilot', copilot_routes_1.default);
app.use('/admin', admin_routes_1.default);
// Rotas que existiam na Edge Function e o front chama no BASE_URL (porta 3333)
app.get('/dashboard', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, dashboard_controller_1.getDashboard);
app.get('/insights', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, insights_api_controller_1.getInsightsApi);
app.get('/notifications', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, notifications_controller_1.listNotifications);
app.post('/notifications/mark-read', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, notifications_controller_1.markNotificationRead);
app.post('/notifications/test', auth_middleware_1.requireAuth, auth_middleware_1.requireWorkspace, notifications_controller_1.testNotification);
app.use(error_handler_middleware_1.notFoundHandler);
app.use(error_handler_middleware_1.errorHandler);
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
    (0, flow_team_notify_config_1.logFlowHandoffEmailStartupStatus)();
    (0, platform_email_service_1.logPlatformEmailStartupStatus)();
    console.log('🚀 Backend rodando em http://0.0.0.0:3333');
    console.log('📊 Flows disponíveis em /flows');
    console.log('🤖 Agentes disponíveis em /agents');
    console.log('📱 WhatsApp disponível em /whatsapp');
    const metaWebhookSecretConfigured = await (0, meta_webhook_secret_service_1.isMetaWebhookConfigured)();
    console.log(metaWebhookSecretConfigured
        ? '🔐 POST /whatsapp/webhook exige X-Hub-Signature-256 (env ou meta_app_secret por integração)'
        : '⚠️ Nenhum App Secret Meta (env ou integração) — POST /whatsapp/webhook retornará 403');
    console.log('🧹 Cache disponível em /cache');
    console.log('💳 Billing disponível em /billing');
    console.log('💳 Billing Webhook disponível em /billing/webhook');
    console.log('📈 KPIs disponíveis em /kpis');
    console.log('📊 Dashboard em /dashboard | Insights em /insights | Notificações em /notifications');
    // Inicia worker de fila
    await startQueueWorkerIfNeeded();
    const retentionMs = parseInt(process.env.GOVERNANCE_RETENTION_INTERVAL_MS || String(24 * 60 * 60 * 1000), 10);
    const runRetention = () => {
        Promise.resolve().then(() => __importStar(require('./services/governance/governance-retention.service'))).then((m) => m.runGovernanceRetentionPurge())
            .catch((e) => console.error('[Governance retention]', e?.message || e));
    };
    setTimeout(runRetention, 120000);
    setInterval(runRetention, Math.max(retentionMs, 60000));
    console.log(`🗓️ Purga de retenção (governança): primeira execução em ~2min, depois a cada ${Math.round(retentionMs / 3600000)}h`);
});
