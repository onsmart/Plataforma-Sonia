import { Router } from 'express'
import {
  getGovernanceConfig,
  updateGovernanceConfig,
  postGovernanceTest,
} from '../controllers/governance.controller'
import { requireAuth, requireWorkspace, requireAdmin } from '../../middleware/auth.middleware'

const router = Router()

// ✅ Buscar configuração: qualquer usuário autenticado
router.get('/', requireAuth, requireWorkspace, getGovernanceConfig)

// ✅ Simular teste de regras (jailbreak / anti-alucinação)
router.post('/test', requireAuth, requireWorkspace, postGovernanceTest)

// ✅ SÓ ADMIN: Atualizar configuração
router.put('/', requireAuth, requireWorkspace, requireAdmin, updateGovernanceConfig)

export default router
