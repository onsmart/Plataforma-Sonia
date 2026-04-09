import { Router } from 'express'
import { getDeletionBlockers } from '../controllers/deletion-blockers.controller'
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware'

const router = Router()

router.get('/', requireAuth, requireAdmin, getDeletionBlockers)

export default router
