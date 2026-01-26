import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import agentsRoutes from './api/routes/agents.routes'
import authRoutes from './api/routes/auth.routes'
import flowsRoutes from './api/routes/flows.routes'
import whatsappRoutes from './api/routes/whatsapp.routes'

const app = express()

app.use(cors())
app.use(express.json())

// Rotas de agentes (execução direta - mantido para compatibilidade)
app.use('/agents', agentsRoutes)

// Rotas de flows (orquestração central - NOVO)
app.use('/flows', flowsRoutes)

// Rotas de autenticação
app.use('/auth/outlook', authRoutes)

// Rotas de WhatsApp (Evolution API)
app.use('/whatsapp', whatsappRoutes)

app.listen(3333, () => {
  console.log('🚀 Backend rodando em http://localhost:3333')
  console.log('📊 Flows disponíveis em /flows')
  console.log('🤖 Agentes disponíveis em /agents')
  console.log('📱 WhatsApp disponível em /whatsapp')
})
