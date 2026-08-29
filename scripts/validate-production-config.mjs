const failures = []

const productionForbidden = {
  E2E_MODE: ['1', 'true', 'yes', 'on'],
  SEED_DEMO: ['1', 'true', 'yes', 'on'],
  DEMO_AUTH: ['1', 'true', 'yes', 'on'],
  DEMO_CHECKOUT: ['1', 'true', 'yes', 'on'],
  PAYMENTS_MODE: ['demo']
}

function normalized(value) {
  return String(value ?? '').trim().toLowerCase()
}

function stripeKeyMode(value) {
  const key = String(value || '').trim()
  if (key.startsWith('sk_live_')) return 'live'
  if (key.startsWith('sk_test_')) return 'test'
  return key ? 'unknown' : 'missing'
}

const nodeEnv = normalized(process.env.NODE_ENV)
const paymentsMode = normalized(process.env.PAYMENTS_MODE)
const stripeMode = stripeKeyMode(process.env.STRIPE_SECRET_KEY)

if (nodeEnv === 'production') {
  const adminTotpSecret =
    String(process.env.ADMIN_TOTP_SECRET || '').trim()

  if (adminTotpSecret.length < 16) {
    failures.push(
      'ADMIN_TOTP_SECRET is required in production and must be at least 16 characters'
    )
  }

  for (const [key, forbidden] of Object.entries(productionForbidden)) {
    const value = normalized(process.env[key])

    if (forbidden.includes(value)) {
      failures.push(`${key}=${process.env[key]} is forbidden in production`)
    }
  }

  if (stripeMode !== 'live') failures.push('STRIPE_SECRET_KEY must use sk_live_ in production')
  if (!String(process.env.STRIPE_WEBHOOK_SECRET || '').trim()) failures.push('STRIPE_WEBHOOK_SECRET is required in production')
  if (!String(process.env.STRIPE_PRICE_BASIC || '').trim()) failures.push('STRIPE_PRICE_BASIC is required in production')
  if (!String(process.env.STRIPE_PRICE_PREMIUM || '').trim()) failures.push('STRIPE_PRICE_PREMIUM is required in production')
}

if (nodeEnv === 'staging' && paymentsMode === 'stripe') {
  if (stripeMode !== 'test') failures.push('STRIPE_SECRET_KEY must use sk_test_ in staging Stripe mode')
  if (!String(process.env.STRIPE_WEBHOOK_SECRET || '').trim()) failures.push('STRIPE_WEBHOOK_SECRET is required in staging Stripe mode')
  if (!String(process.env.STRIPE_PRICE_BASIC || '').trim()) failures.push('STRIPE_PRICE_BASIC is required in staging Stripe mode')
  if (!String(process.env.STRIPE_PRICE_PREMIUM || '').trim()) failures.push('STRIPE_PRICE_PREMIUM is required in staging Stripe mode')
}

if (
  String(process.env.GEOCODING_PROVIDER || '')
    .trim()
    .toLowerCase() === 'fixture'
) {
  failures.push(
    'GEOCODING_PROVIDER=fixture is forbidden in production'
  )
}

if (failures.length) {
  console.error('')
  console.error('MELEO production configuration validation FAILED')
  console.error('------------------------------------------------')
  failures.forEach(x => console.error(` - ${x}`))
  console.error('')
  process.exit(1)
}

console.log('MELEO production configuration validation: OK')
