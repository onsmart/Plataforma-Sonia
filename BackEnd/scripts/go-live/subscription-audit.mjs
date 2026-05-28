/**
 * Auditoria read-only de tb_subscriptions (go-live MVP Receptivo).
 *
 *   cd BackEnd
 *   node scripts/go-live/subscription-audit.mjs
 *
 * Requer SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env (dotenv carregado pelo cwd).
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env') })

const url = process.env.SUPABASE_URL?.trim()
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no BackEnd/.env')
  process.exit(1)
}

const supabase = createClient(url, key)

const ALLOWED_PLANS = new Set([
  'free',
  'rec_start',
  'rec_growth',
  'rec_enterprise',
  'com_start',
  'com_growth',
  'com_enterprise',
])

async function main() {
  const { data: rows, error } = await supabase
    .from('tb_subscriptions')
    .select('plan, status, companies_id, stripe_subscription_id')

  if (error) {
    console.error('Erro ao ler tb_subscriptions:', error.message)
    process.exit(1)
  }

  const byPlanStatus = new Map()
  const activePaid = []
  const invalidPlans = new Set()

  for (const row of rows || []) {
    const key = `${row.plan}\t${row.status}`
    byPlanStatus.set(key, (byPlanStatus.get(key) || 0) + 1)
    if (row.status === 'active' || row.status === 'trialing') {
      activePaid.push({
        companies_id: row.companies_id,
        plan: row.plan,
        status: row.status,
        has_stripe_sub: Boolean(row.stripe_subscription_id?.trim()),
      })
    }
    if (!ALLOWED_PLANS.has(row.plan)) {
      invalidPlans.add(row.plan)
    }
  }

  const { data: companies } = await supabase.from('tb_companies').select('id')
  const companyIds = new Set((companies || []).map((c) => c.id))
  const subCompanyIds = new Set((rows || []).map((r) => r.companies_id))
  const orphanCompanies = [...companyIds].filter((id) => !subCompanyIds.has(id))

  const grouped = [...byPlanStatus.entries()]
    .map(([k, n]) => {
      const [plan, status] = k.split('\t')
      return { plan, status, n }
    })
    .sort((a, b) => a.plan.localeCompare(b.plan) || a.status.localeCompare(b.status))

  const report = {
    at: new Date().toISOString(),
    supabaseHost: new URL(url).hostname,
    subscriptionCount: rows?.length ?? 0,
    byPlanStatus: grouped,
    activeOrTrialing: activePaid,
    invalidPlans: [...invalidPlans],
    companiesWithoutSubscription: orphanCompanies.length,
    orphanCompanyIdsSample: orphanCompanies.slice(0, 10),
    migrationsLikelyApplied:
      invalidPlans.size === 0 && grouped.some((g) => g.plan === 'free'),
  }

  console.log(JSON.stringify(report, null, 2))

  if (invalidPlans.size > 0) {
    process.exitCode = 2
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
