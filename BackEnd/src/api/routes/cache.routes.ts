import { Router } from 'express'
import { clearCache, getCacheStatus } from '../controllers/cache.controller'
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware'

const router = Router()
const cacheAdminEnabled = process.env.ENABLE_CACHE_ADMIN !== 'false'

function cacheAdminDisabled(_req: import('express').Request, res: import('express').Response) {
  return res.status(404).json({ error: 'Not found' })
}

const cacheGuard = cacheAdminEnabled
  ? [requireAuth, requireAdmin]
  : [cacheAdminDisabled]

// POST /cache/clear → limpa o cache do Supabase (admin only)
router.post('/clear', ...cacheGuard, clearCache)

// GET /cache/status → verifica o status do cache (admin only)
router.get('/status', ...cacheGuard, getCacheStatus)

export default router
