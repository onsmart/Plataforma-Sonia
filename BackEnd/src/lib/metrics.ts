import client from 'prom-client'

const register = new client.Registry()

client.collectDefaultMetrics({
  register,
  labels: {
    app: 'sonia-backend',
    env: process.env.NODE_ENV ?? 'production',
  },
})

export const httpRequestDuration = new client.Histogram({
  name: 'sonia_http_request_duration_seconds',
  help: 'Duração das requisições HTTP em segundos',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
})

export const httpRequestsTotal = new client.Counter({
  name: 'sonia_http_requests_total',
  help: 'Total de requisições HTTP recebidas',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
})

export const httpErrorsTotal = new client.Counter({
  name: 'sonia_http_errors_total',
  help: 'Total de erros HTTP (4xx e 5xx)',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
})

export { register }
