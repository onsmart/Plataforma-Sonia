import type { NextFunction, Request, Response } from 'express'
import logger from '../lib/logger'

const isProduction = process.env.NODE_ENV === 'production'

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Rota não encontrada', code: 'NOT_FOUND' })
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const statusCode =
    err && typeof err === 'object' && 'statusCode' in err
      ? Number((err as { statusCode?: number }).statusCode) || 500
      : 500

  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : 'Erro interno do servidor'

  if (statusCode >= 500) {
    logger.error('[errorHandler]', err)
  }

  if (isProduction) {
    return res.status(statusCode).json({
      error: statusCode >= 500 ? 'Erro interno do servidor' : message,
      code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
    })
  }

  return res.status(statusCode).json({
    error: message,
    code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
    details: err instanceof Error ? err.stack : undefined,
  })
}
