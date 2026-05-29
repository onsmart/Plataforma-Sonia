import { Router } from 'express'
import { getGeneralSettings, updateGeneralSettings } from '../controllers/settings.controller'
import { requireAuth, requireWorkspace } from '../../middleware/auth.middleware'

const router = Router()

router.get('/general', requireAuth, requireWorkspace, getGeneralSettings)
router.post('/general', requireAuth, requireWorkspace, updateGeneralSettings)

export default router

