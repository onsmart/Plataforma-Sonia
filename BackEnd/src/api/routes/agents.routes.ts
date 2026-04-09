import { Router } from 'express'
import {
  listAgents,
  agentChat,
  approveDecision,
  rejectDecision,
  createAgent,
  activateAgent,
  updateAgent,
  assignAgent,
  deleteAgent,
} from '../controllers/agents.controller'
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware'

const router = Router()

// ✅ Rotas PÚBLICAS (sem auth) - Chat é público
router.post('/chat', agentChat)

// ✅ Rotas ADMINISTRATIVAS (com auth obrigatória)
router.get('/', requireAuth, listAgents)

// ✅ SÓ ADMIN: Criar agente
router.post('/create', requireAuth, requireAdmin, createAgent)

// ✅ SÓ ADMIN: Atualizar agente
router.put('/:id', requireAuth, requireAdmin, updateAgent)

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
