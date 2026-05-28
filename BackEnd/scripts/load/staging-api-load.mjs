/**
 * Carga leve para staging — uso manual antes do GA.
 *
 *   API_BASE=https://staging.example.com JWT=<token> node scripts/load/staging-api-load.mjs
 */
const API_BASE = (process.env.API_BASE || 'http://localhost:3001').replace(/\/$/, '')
const JWT = process.env.JWT || ''
const CONCURRENCY = Number(process.env.CONCURRENCY || 20)

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
  console.log(JSON.stringify({ apiBase: API_BASE, concurrency: CONCURRENCY, report }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
