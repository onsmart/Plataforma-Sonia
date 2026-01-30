import { Router } from 'express'
import { clearCache, getCacheStatus } from '../controllers/cache.controller'

const router = Router()

// POST /cache/clear → limpa o cache do Supabase
router.post('/clear', clearCache)

// GET /cache/status → verifica o status do cache
router.get('/status', getCacheStatus)

export default router
