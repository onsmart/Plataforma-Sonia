import { Router } from 'express'
import { getGeneralSettings, updateGeneralSettings } from '../controllers/settings.controller'
import { requireAuth } from '../../middleware/auth.middleware'

const router = Router()

router.get('/general', requireAuth, getGeneralSettings)
router.post('/general', requireAuth, updateGeneralSettings)

export default router

