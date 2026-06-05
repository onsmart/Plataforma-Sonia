import { Router } from 'express'
import {
  copilotChatController,
  copilotTtsController,
  copilotVoiceSessionController,
} from '../controllers/copilot.controller'
import { requireAuth, requireWorkspace } from '../../middleware/auth.middleware'

const router = Router()

router.post('/chat',          requireAuth, requireWorkspace, copilotChatController)
router.post('/tts',           requireAuth, requireWorkspace, copilotTtsController)
router.get('/voice-session',  requireAuth, requireWorkspace, copilotVoiceSessionController)

export default router
