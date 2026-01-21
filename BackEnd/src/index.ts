import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import agentsRoutes from './api/routes/agents.routes'
import authRoutes from './api/routes/auth.routes'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/agents', agentsRoutes)
app.use('/auth/outlook',authRoutes)
app.listen(3333, () => {
  console.log('🚀 Backend rodando em http://localhost:3333')
})
