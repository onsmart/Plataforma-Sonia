import { Router } from 'express'
import { outlookCallback } from '../controllers/outlook-auth.controller'

const router = Router()

// A rota já está prefixada com '/auth/outlook' no index.ts, então aqui é apenas '/callback'
router.get('/callback', outlookCallback)

export default router
