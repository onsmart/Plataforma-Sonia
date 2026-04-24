import { Router } from 'express'
import { requireAuth, requireAdmin } from '../../../middleware/auth.middleware'
import { listElevenLabsVoicesController } from '../controllers/voice.controller'

const router = Router()

router.get('/elevenlabs/voices', requireAuth, requireAdmin, listElevenLabsVoicesController)

export default router
