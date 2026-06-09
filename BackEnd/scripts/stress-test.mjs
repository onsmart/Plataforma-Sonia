/**
 * Stress test da plataforma Sonia — Node.js puro (sem dependências externas)
 *
 * O que este script faz:
 *   1. Autentica nas contas de teste (Start + Growth) para obter JWTs reais
 *   2. Executa 4 fases progressivas de carga
 *   3. Mede latência (p50, p95, p99), throughput e taxa de erro por fase
 *   4. Exibe um relatório final apontando onde o servidor começa a degradar
 *
 * Como funciona na prática:
 *   - Cada "usuário virtual" é uma Promise que dispara requisições em loop
 *   - Todas as Promises rodam ao mesmo tempo via Promise.allSettled
 *   - O script mede o tempo de cada requisição individualmente
 *   - Se o servidor travar, as requisições vão expirar (timeout) e aparecer como erros
 *
 * Uso:
 *   node scripts/stress-test.mjs
 *   node scripts/stress-test.mjs --backend http://192.168.15.31:3333
 *   node scripts/stress-test.mjs --fase 2          (pula para a fase 2)
 *   node scripts/stress-test.mjs --sem-ai          (pula fase de IA — economiza créditos Anthropic)
 *
 * Pré-requisito:
 *   Contas test.start@sonia.test e test.growth@sonia.test existindo no Supabase
 */

import https from 'https'
import http  from 'http'
import { performance } from 'perf_hooks'

// ─── Configuração ────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const BACKEND      = getArg('--backend') || 'http://192.168.15.31:3333'
const SUPABASE_URL = 'https://rmfbkyntvkpettjtgaws.supabase.co'
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtZmJreW50dmtwZXR0anRnYXdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MzY0MTEsImV4cCI6MjA4MDUxMjQxMX0.lG3-9XEPOeDbFGkdMKXd0JBHqtVbvNfWGWatmmSuLNE'
const FASE_INICIO  = parseInt(getArg('--fase') || '1', 10)
const SEM_AI       = args.includes('--sem-ai')
const REQ_TIMEOUT  = 15_000  // ms — requisição é considerada falha após 15s

const CONTAS = {
  start:  { email: 'test.start@sonia.test',  senha: 'Sonia@2026Test' },
  growth: { email: 'test.growth@sonia.test', senha: 'Sonia@2026Test' },
}

// ─── Fases do teste ──────────────────────────────────────────────────────────
//
// Cada fase aumenta a pressão. O objetivo não é "passar em tudo", mas sim
// ENCONTRAR O PONTO onde a latência explode ou os erros começam a aparecer.
//
// Fase 1 — Baseline (5 usuários / 20s)
//   Endpoints leves: /billing/usage, /agents (GET)
//   Validar: servidor saudável em condições normais
//
// Fase 2 — Carga normal (20 usuários / 30s)
//   Mix realista de endpoints: billing + agentes + fluxos
//   Validar: latência média < 500ms; erro < 1%
//
// Fase 3 — Pico de carga (50 usuários / 30s)
//   Mesmos endpoints mas com 2.5× mais usuários simultâneos
//   Validar: onde o p99 começa a ultrapassar 2s; onde erros aparecem
//
// Fase 4 — Endpoints de IA (5 usuários / 60s) [pode pular com --sem-ai]
//   POST /agents/chat — chama Anthropic de verdade
//   Validar: quantas chamadas de IA simultâneas o servidor aguenta sem travar
//
// ────────────────────────────────────────────────────────────────────────────

const FASES = [
  {
    numero:      1,
    nome:        'Baseline — endpoints leves',
    usuarios:    5,
    duracaoSecs: 20,
    descricao:   '5 usuários simultâneos por 20s. Validar saúde básica do servidor.',
    buildReqs:   (tokens) => [
      { label: 'GET /billing/usage',  method: 'GET',  path: '/billing/usage',  token: tokens.start },
      { label: 'GET /billing/usage',  method: 'GET',  path: '/billing/usage',  token: tokens.growth },
      { label: 'GET /agents',         method: 'GET',  path: '/agents',         token: tokens.start },
      { label: 'GET /agents',         method: 'GET',  path: '/agents',         token: tokens.growth },
      { label: 'GET /flows',          method: 'GET',  path: '/flows',          token: tokens.growth },
    ],
  },
  {
    numero:      2,
    nome:        'Carga normal — mix de endpoints',
    usuarios:    20,
    duracaoSecs: 30,
    descricao:   '20 usuários simultâneos por 30s. Mix realista de operações.',
    buildReqs:   (tokens) => {
      const pool = [
        { label: 'GET /billing/usage',       method: 'GET',  path: '/billing/usage',       token: tokens.start },
        { label: 'GET /billing/usage',       method: 'GET',  path: '/billing/usage',       token: tokens.growth },
        { label: 'GET /agents',              method: 'GET',  path: '/agents',              token: tokens.start },
        { label: 'GET /agents',              method: 'GET',  path: '/agents',              token: tokens.growth },
        { label: 'GET /flows',               method: 'GET',  path: '/flows',               token: tokens.growth },
        { label: 'GET /crm/integrations',    method: 'GET',  path: '/crm/integrations',    token: tokens.growth },
        { label: 'GET /files (Knowledge)',   method: 'GET',  path: '/files',               token: tokens.growth },
      ]
      // distribui os 20 usuários ciclando pelo pool
      return Array.from({ length: 20 }, (_, i) => pool[i % pool.length])
    },
  },
  {
    numero:      3,
    nome:        'Pico de carga — 50 usuários',
    usuarios:    50,
    duracaoSecs: 30,
    descricao:   '50 usuários simultâneos por 30s. Encontrar o ponto de degradação.',
    buildReqs:   (tokens) => {
      const pool = [
        { label: 'GET /billing/usage',  method: 'GET', path: '/billing/usage',  token: tokens.start },
        { label: 'GET /billing/usage',  method: 'GET', path: '/billing/usage',  token: tokens.growth },
        { label: 'GET /agents',         method: 'GET', path: '/agents',         token: tokens.start },
        { label: 'GET /agents',         method: 'GET', path: '/agents',         token: tokens.growth },
        { label: 'GET /flows',          method: 'GET', path: '/flows',          token: tokens.growth },
      ]
      return Array.from({ length: 50 }, (_, i) => pool[i % pool.length])
    },
  },
  {
    numero:      4,
    nome:        'Carga de IA — POST /agents/chat',
    usuarios:    5,
    duracaoSecs: 60,
    descricao:   '5 usuários simultâneos enviando mensagens reais ao agente por 60s. Testa o gargalo da IA.',
    soAi:        true,
    buildReqs:   (tokens) =>
      Array.from({ length: 5 }, () => ({
        label:  'POST /agents/chat',
        method: 'POST',
        path:   '/agents/chat',
        token:  tokens.growth,
        body:   JSON.stringify({
          message: 'Qual é o horário de atendimento?',
          sessionId: `stress-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        }),
      })),
  },
]

// ─── Utilitários ─────────────────────────────────────────────────────────────

function getArg(flag) {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : null
}

function requisicaoHttp(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed   = new URL(url)
    const lib      = parsed.protocol === 'https:' ? https : http
    const timeout  = options.timeout || REQ_TIMEOUT

    const reqOptions = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + (parsed.search || ''),
      method:   options.method || 'GET',
      headers:  options.headers || {},
      timeout,
    }

    const req = lib.request(reqOptions, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`TIMEOUT ${timeout}ms`))
    })
    req.on('error', reject)

    if (options.body) req.write(options.body)
    req.end()
  })
}

async function autenticar(email, senha) {
  const url  = `${SUPABASE_URL}/auth/v1/token?grant_type=password`
  const body = JSON.stringify({ email, password: senha })
  const resp = await requisicaoHttp(url, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        ANON_KEY,
      'Content-Length': Buffer.byteLength(body),
    },
    body,
    timeout: 10_000,
  })

  const parsed = JSON.parse(resp.body)
  if (!parsed.access_token) throw new Error(`Auth falhou para ${email}: ${JSON.stringify(parsed)}`)
  return parsed.access_token
}

function percentil(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b)
  const idx    = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

function cor(texto, code) {
  return `\x1b[${code}m${texto}\x1b[0m`
}
const verde   = (t) => cor(t, 32)
const amarelo = (t) => cor(t, 33)
const vermelho= (t) => cor(t, 31)
const negrito = (t) => cor(t, 1)
const cinza   = (t) => cor(t, 90)

function avaliarLatencia(ms) {
  if (ms < 300)  return verde(`${ms}ms`)
  if (ms < 1000) return amarelo(`${ms}ms`)
  return vermelho(`${ms}ms`)
}

function avaliarErro(pct) {
  if (pct === 0)   return verde('0%')
  if (pct < 1)     return amarelo(`${pct.toFixed(2)}%`)
  return vermelho(`${pct.toFixed(2)}%`)
}

// ─── Runner de fase ───────────────────────────────────────────────────────────

async function rodarFase(fase, tokens) {
  const reqs       = fase.buildReqs(tokens)
  const duracaoMs  = fase.duracaoSecs * 1000
  const resultados = []

  // cada "usuário virtual" fica em loop fazendo requisições pelo tempo da fase
  const usuarios = reqs.map((req) => {
    return async () => {
      const fim = Date.now() + duracaoMs
      while (Date.now() < fim) {
        const inicio = performance.now()
        try {
          const headers = {
            'Authorization': `Bearer ${req.token}`,
            'Content-Type':  'application/json',
          }
          if (req.body) {
            headers['Content-Length'] = Buffer.byteLength(req.body)
          }

          const resp = await requisicaoHttp(`${BACKEND}${req.path}`, {
            method:  req.method,
            headers,
            body:    req.body,
            timeout: REQ_TIMEOUT,
          })

          const latencia = Math.round(performance.now() - inicio)
          resultados.push({
            label:    req.label,
            latencia,
            status:   resp.status,
            ok:       resp.status >= 200 && resp.status < 500,
          })
        } catch (err) {
          const latencia = Math.round(performance.now() - inicio)
          resultados.push({
            label:    req.label,
            latencia,
            status:   0,
            ok:       false,
            erro:     err.message,
          })
        }
      }
    }
  })

  process.stdout.write(`  Rodando`)
  const intervalo = setInterval(() => process.stdout.write('.'), 2000)

  await Promise.allSettled(usuarios.map((fn) => fn()))

  clearInterval(intervalo)
  process.stdout.write('\n')

  return resultados
}

function imprimirRelatorio(fase, resultados) {
  const total    = resultados.length
  const erros    = resultados.filter((r) => !r.ok)
  const taxaErro = total > 0 ? (erros.length / total) * 100 : 0
  const latencias = resultados.filter((r) => r.ok).map((r) => r.latencia)
  const rps       = total / fase.duracaoSecs

  const p50  = latencias.length ? percentil(latencias, 50)  : 0
  const p95  = latencias.length ? percentil(latencias, 95)  : 0
  const p99  = latencias.length ? percentil(latencias, 99)  : 0
  const pmax = latencias.length ? Math.max(...latencias)    : 0
  const pmedio = latencias.length ? Math.round(latencias.reduce((a, b) => a + b, 0) / latencias.length) : 0

  console.log(`\n  ${negrito('Resultados')}`)
  console.log(`  ─────────────────────────────────────────`)
  console.log(`  Total de requisições : ${negrito(total)}`)
  console.log(`  Throughput           : ${negrito(rps.toFixed(1))} req/s`)
  console.log(`  Taxa de erro         : ${avaliarErro(taxaErro)} (${erros.length}/${total})`)
  console.log(`  Latência média       : ${avaliarLatencia(pmedio)}`)
  console.log(`  Latência p50         : ${avaliarLatencia(p50)}`)
  console.log(`  Latência p95         : ${avaliarLatencia(p95)}`)
  console.log(`  Latência p99         : ${avaliarLatencia(p99)}`)
  console.log(`  Latência máxima      : ${avaliarLatencia(pmax)}`)

  if (erros.length > 0) {
    const porTipo = {}
    for (const e of erros) {
      const key = e.erro || `HTTP ${e.status}`
      porTipo[key] = (porTipo[key] || 0) + 1
    }
    console.log(`\n  ${amarelo('Erros encontrados:')}`)
    for (const [tipo, qtd] of Object.entries(porTipo)) {
      console.log(`    ${vermelho('✗')} ${tipo}: ${qtd}x`)
    }
  }

  // diagnóstico automático
  console.log(`\n  ${negrito('Diagnóstico:')}`)
  if (taxaErro === 0 && p95 < 500) {
    console.log(`  ${verde('✓ Fase OK')} — servidor estável, latência dentro do esperado`)
  } else if (taxaErro === 0 && p95 < 2000) {
    console.log(`  ${amarelo('⚠ Fase marginal')} — sem erros mas p95 acima de 500ms (servidor sob pressão)`)
  } else if (taxaErro > 0 && taxaErro < 5) {
    console.log(`  ${amarelo('⚠ Atenção')} — erros esporádicos (< 5%). Servidor degradando mas ainda funcionando`)
  } else if (taxaErro >= 5) {
    console.log(`  ${vermelho('✗ Fase crítica')} — taxa de erro >= 5%. Servidor não aguenta esta carga`)
  } else {
    console.log(`  ${amarelo('⚠ Revisar')} — latência alta mas sem erros. Provável gargalo de CPU ou rede`)
  }

  return { total, erros: erros.length, taxaErro, p50, p95, p99, pmax, rps }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(negrito('\n════════════════════════════════════════════════'))
  console.log(negrito('  Stress Test — Plataforma Sonia'))
  console.log(negrito('════════════════════════════════════════════════'))
  console.log(`  Backend  : ${BACKEND}`)
  console.log(`  Fases    : ${FASE_INICIO}–${SEM_AI ? 3 : 4}`)
  console.log(`  Timeout  : ${REQ_TIMEOUT / 1000}s por requisição\n`)

  // ─── Autenticação ────────────────────────────────────────────────────────
  console.log(cinza('  Autenticando nas contas de teste...'))
  let tokens
  try {
    const [tokenStart, tokenGrowth] = await Promise.all([
      autenticar(CONTAS.start.email,  CONTAS.start.senha),
      autenticar(CONTAS.growth.email, CONTAS.growth.senha),
    ])
    tokens = { start: tokenStart, growth: tokenGrowth }
    console.log(verde('  ✓ Tokens obtidos\n'))
  } catch (err) {
    console.error(vermelho(`  ✗ Falha na autenticação: ${err.message}`))
    console.error('  Verifique se o Supabase está acessível e as contas existem.')
    process.exit(1)
  }

  // ─── Fases ───────────────────────────────────────────────────────────────
  const resumo = []

  for (const fase of FASES) {
    if (fase.numero < FASE_INICIO) continue
    if (fase.soAi && SEM_AI) {
      console.log(cinza(`\n  Fase ${fase.numero} pulada (--sem-ai)\n`))
      continue
    }

    console.log(negrito(`\n┌─ Fase ${fase.numero}: ${fase.nome}`))
    console.log(`│  ${fase.descricao}`)
    console.log(`│  ${fase.usuarios} usuário(s) × ${fase.duracaoSecs}s`)
    console.log('└' + '─'.repeat(60))

    const resultados = await rodarFase(fase, tokens)
    const stats = imprimirRelatorio(fase, resultados)
    resumo.push({ fase: fase.nome, ...stats })

    if (fase.numero < FASES.length && !SEM_AI) {
      console.log(cinza('\n  Aguardando 5s antes da próxima fase...'))
      await new Promise((r) => setTimeout(r, 5000))
    }
  }

  // ─── Resumo final ────────────────────────────────────────────────────────
  console.log(negrito('\n\n════════════════════════════════════════════════'))
  console.log(negrito('  Resumo Geral'))
  console.log(negrito('════════════════════════════════════════════════'))
  console.log(`${'Fase'.padEnd(45)} ${'req/s'.padStart(7)} ${'p95'.padStart(8)} ${'p99'.padStart(8)} ${'Erro%'.padStart(7)}`)
  console.log('─'.repeat(80))
  for (const s of resumo) {
    const erroStr = s.taxaErro === 0 ? verde('   0%') : s.taxaErro < 5 ? amarelo(`${s.taxaErro.toFixed(1)}%`.padStart(5)) : vermelho(`${s.taxaErro.toFixed(1)}%`.padStart(5))
    console.log(
      `${s.fase.slice(0, 44).padEnd(45)} ${s.rps.toFixed(1).padStart(7)} ${avaliarLatencia(s.p95).padStart(15)} ${avaliarLatencia(s.p99).padStart(15)} ${erroStr}`
    )
  }

  console.log(negrito('\n════════════════════════════════════════════════'))
  console.log('  Para monitorar em tempo real durante o teste:')
  console.log('  → Grafana: http://192.168.15.31:3030')
  console.log('  → Dashboard: "Sonia Backend" → CPU, memória, req/s, latência')
  console.log(negrito('════════════════════════════════════════════════\n'))
}

main().catch((err) => {
  console.error(vermelho(`\nErro fatal: ${err.message}`))
  process.exit(1)
})
