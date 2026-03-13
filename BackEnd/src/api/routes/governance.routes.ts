import { Router } from 'express'
import { getGovernanceConfig, updateGovernanceConfig } from '../controllers/governance.controller'
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware'

const router = Router()

// ✅ Buscar configuração: qualquer usuário autenticado
router.get('/', requireAuth, getGovernanceConfig)

// ✅ SÓ ADMIN: Atualizar configuração
router.put('/', requireAuth, requireAdmin, updateGovernanceConfig)

export default router
