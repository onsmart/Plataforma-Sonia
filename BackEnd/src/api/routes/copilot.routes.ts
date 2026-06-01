import { Router } from 'express'
import { copilotChatController } from '../controllers/copilot.controller'
import { requireAuth, requireWorkspace } from '../../middleware/auth.middleware'

const router = Router()

router.post('/chat', requireAuth, requireWorkspace, copilotChatController)

export default router
