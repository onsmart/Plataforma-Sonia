import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import agentsRoutes from './api/routes/agents.routes'
import authRoutes from './api/routes/auth.routes'
import flowsRoutes from './api/routes/flows.routes'
import whatsappRoutes from './api/routes/whatsapp.routes'
import cacheRoutes from './api/routes/cache.routes'

const app = express()

app.use(cors())
// Aumentar limite para suportar webhooks grandes do Evolution API
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

// Rotas de WhatsApp (Evolution API)
app.use('/whatsapp', whatsappRoutes)

// Rotas de Cache
app.use('/cache', cacheRoutes)

// Rotas de Arquivos (RAG)
import filesRoutes from './api/routes/files.routes'
app.use('/files', filesRoutes)

// Rotas de Billing (Stripe)
import billingRoutes from './api/routes/billing.routes'
app.use('/billing', billingRoutes)

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

app.listen(3333, async () => {
  console.log('🚀 Backend rodando em http://localhost:3333')
  console.log('📊 Flows disponíveis em /flows')
  console.log('🤖 Agentes disponíveis em /agents')
  console.log('📱 WhatsApp disponível em /whatsapp')
  console.log('🧹 Cache disponível em /cache')
  console.log('💳 Billing disponível em /billing')

  // Inicia worker de fila
  await startQueueWorkerIfNeeded()
})
