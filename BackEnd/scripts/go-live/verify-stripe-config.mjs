/**
 * Verifica variáveis Stripe/PLAN_DISPLAY para MVP Receptivo (sem expor segredos).
 *
 *   cd BackEnd && node scripts/go-live/verify-stripe-config.mjs
 */
import Stripe from 'stripe'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env') })

function pick(...keys) {
  for (const k of keys) {
    const v = process.env[k]?.trim()
    if (v) return { key: k, value: v }
  }
  return null
}

const recStart = pick(
  'STRIPE_PRICE_REC_START',
  'STRIPE_PRICE_REC_START_MONTHLY',
  'STRIPE_PRICE_PRO_MONTHLY',
  'STRIPE_PRICE_PRO'
)
const recGrowth = pick(
  'STRIPE_PRICE_REC_GROWTH',
  'STRIPE_PRICE_REC_GROWTH_MONTHLY',
  'STRIPE_PRICE_PLUS_MONTHLY',
  'STRIPE_PRICE_PLUS'
)

const report = {
  at: new Date().toISOString(),
  stripeSecretConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
  webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
  recStartPrice: recStart ? { fromEnv: recStart.key, priceIdPrefix: recStart.value.slice(0, 12) + '…' } : null,
  recGrowthPrice: recGrowth ? { fromEnv: recGrowth.key, priceIdPrefix: recGrowth.value.slice(0, 12) + '…' } : null,
  planDisplayStart: process.env.PLAN_DISPLAY_REC_START || process.env.PLAN_DISPLAY_REC_START_MONTHLY || null,
  planDisplayGrowth: process.env.PLAN_DISPLAY_REC_GROWTH || process.env.PLAN_DISPLAY_REC_GROWTH_MONTHLY || null,
  stripePricesValid: null,
  errors: [],
}

if (!report.stripeSecretConfigured) report.errors.push('STRIPE_SECRET_KEY ausente')
if (!report.webhookSecretConfigured) report.errors.push('STRIPE_WEBHOOK_SECRET ausente')
if (!recStart) report.errors.push('Preço REC Start não configurado (STRIPE_PRICE_REC_START ou legado PRO)')
if (!recGrowth) report.errors.push('Preço REC Growth não configurado (STRIPE_PRICE_REC_GROWTH ou legado PLUS)')

if (process.env.STRIPE_SECRET_KEY?.trim() && recStart?.value) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY.trim(), { apiVersion: '2026-02-25.clover' })
    const price = await stripe.prices.retrieve(recStart.value)
    report.stripePricesValid = {
      recStart: { active: price.active, recurring: price.recurring?.interval ?? null },
    }
    if (recGrowth?.value) {
      const p2 = await stripe.prices.retrieve(recGrowth.value)
      report.stripePricesValid.recGrowth = { active: p2.active, recurring: p2.recurring?.interval ?? null }
    }
  } catch (e) {
    report.errors.push(`Stripe API: ${e.message}`)
  }
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.errors.length ? 1 : 0)
