import { Router } from 'express'
import { getKPIs, saveFeedback } from '../controllers/kpis.controller'
import { requireAuth, requireWorkspace } from '../../middleware/auth.middleware'

const router = Router()

// ✅ Rotas de KPIs requerem autenticação
router.get('/', requireAuth, requireWorkspace, getKPIs)
router.post('/feedback', requireAuth, requireWorkspace, saveFeedback)

export default router
