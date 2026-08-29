import Stripe from 'stripe'

function stripeMode(key) {
  const value = String(key || '').trim()
  if (value.startsWith('sk_test_')) return 'test'
  if (value.startsWith('sk_live_')) return 'live'
  return value ? 'unknown' : 'missing'
}

export async function runStripeRuntimeProbe(config) {
  const expectedMode = 'test'
  const mode = stripeMode(config.stripe.secretKey)
  const failures = []
  const checks = {
    environment: config.env,
    expectedMode,
    mode,
    webhookSecretConfigured: Boolean(config.stripe.webhookSecret)
  }

  if (!config.isStaging) failures.push('runtime probe is staging-only')
  if (mode !== expectedMode) failures.push(`expected Stripe ${expectedMode} key, got ${mode}`)
  if (!config.stripe.webhookSecret) failures.push('STRIPE_WEBHOOK_SECRET missing')
  if (!config.stripe.priceBasic) failures.push('STRIPE_PRICE_BASIC missing')
  if (!config.stripe.pricePremium) failures.push('STRIPE_PRICE_PREMIUM missing')

  if (!failures.length) {
    const stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2025-06-30.basil',
      maxNetworkRetries: 2,
      timeout: 20000
    })

    const account = await stripe.accounts.retrieve()
    checks.accountReachable = Boolean(account?.id)

    for (const [name, id, expectedAmount] of [
      ['basic', config.stripe.priceBasic, 999],
      ['premium', config.stripe.pricePremium, 1499]
    ]) {
      const price = await stripe.prices.retrieve(id)
      checks[name] = {
        reachable: true,
        active: price.active,
        currency: price.currency,
        unitAmount: price.unit_amount,
        recurringInterval: price.recurring?.interval || null
      }

      if (!price.active) failures.push(`${name} price inactive`)
      if (price.currency !== 'eur') failures.push(`${name} price must be EUR`)
      if (price.unit_amount !== expectedAmount) failures.push(`${name} amount mismatch`)
      if (price.type !== 'recurring' || price.recurring?.interval !== 'month') {
        failures.push(`${name} price must be recurring monthly`)
      }
    }

    const wanted = `${config.appUrl}/api/webhooks/stripe`
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
    const endpoint = endpoints.data.find(item => item.url === wanted)

    checks.webhook = {
      wanted,
      found: Boolean(endpoint)
    }

    if (!endpoint) failures.push(`webhook endpoint not found: ${wanted}`)
  }

  const passed = failures.length === 0
  const report = {
    marker: 'RC3-B3-RUNTIME-PROBE',
    version: '7.0.0-rc.2',
    checkedAt: new Date().toISOString(),
    passed,
    checks,
    failures
  }

  console.log(`[RC3-B3] Stripe runtime probe ${passed ? 'PASS' : 'FAIL'}`)
  console.log(`[RC3-B3] ${JSON.stringify(report)}`)

  if (!passed) {
    throw new Error(`RC3-B3 Stripe runtime probe failed: ${failures.join('; ')}`)
  }

  return report
}