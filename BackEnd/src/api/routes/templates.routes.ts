import { Router } from 'express'
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getCalendlyTestPack,
  getFlexibleSchedulingPack,
} from '../controllers/templates.controller'
import { requireAuth, requireWorkspace, requireAdmin } from '../../middleware/auth.middleware'

const router = Router()

// ✅ Listar templates (qualquer usuário autenticado - mostra da empresa + globais)
router.get('/', requireAuth, requireWorkspace, listTemplates)

// Pacote de teste Calendly (template + RAG + extra_features sugerido)
router.get('/packs/calendly-test', requireAuth, requireWorkspace, getCalendlyTestPack)
router.get('/packs/flexible-scheduling', requireAuth, requireWorkspace, getFlexibleSchedulingPack)

// ✅ SÓ ADMIN: Criar template
router.post('/', requireAuth, requireWorkspace, requireAdmin, createTemplate)

// ✅ SÓ ADMIN: Atualizar template
router.put('/:id', requireAuth, requireWorkspace, requireAdmin, updateTemplate)

// ✅ SÓ ADMIN: Deletar template
router.delete('/:id', requireAuth, requireWorkspace, requireAdmin, deleteTemplate)

export default router
