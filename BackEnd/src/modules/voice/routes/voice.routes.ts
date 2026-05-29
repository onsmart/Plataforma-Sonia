import { Router } from 'express'
import { requireAuth, requireWorkspace, requireAdmin } from '../../../middleware/auth.middleware'
import {
  getVoiceCallRuntimeStatusController,
  listElevenLabsVoicesController
} from '../controllers/voice.controller'

const router = Router()

router.get('/elevenlabs/voices', requireAuth, requireWorkspace, requireAdmin, listElevenLabsVoicesController)
router.get('/calls/runtime-status', requireAuth, requireWorkspace, requireAdmin, getVoiceCallRuntimeStatusController)

export default router
