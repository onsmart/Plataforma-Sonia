import { Request, Response } from 'express'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import { buildDeletionBlockers } from '../../services/resources/deletion-blockers.service'
import logger from '../../lib/logger'

/**
 * GET /deletion-blockers
 * Mapas de dependências para UI de exclusão em lote (admin).
 */
export async function getDeletionBlockers(req: Request, res: Response) {
  try {
    const email = req.user?.email
    if (!email) {
      return res.status(401).json({
        error: 'Email é obrigatório',
        details: 'Token de autenticação inválido',
      })
    }

    const companiesId = await getCompanyIdByEmail(email)
    if (!companiesId) {
      return res.status(403).json({
        error: 'Empresa não encontrada',
        details: 'Usuário não pertence a nenhuma empresa',
      })
    }

    const payload = await buildDeletionBlockers(companiesId)
    return res.json(payload)
  } catch (error: unknown) {
    logger.error('[getDeletionBlockers]', error)
    return res.status(500).json({
      error: 'Erro ao montar dependências',
      details: error instanceof Error ? error.message : String(error),
    })
  }
}
