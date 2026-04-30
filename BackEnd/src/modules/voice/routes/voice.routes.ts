import { Router } from 'express'
import { requireAuth, requireAdmin } from '../../../middleware/auth.middleware'
import {
  getVoiceCallRuntimeStatusController,
  listElevenLabsVoicesController
} from '../controllers/voice.controller'

const router = Router()

router.get('/elevenlabs/voices', requireAuth, requireAdmin, listElevenLabsVoicesController)
router.get('/calls/runtime-status', requireAuth, requireAdmin, getVoiceCallRuntimeStatusController)

export default router
