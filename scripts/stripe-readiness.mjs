import fs from 'node:fs'
import Stripe from 'stripe'

if (process.loadEnvFile && fs.existsSync('.env')) process.loadEnvFile('.env')

const key = process.env.STRIPE_SECRET_KEY || ''
const appUrl = (process.env.APP_URL || '').replace(/\/$/, '')
const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase()
const expectedMode = nodeEnv === 'production' ? 'live' : nodeEnv === 'staging' ? 'test' : null
const actualMode = key.startsWith('sk_live_') ? 'live' : key.startsWith('sk_test_') ? 'test' : 'unknown'
const failures = []
const checks = {}

if (!key) failures.push('STRIPE_SECRET_KEY missing')
if (!process.env.STRIPE_WEBHOOK_SECRET) failures.push('STRIPE_WEBHOOK_SECRET missing')
if (!process.env.STRIPE_PRICE_BASIC) failures.push('STRIPE_PRICE_BASIC missing')
if (!process.env.STRIPE_PRICE_PREMIUM) failures.push('STRIPE_PRICE_PREMIUM missing')
if (expectedMode && actualMode !== expectedMode) failures.push(`Stripe mode mismatch: NODE_ENV=${nodeEnv} requires ${expectedMode} key, got ${actualMode}`)

if (!failures.length) {
  try {
    const stripe = new Stripe(key)
    const account = await stripe.accounts.retrieve()
    checks.account = { id: account.id, mode: actualMode }

    for (const [name, id, amount] of [
      ['basic', process.env.STRIPE_PRICE_BASIC, 999],
      ['premium', process.env.STRIPE_PRICE_PREMIUM, 1499]
    ]) {
      const price = await stripe.prices.retrieve(id)
      checks[name] = {
        id: price.id,
        active: price.active,
        currency: price.currency,
        unit_amount: price.unit_amount,
        type: price.type,
        recurring: price.recurring?.interval || null
      }
      if (!price.active) failures.push(`${name} Stripe price is inactive`)
      if (price.currency !== 'eur') failures.push(`${name} Stripe price must use EUR`)
      if (price.unit_amount !== amount) failures.push(`${name} Stripe price amount mismatch: expected ${amount}, got ${price.unit_amount}`)
      if (price.type !== 'recurring' || price.recurring?.interval !== 'month') failures.push(`${name} Stripe price must be recurring monthly`)
    }

    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
    const wanted = `${appUrl}/api/webhooks/stripe`
    const endpoint = endpoints.data.find(x => x.url === wanted)
    checks.webhook = { wanted, found: Boolean(endpoint), enabled_events: endpoint?.enabled_events || [] }
    if (!endpoint) failures.push(`Stripe webhook endpoint not found in ${actualMode} mode: ${wanted}`)
  } catch (e) {
    failures.push(`Stripe API check failed: ${e.message}`)
  }
}

const report = {
  version: '7.0.0-rc.2',
  checkedAt: new Date().toISOString(),
  nodeEnv,
  expectedMode,
  mode: actualMode,
  checks,
  failures,
  passed: failures.length === 0
}

fs.mkdirSync('reports', { recursive: true })
fs.writeFileSync('reports/stripe-readiness.json', JSON.stringify(report, null, 2))
console.log(`MELEO RC3-B3 Stripe environment readiness: ${report.passed ? 'PASS' : 'FAIL'}`)
if (failures.length) console.error(failures.join('\n'))
process.exitCode = report.passed ? 0 : 1
