import { Router } from 'express'
import { listTemplates, createTemplate, updateTemplate, deleteTemplate } from '../controllers/templates.controller'
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware'

const router = Router()

// ✅ Listar templates (qualquer usuário autenticado - mostra da empresa + globais)
router.get('/', requireAuth, listTemplates)

// ✅ SÓ ADMIN: Criar template
router.post('/', requireAuth, requireAdmin, createTemplate)

// ✅ SÓ ADMIN: Atualizar template
router.put('/:id', requireAuth, requireAdmin, updateTemplate)

// ✅ SÓ ADMIN: Deletar template
router.delete('/:id', requireAuth, requireAdmin, deleteTemplate)

export default router
