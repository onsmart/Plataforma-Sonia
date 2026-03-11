import { Router } from 'express'
import { getKPIs, saveFeedback } from '../controllers/kpis.controller'

const router = Router()

// GET /kpis → retorna todos os KPIs calculados
router.get('/', getKPIs)

// POST /kpis/feedback → salva feedback do usuário
router.post('/feedback', saveFeedback)

export default router
