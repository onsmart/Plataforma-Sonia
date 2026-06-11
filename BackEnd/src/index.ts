import './lib/env'
import { logFlowHandoffEmailStartupStatus } from './services/flows/flow-team-notify.config'
import { logPlatformEmailStartupStatus } from './services/platform-email.service'
import { register } from './lib/metrics'
import { metricsMiddleware } from './middleware/metrics.middleware'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import agentsRoutes from './api/routes/agents.routes'
import authRoutes from './api/routes/auth.routes'
import flowsRoutes from './api/routes/flows.routes'
import whatsappRoutes from './api/routes/whatsapp.routes'
import { receiveWhatsAppWebhook } from './api/controllers/whatsapp.controller'
import {
  parseMetaWhatsAppWebhookJson,
  validateMetaWhatsAppWebhook,
} from './middleware/meta-webhook.middleware'
import cacheRoutes from './api/routes/cache.routes'
import billingRoutes from './api/routes/billing.routes'
import { handleStripeWebhook } from './api/routes/billing.routes'
import kpisRoutes from './api/routes/kpis.routes'
import templatesRoutes from './api/routes/templates.routes'
import governanceRoutes from './api/routes/governance.routes'
import settingsRoutes from './api/routes/settings.routes'
import teamRoutes from './api/routes/team.routes'
import deletionBlockersRoutes from './api/routes/deletion-blockers.routes'
import emailRoutes from './api/routes/email.routes'
import calendarRoutes from './api/routes/calendar.routes'
import crmRoutes from './api/routes/crm.routes'
import integrationToolsRoutes from './api/routes/integration-tools.routes'
import voiceRoutes from './modules/voice/routes/voice.routes'
import copilotRoutes from './api/routes/copilot.routes'
import { requireAuth, requireWorkspace } from './middleware/auth.middleware'
import { agentChat } from './api/controllers/agents.controller'
import { getDashboard } from './api/controllers/dashboard.controller'
import { getInsightsApi } from './api/controllers/insights-api.controller'
import {
  listNotifications,
  markNotificationRead,
  testNotification
} from './api/controllers/notifications.controller'
import { registerRealtimeVoiceAgentService } from './modules/voice/services/voiceRuntime.service'
import { createLocalRealtimeVoiceAgentServiceFromEnv } from './modules/voice/services/localRealtimeVoiceAgent.service'
import { isMetaWebhookConfigured } from './services/integrations/whatsapp/meta-webhook-secret.service'
import { validateCalendlyWebhook } from './middleware/calendly-webhook.middleware'
import { receiveCalendlyWebhook } from './api/controllers/calendar.controller'
import {
  globalRateLimiter,
  webhookRateLimiter,
  agentChatRateLimiter,
} from './middleware/rate-limit.middleware'
import { errorHandler, notFoundHandler } from './middleware/error-handler.middleware'
import adminRoutes from './api/routes/admin.routes'

const app = express()
app.disable('x-powered-by')

if (process.env.TRUST_PROXY_HTTPS === 'true') {
  // Nginx/reverse proxy na frente do Node (ex.: webhook.onsmart.ai → 127.0.0.1:3333)
  app.set('trust proxy', 1)
}

const corsOriginEntries = String(process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

// Entradas exatas (URL completa) e curingas de hostname (ex.: "*-onsmart.vercel.app"
// cobre os previews da Vercel, cujo subdomínio muda a cada deploy). Curingas só valem para HTTPS.
const corsOrigins = corsOriginEntries.filter((entry) => !entry.includes('*'))
const corsWildcardSuffixes = corsOriginEntries
  .map((entry) => entry.replace(/^https?:\/\//, ''))
  .filter((entry) => entry.startsWith('*'))
  .map((entry) => entry.slice(1))
  .filter(Boolean)

function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true
  if (corsOrigins.includes(origin)) return true

  try {
    const { protocol, hostname } = new URL(origin)
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true
    if (protocol !== 'https:') return false
    return corsWildcardSuffixes.some((suffix) => hostname.endsWith(suffix))
  } catch {
    return false
  }
}

registerRealtimeVoiceAgentService(createLocalRealtimeVoiceAgentServiceFromEnv())

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: process.env.TRUST_PROXY_HTTPS === 'true' ? undefined : false,
  })
)

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedCorsOrigin(origin)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    credentials: true,
  })
)

// /health — sem autenticação, sem rate limit (usado por load balancers e uptime monitors)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() })
})

// /metrics — protegido por Bearer token, só acessível internamente pelo Prometheus
app.get('/metrics', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!process.env.METRICS_BEARER_TOKEN || token !== process.env.METRICS_BEARER_TOKEN) {
    res.status(401).end()
    return
  }
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})

app.use(globalRateLimiter)

if (process.env.NODE_ENV !== 'production') {
  app.get('/billing/webhook/test', (_req, res) => {
    res.json({
      success: true,
      message: 'Webhook endpoint está acessível',
      timestamp: new Date().toISOString(),
    })
  })
}

// ✅ CRÍTICO: Registrar webhook do Stripe ANTES de qualquer parsing de JSON
// O Stripe precisa do body raw para verificar a assinatura do webhook
app.post('/billing/webhook', webhookRateLimiter, express.raw({ type: 'application/json' }), (req, res) => {
    handleStripeWebhook(req, res)
})

app.post(
  '/calendar/webhook/:id',
  webhookRateLimiter,
  express.raw({ type: 'application/json' }),
  validateCalendlyWebhook,
  receiveCalendlyWebhook
)

app.post(
  '/whatsapp/webhook',
  webhookRateLimiter,
  express.raw({
    type: (req) => String(req.headers['content-type'] || '').includes('application/json'),
  }),
  validateMetaWhatsAppWebhook,
  parseMetaWhatsAppWebhookJson,
  receiveWhatsAppWebhook
)

// Aumentar limite para suportar webhooks grandes
// Agora aplicar express.json() para todas as outras rotas
app.use(express.json({ limit: '12mb' }))
app.use(express.urlencoded({ limit: '12mb', extended: true }))

// Instrumentação HTTP — registra duração, total e erros de todas as rotas abaixo
app.use(metricsMiddleware)

// Rotas de agentes (execução direta - mantido para compatibilidade)
app.use('/agents', agentsRoutes)

// Rotas de flows (orquestração central - NOVO)
app.use('/flows', flowsRoutes)

// Rotas de Chat (Atalho para /agents/chat — requer autenticação)
app.post('/chat', requireAuth, requireWorkspace, agentChatRateLimiter, agentChat)

// Rotas de autenticação
app.use('/auth/outlook', authRoutes)

// Rotas de WhatsApp (Meta Cloud API)
app.use('/whatsapp', whatsappRoutes)

// Rotas de Cache
app.use('/cache', cacheRoutes)

// Rotas de Arquivos (RAG)
import filesRoutes from './api/routes/files.routes'
app.use('/files', filesRoutes)

// Rotas de Billing (Stripe) - webhook já foi registrado acima, aqui são as outras rotas
app.use('/billing', billingRoutes)

// Rotas de KPIs (Métricas e Analytics)
app.use('/kpis', kpisRoutes)

// Rotas de Templates (Agentes)
app.use('/templates', templatesRoutes)

app.use('/deletion-blockers', deletionBlockersRoutes)

// Rotas de Governance
app.use('/governance', governanceRoutes)

// Rotas de Settings
app.use('/settings', settingsRoutes)

// Equipe (membros / convites)
app.use('/team', teamRoutes)

// Rotas de Email
app.use('/email', emailRoutes)

// Rotas de Calendário / Calendly
app.use('/calendar', calendarRoutes)
app.use('/crm', crmRoutes)
app.use('/integrations/tools', integrationToolsRoutes)

// Rotas de Voz dos agentes
app.use('/voice', voiceRoutes)

// Sonia Copilot (assistente fixa da plataforma)
app.use('/copilot', copilotRoutes)
app.use('/admin', adminRoutes)

// Rotas que existiam na Edge Function e o front chama no BASE_URL (porta 3333)
app.get('/dashboard', requireAuth, requireWorkspace, getDashboard)
app.get('/insights', requireAuth, requireWorkspace, getInsightsApi)
app.get('/notifications', requireAuth, requireWorkspace, listNotifications)
app.post('/notifications/mark-read', requireAuth, requireWorkspace, markNotificationRead)
app.post('/notifications/test', requireAuth, requireWorkspace, testNotification)

app.use(notFoundHandler)
app.use(errorHandler)

// Inicia worker de fila para processar respostas do WhatsApp
let queueWorkerStarted = false
async function startQueueWorkerIfNeeded() {
  if (queueWorkerStarted) return

  try {
    const { startQueueWorker } = await import('./services/integrations/whatsapp/whatsapp.queue.worker')
    startQueueWorker(2000) // Processa a cada 2 segundos
    queueWorkerStarted = true
    console.log('✅ Worker de fila WhatsApp iniciado')
  } catch (error: any) {
    console.error('❌ Erro ao iniciar worker de fila:', error?.message)
  }
}

app.listen(3333, '0.0.0.0', async () => {
  logFlowHandoffEmailStartupStatus()
  logPlatformEmailStartupStatus()
  console.log('🚀 Backend rodando em http://0.0.0.0:3333')
  console.log('📡 GET /health — health check (sem auth)')
  console.log(
    process.env.METRICS_BEARER_TOKEN
      ? '📈 GET /metrics — Prometheus (Bearer token configurado)'
      : '⚠️  GET /metrics — METRICS_BEARER_TOKEN não definido, endpoint retornará 401'
  )
  console.log('📊 Flows disponíveis em /flows')
  console.log('🤖 Agentes disponíveis em /agents')
  console.log('📱 WhatsApp disponível em /whatsapp')
  const metaWebhookSecretConfigured = await isMetaWebhookConfigured()
  console.log(
    metaWebhookSecretConfigured
      ? '🔐 POST /whatsapp/webhook exige X-Hub-Signature-256 (env ou meta_app_secret por integração)'
      : '⚠️ Nenhum App Secret Meta (env ou integração) — POST /whatsapp/webhook retornará 403'
  )
  console.log('🧹 Cache disponível em /cache')
  console.log('💳 Billing disponível em /billing')
  console.log('💳 Billing Webhook disponível em /billing/webhook')
  console.log('📈 KPIs disponíveis em /kpis')
  console.log('📊 Dashboard em /dashboard | Insights em /insights | Notificações em /notifications')

  // Inicia worker de fila
  await startQueueWorkerIfNeeded()

  const retentionMs = parseInt(
    process.env.GOVERNANCE_RETENTION_INTERVAL_MS || String(24 * 60 * 60 * 1000),
    10
  )
  const runRetention = () => {
    import('./services/governance/governance-retention.service')
      .then((m) => m.runGovernanceRetentionPurge())
      .catch((e) => console.error('[Governance retention]', e?.message || e))
  }
  setTimeout(runRetention, 120_000)
  setInterval(runRetention, Math.max(retentionMs, 60_000))
  console.log(
    `🗓️ Purga de retenção (governança): primeira execução em ~2min, depois a cada ${Math.round(retentionMs / 3600000)}h`
  )
})
