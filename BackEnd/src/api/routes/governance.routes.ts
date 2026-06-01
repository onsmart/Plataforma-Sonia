import { Router } from 'express'
import {
  getGovernanceConfig,
  updateGovernanceConfig,
  postGovernanceTest,
} from '../controllers/governance.controller'
import { requireAuth, requireWorkspace, requirePermission } from '../../middleware/auth.middleware'

const router = Router()

router.get('/', requireAuth, requireWorkspace, requirePermission('basic.read'), getGovernanceConfig)
router.post('/test', requireAuth, requireWorkspace, requirePermission('basic.read'), postGovernanceTest)
router.put('/', requireAuth, requireWorkspace, requirePermission('basic.write'), updateGovernanceConfig)

export default router
