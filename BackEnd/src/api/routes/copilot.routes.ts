import { Router } from 'express'
import { copilotChatController, copilotTtsController } from '../controllers/copilot.controller'
import { requireAuth, requireWorkspace } from '../../middleware/auth.middleware'

const router = Router()

router.post('/chat', requireAuth, requireWorkspace, copilotChatController)
router.post('/tts',  requireAuth, requireWorkspace, copilotTtsController)

export default router
