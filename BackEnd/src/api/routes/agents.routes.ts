import { Router } from 'express'
import {
  listAgents,
  getAgentSkillsForRequest,
  agentChat,
  approveDecision,
  rejectDecision,
  createAgent,
  activateAgent,
  updateAgent,
  assignAgent,
  deleteAgent,
  getAgentSetupHealthController,
} from '../controllers/agents.controller'
import { requireAuth, requireWorkspace, requirePermission } from '../../middleware/auth.middleware'
import { agentChatRateLimiter } from '../../middleware/rate-limit.middleware'
import {
  createAgentVoicePreviewController,
  generateAgentVoiceResponseController,
  getAgentVoiceProfileController,
  updateAgentVoiceProfileController,
} from '../../modules/voice/controllers/voice.controller'

const router = Router()

router.post('/chat', requireAuth, requireWorkspace, agentChatRateLimiter, requirePermission('basic.read'), agentChat)

router.get('/', requireAuth, requireWorkspace, requirePermission('basic.read'), listAgents)
router.get('/:id/skills', requireAuth, requireWorkspace, requirePermission('basic.read'), getAgentSkillsForRequest)
router.get('/:id/setup-health', requireAuth, requireWorkspace, requirePermission('basic.read'), getAgentSetupHealthController)

router.post('/create', requireAuth, requireWorkspace, requirePermission('basic.write'), createAgent)
router.put('/:id', requireAuth, requireWorkspace, requirePermission('basic.write'), updateAgent)
router.get('/:agentId/voice-profile', requireAuth, requireWorkspace, requirePermission('basic.write'), getAgentVoiceProfileController)
router.put('/:agentId/voice-profile', requireAuth, requireWorkspace, requirePermission('basic.write'), updateAgentVoiceProfileController)
router.post('/:agentId/voice-preview', requireAuth, requireWorkspace, requirePermission('basic.write'), createAgentVoicePreviewController)
router.post('/:agentId/generate-voice-response', requireAuth, requireWorkspace, requirePermission('basic.write'), generateAgentVoiceResponseController)
router.delete('/:id', requireAuth, requireWorkspace, requirePermission('basic.write'), deleteAgent)
router.put('/:id/activate', requireAuth, requireWorkspace, requirePermission('basic.write'), activateAgent)
router.put('/assign', requireAuth, requireWorkspace, requirePermission('basic.write'), assignAgent)
router.post('/decisions/:id/approve', requireAuth, requireWorkspace, requirePermission('basic.write'), approveDecision)
router.post('/decisions/:id/reject', requireAuth, requireWorkspace, requirePermission('basic.write'), rejectDecision)

export default router
