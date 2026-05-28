/**
 * Carga leve para staging — uso manual antes do GA.
 *
 *   API_BASE=https://staging.example.com JWT=<token> node scripts/load/staging-api-load.mjs
 */
const API_BASE = (process.env.API_BASE || process.env.BACKEND_PUBLIC_URL || 'http://localhost:3333').replace(/\/$/, '')
const JWT = process.env.JWT || ''
const CONCURRENCY = Number(process.env.CONCURRENCY || 20)
const P95_TARGET_MS = Number(process.env.LOAD_P95_TARGET_MS || 2000)
const ERROR_RATE_TARGET = Number(process.env.LOAD_ERROR_RATE_TARGET || 0.01)

async function timedFetch(path, init = {}) {
  const started = Date.now()
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${JWT}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  return { status: res.status, ms: Date.now() - started }
}

function percentile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[idx]
}

async function runPool(path, count) {
  const latencies = []
  let errors = 0
  const tasks = Array.from({ length: count }, () =>
    timedFetch(path).then((r) => {
      latencies.push(r.ms)
      if (r.status >= 500) errors += 1
      return r
    })
  )
  await Promise.all(tasks)
  return {
    path,
    count,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    errorRate: errors / count,
  }
}

async function main() {
  if (!JWT) {
    console.error('Defina JWT com token de staging.')
    process.exit(1)
  }
  const endpoints = ['/billing/usage', '/agents']
  const report = []
  for (const path of endpoints) {
    report.push(await runPool(path, CONCURRENCY))
  }

  const failed = report.filter(
    (r) => r.p95 > P95_TARGET_MS || r.errorRate > ERROR_RATE_TARGET
  )
  const summary = {
    apiBase: API_BASE,
    concurrency: CONCURRENCY,
    targets: { p95Ms: P95_TARGET_MS, maxErrorRate: ERROR_RATE_TARGET },
    passed: failed.length === 0,
    report,
  }

  console.log(JSON.stringify(summary, null, 2))
  if (!summary.passed) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
