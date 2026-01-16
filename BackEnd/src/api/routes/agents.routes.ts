import { Router } from 'express'
import { listAgents } from '../controllers/agents.controller'

const router = Router()

router.get('/', listAgents)

export default router
