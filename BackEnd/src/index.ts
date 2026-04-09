import './lib/env'
import express from 'express'
import cors from 'cors'
import agentsRoutes from './api/routes/agents.routes'
import authRoutes from './api/routes/auth.routes'
import flowsRoutes from './api/routes/flows.routes'
import whatsappRoutes from './api/routes/whatsapp.routes'
import cacheRoutes from './api/routes/cache.routes'
import billingRoutes from './api/routes/billing.routes'
import { handleStripeWebhook } from './api/routes/billing.routes'
import kpisRoutes from './api/routes/kpis.routes'
import templatesRoutes from './api/routes/templates.routes'
import governanceRoutes from './api/routes/governance.routes'
import settingsRoutes from './api/routes/settings.routes'
import deletionBlockersRoutes from './api/routes/deletion-blockers.routes'
import { requireAuth } from './middleware/auth.middleware'
import { getDashboard } from './api/controllers/dashboard.controller'
import { getInsightsApi } from './api/controllers/insights-api.controller'
import {
  listNotifications,
  markNotificationRead,
  testNotification
} from './api/controllers/notifications.controller'

const app = express()

app.use(cors())

// ✅ ENDPOINT DE TESTE - Para verificar se a rota está acessível
app.get('/billing/webhook/test', (req, res) => {
    console.log('✅ [TEST] Endpoint de teste acessado!')
    res.json({ 
        success: true, 
        message: 'Webhook endpoint está acessível',
        timestamp: new Date().toISOString(),
        server: '192.168.15.31:3333'
    })
})

// ✅ CRÍTICO: Registrar webhook do Stripe ANTES de qualquer parsing de JSON
// O Stripe precisa do body raw para verificar a assinatura do webhook
app.post('/billing/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
    console.log('')
    console.log('═══════════════════════════════════════════════════════════')
    console.log('🔔 [Index] Rota /billing/webhook chamada!')
    console.log('═══════════════════════════════════════════════════════════')
    console.log('📥 Method:', req.method)
    console.log('📥 URL:', req.url)
    console.log('📥 IP:', req.ip || req.connection.remoteAddress)
    console.log('📥 Headers stripe-signature:', req.headers['stripe-signature'] ? 'presente' : 'ausente')
    console.log('📥 Content-Type:', req.headers['content-type'])
    console.log('📥 Body type:', typeof req.body)
    console.log('📥 Body length:', req.body?.length || 0)
    handleStripeWebhook(req, res)
})

// Aumentar limite para suportar webhooks grandes
// Agora aplicar express.json() para todas as outras rotas
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Rotas de agentes (execução direta - mantido para compatibilidade)
app.use('/agents', agentsRoutes)

// Rotas de flows (orquestração central - NOVO)
app.use('/flows', flowsRoutes)

// Rotas de Chat (Atalho para /agents/chat para compatibilidade com Frontend)
import { agentChat } from './api/controllers/agents.controller'
app.post('/chat', agentChat)

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

// Rotas que existiam na Edge Function e o front chama no BASE_URL (porta 3333)
app.get('/dashboard', requireAuth, getDashboard)
app.get('/insights', requireAuth, getInsightsApi)
app.get('/notifications', requireAuth, listNotifications)
app.post('/notifications/mark-read', requireAuth, markNotificationRead)
app.post('/notifications/test', requireAuth, testNotification)

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
  console.log('🚀 Backend rodando em http://0.0.0.0:3333')
  console.log('🌐 Acessível em: http://192.168.15.31:3333')
  console.log('📊 Flows disponíveis em /flows')
  console.log('🤖 Agentes disponíveis em /agents')
  console.log('📱 WhatsApp disponível em /whatsapp')
  console.log('🧹 Cache disponível em /cache')
  console.log('💳 Billing disponível em /billing')
  console.log('💳 Billing Webhook disponível em /billing/webhook')
  console.log('🧪 Teste do Webhook: http://192.168.15.31:3333/billing/webhook/test')
  console.log('📈 KPIs disponíveis em /kpis')
  console.log('📊 Dashboard em /dashboard | Insights em /insights | Notificações em /notifications')

  // Inicia worker de fila
  await startQueueWorkerIfNeeded()
})
