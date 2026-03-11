import { Router } from 'express'
import { getKPIs, saveFeedback } from '../controllers/kpis.controller'
import { requireAuth } from '../../middleware/auth.middleware'

const router = Router()

// ✅ Rotas de KPIs requerem autenticação
router.get('/', requireAuth, getKPIs)
router.post('/feedback', requireAuth, saveFeedback)

export default router
