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
import { requireAuth, requireWorkspace, requireAdmin } from '../../middleware/auth.middleware'
import {
  createAgentVoicePreviewController,
  generateAgentVoiceResponseController,
  getAgentVoiceProfileController,
  updateAgentVoiceProfileController,
} from '../../modules/voice/controllers/voice.controller'

const router = Router()

router.post('/chat', requireAuth, requireWorkspace, agentChat)

// ✅ Rotas ADMINISTRATIVAS (com auth obrigatória)
router.get('/', requireAuth, requireWorkspace, listAgents)
router.get('/:id/skills', requireAuth, requireWorkspace, getAgentSkillsForRequest)
router.get('/:id/setup-health', requireAuth, requireWorkspace, getAgentSetupHealthController)

// ✅ SÓ ADMIN: Criar agente
router.post('/create', requireAuth, requireWorkspace, requireAdmin, createAgent)

// ✅ SÓ ADMIN: Atualizar agente
router.put('/:id', requireAuth, requireWorkspace, requireAdmin, updateAgent)
router.get('/:agentId/voice-profile', requireAuth, requireWorkspace, requireAdmin, getAgentVoiceProfileController)
router.put('/:agentId/voice-profile', requireAuth, requireWorkspace, requireAdmin, updateAgentVoiceProfileController)
router.post('/:agentId/voice-preview', requireAuth, requireWorkspace, requireAdmin, createAgentVoicePreviewController)
router.post('/:agentId/generate-voice-response', requireAuth, requireWorkspace, requireAdmin, generateAgentVoiceResponseController)

// ✅ SÓ ADMIN: Excluir agente permanentemente
router.delete('/:id', requireAuth, requireWorkspace, requireAdmin, deleteAgent)

// ✅ SÓ ADMIN: Ativar agente
router.put('/:id/activate', requireAuth, requireWorkspace, requireAdmin, activateAgent)

// ✅ SÓ ADMIN: Atribuir agente a mensagem
router.put('/assign', requireAuth, requireWorkspace, requireAdmin, assignAgent)

// ✅ SÓ ADMIN: Ver e aprovar/rejeitar decisões
router.post('/decisions/:id/approve', requireAuth, requireWorkspace, requireAdmin, approveDecision)
router.post('/decisions/:id/reject', requireAuth, requireWorkspace, requireAdmin, rejectDecision)

export default router
