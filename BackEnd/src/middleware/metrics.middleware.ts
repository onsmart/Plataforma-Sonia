import { Request, Response, NextFunction } from 'express'
import { httpRequestDuration, httpRequestsTotal, httpErrorsTotal } from '../lib/metrics'

// Normaliza rotas parametrizadas para evitar cardinalidade explosiva no Prometheus.
// Ex: /agents/550e8400-e29b-41d4-a716-446655440000/chat → /agents/:id/chat
function normalizeRoute(req: Request): string {
  if (req.route) {
    return (req.baseUrl + req.route.path)
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id')
      || '/'
  }
  // Rota não encontrada (404) — usa apenas o primeiro segmento para evitar alta cardinalidade
  const firstSegment = req.path.split('/')[1]
  return firstSegment ? `/_other/${firstSegment}` : '/_other'
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startNs = process.hrtime.bigint()

  res.on('finish', () => {
    const route = normalizeRoute(req)
    const method = req.method
    const statusCode = String(res.statusCode)
    const durationSeconds = Number(process.hrtime.bigint() - startNs) / 1e9

    httpRequestDuration.observe({ method, route, status_code: statusCode }, durationSeconds)
    httpRequestsTotal.inc({ method, route, status_code: statusCode })

    if (res.statusCode >= 400) {
      httpErrorsTotal.inc({ method, route, status_code: statusCode })
    }
  })

  next()
}
