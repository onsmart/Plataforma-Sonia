import { Router } from 'express'
import { requireAuth, requireWorkspace, requireAdmin } from '../../middleware/auth.middleware'
import { getPlatformHealth } from '../controllers/platform-health.controller'

const router = Router()

router.get('/platform-health', requireAuth, requireWorkspace, requireAdmin, getPlatformHealth)

export default router
