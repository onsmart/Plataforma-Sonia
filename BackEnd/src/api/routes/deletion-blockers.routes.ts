import { Router } from 'express'
import { getDeletionBlockers } from '../controllers/deletion-blockers.controller'
import { requireAuth, requireWorkspace, requireAdmin } from '../../middleware/auth.middleware'

const router = Router()

router.get('/', requireAuth, requireWorkspace, requireAdmin, getDeletionBlockers)

export default router
