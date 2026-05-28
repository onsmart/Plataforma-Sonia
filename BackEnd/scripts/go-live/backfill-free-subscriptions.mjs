/**
 * Backfill data-only: cria tb_subscriptions free/inactive para empresas sem linha.
 * Não substitui migrations SQL (CHECK/trigger) — rode as migrations no Supabase antes.
 *
 *   cd BackEnd
 *   node scripts/go-live/backfill-free-subscriptions.mjs
 *   node scripts/go-live/backfill-free-subscriptions.mjs --dry-run
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env') })

const dryRun = process.argv.includes('--dry-run')
const url = process.env.SUPABASE_URL?.trim()
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no BackEnd/.env')
  process.exit(1)
}

const supabase = createClient(url, key)

async function main() {
  const { data: companies, error: cErr } = await supabase.from('tb_companies').select('id')
  if (cErr) throw cErr

  const { data: subs, error: sErr } = await supabase.from('tb_subscriptions').select('companies_id')
  if (sErr) throw sErr

  const hasSub = new Set((subs || []).map((s) => s.companies_id))
  const missing = (companies || []).filter((c) => !hasSub.has(c.id))

  if (missing.length === 0) {
    console.log(JSON.stringify({ ok: true, inserted: 0, message: 'Nenhuma empresa sem assinatura' }))
    return
  }

  const payload = missing.map((c) => ({
    companies_id: c.id,
    plan: 'free',
    status: 'inactive',
    stripe_customer_id: `free_local_${c.id}`,
    stripe_subscription_id: `free_local_${c.id}`,
  }))

  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, wouldInsert: payload.length, companies: payload.map((p) => p.companies_id) }))
    return
  }

  const { data, error } = await supabase.from('tb_subscriptions').insert(payload).select('id, companies_id, plan, status')
  if (error) {
    console.error('Falha no insert (plan free pode não estar no CHECK — aplique MIGRATION_FREE_PLAN_DEFAULT.sql):', error.message)
    process.exit(1)
  }

  console.log(JSON.stringify({ ok: true, inserted: data?.length ?? 0, rows: data }))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
