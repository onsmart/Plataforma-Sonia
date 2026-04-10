import { Router } from 'express'
import {
  getGovernanceConfig,
  updateGovernanceConfig,
  postGovernanceTest,
} from '../controllers/governance.controller'
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware'

const router = Router()

// ✅ Buscar configuração: qualquer usuário autenticado
router.get('/', requireAuth, getGovernanceConfig)

// ✅ Simular teste de regras (jailbreak / anti-alucinação)
router.post('/test', requireAuth, postGovernanceTest)

// ✅ SÓ ADMIN: Atualizar configuração
router.put('/', requireAuth, requireAdmin, updateGovernanceConfig)

export default router
