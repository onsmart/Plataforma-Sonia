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
  provisionOnsmartDemoController,
} from '../controllers/agents.controller'
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware'
import {
  createAgentVoicePreviewController,
  generateAgentVoiceResponseController,
  getAgentVoiceProfileController,
  updateAgentVoiceProfileController,
} from '../../modules/voice/controllers/voice.controller'

const router = Router()

// ✅ Rotas PÚBLICAS (sem auth) - Chat é público
router.post('/chat', agentChat)

// ✅ Rotas ADMINISTRATIVAS (com auth obrigatória)
router.get('/', requireAuth, listAgents)
router.get('/:id/skills', requireAuth, getAgentSkillsForRequest)

// ✅ SÓ ADMIN: Criar agente
router.post('/create', requireAuth, requireAdmin, createAgent)

router.post('/provision-onsmart-demo', requireAuth, requireAdmin, provisionOnsmartDemoController)

// ✅ SÓ ADMIN: Atualizar agente
router.put('/:id', requireAuth, requireAdmin, updateAgent)
router.get('/:agentId/voice-profile', requireAuth, requireAdmin, getAgentVoiceProfileController)
router.put('/:agentId/voice-profile', requireAuth, requireAdmin, updateAgentVoiceProfileController)
router.post('/:agentId/voice-preview', requireAuth, requireAdmin, createAgentVoicePreviewController)
router.post('/:agentId/generate-voice-response', requireAuth, requireAdmin, generateAgentVoiceResponseController)

// ✅ SÓ ADMIN: Excluir agente permanentemente
router.delete('/:id', requireAuth, requireAdmin, deleteAgent)

// ✅ SÓ ADMIN: Ativar agente
router.put('/:id/activate', requireAuth, requireAdmin, activateAgent)

// ✅ SÓ ADMIN: Atribuir agente a mensagem
router.put('/assign', requireAuth, requireAdmin, assignAgent)

// ✅ SÓ ADMIN: Ver e aprovar/rejeitar decisões
router.post('/decisions/:id/approve', requireAuth, requireAdmin, approveDecision)
router.post('/decisions/:id/reject', requireAuth, requireAdmin, rejectDecision)

export default router
